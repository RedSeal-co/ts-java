/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./ls-archive.d.ts' />
/// <reference path='./java.d.ts' />

'use strict';

import _ = require('lodash');
import archive = require('ls-archive');
import assert = require('assert');
import BluePromise = require('bluebird');
import debug = require('debug');
import Immutable = require('immutable');
import ParamContext = require('./paramcontext');
import TsJavaOptions = require('./TsJavaOptions');
import Work = require('./work');

var dlog = debug('ts-java:classes-map');

var requiredSeedClasses: string[] = [
  'java.lang.Object',
  'java.lang.String',
];

interface Dictionary<T> {
  [index: string]: T;
}

type StringDictionary = Dictionary<string>;

var reservedShortNames: StringDictionary = {
  'Number': null
};

import ArchiveEntry = archive.ArchiveEntry;
import ClassDefinition = ClassesMap.ClassDefinition;
import ClassDefinitionMap = ClassesMap.ClassDefinitionMap;
import FieldDefinition = ClassesMap.FieldDefinition;
import MethodDefinition = ClassesMap.MethodDefinition;
import VariantsArray = ClassesMap.VariantsArray;

// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
class ClassesMap {

  // *unhandledTypes* is the set of all types that are not allowed by the whiteList filtering
  // yet are referenced by methods of classes that are included in the output java.d.ts file.
  public unhandledTypes: Immutable.Set<string>;

  // *unhandledSuperClasses* are any unhandledTypes that are superclasses of included types.
  public unhandledSuperClasses: Immutable.Set<string>;

  private java: Java.NodeAPI;
  private options: TsJavaOptions;

  private classes: ClassDefinitionMap;
  private includedPatterns: Immutable.Set<RegExp>;

  // shortToLongNameMap is used to detect whether a class name unambiguously identifies one class path.
  // Currently it is populated after making one full pass over all classes, and then used in a second full pass.
  // TODO: refactor so the first pass does only the work to find all classes, without creating ClassDefinitions.
  private shortToLongNameMap: StringDictionary;

  // allClasses is the list of all classes found by scanning the jars in the class path and applying
  // the inWhiteList() filter.
  private allClasses: Immutable.Set<string>;

  constructor(java: Java.NodeAPI, options: TsJavaOptions) {
    this.java = java;
    this.options = options;

    this.classes = {};
    this.unhandledTypes = Immutable.Set<string>();
    this.unhandledSuperClasses = Immutable.Set<string>();
    this.allClasses = Immutable.Set<string>();

    // We create this after the first pass.
    this.shortToLongNameMap = null;

    this.includedPatterns = Immutable.Set(_.map(this.options.whiteList, (str: string) => {
      return new RegExp(str);
    }));

    var seeds = Immutable.Set(requiredSeedClasses).merge(options.seedClasses);
    seeds.forEach((className: string) => {
      if (!this.inWhiteList(className)) {
        var pattern = new RegExp('^' + className.replace(/([\.\$])/g, '\\$1') + '$');
        this.includedPatterns = this.includedPatterns.add(pattern);
      }
    });
  }

  // *inWhiteList()*: Return true for classes of interest.
  inWhiteList(className: string): boolean {
    return this.includedPatterns.find((ns: RegExp) => { return className.match(ns) !== null; }) !== undefined;
  }

  // *shortClassName()*: Return the short class name given the full className (class path).
  shortClassName(className: string): string {
    return _.last(className.split('.'));
  }

  // *loadClass()*: load the class and return its Class object.
  loadClass(className: string): Java.Class {
    return this.java.getClassLoader().loadClassSync(className);
  }

  // *mapClassInterfaces()*: Find the direct interfaces of className.
  // Note that we later compute the transitive closure of all inherited interfaces
  mapClassInterfaces(className: string, clazz: Java.Class, work: Work) : Array<string> {
    assert.strictEqual(clazz.getNameSync(), className);
    var interfaces = _.map(clazz.getInterfacesSync(), (intf: Java.Class) => { return intf.getNameSync(); });
    interfaces = _.filter(interfaces, (intf: string) => { return this.inWhiteList(intf); });

    // Methods of Object must always be available on any instance variable, even variables whose static
    // type is a Java interface. Java does this implicitly. We have to do it explicitly.
    var javaLangObject = 'java.lang.Object';
    if (interfaces.length === 0 && className !== javaLangObject && clazz.getSuperclassSync() === null) {
      interfaces.push(javaLangObject);
    }

    _.forEach(interfaces, (intf: string) => { work.addTodo(intf); });

    return interfaces;
  }

  // *typeEncoding()*: return the JNI encoding string for a java class
  typeEncoding(clazz: Java.Class): string {
    var name = clazz.getNameSync();
    var primitives: StringDictionary = {
      boolean: 'Z',
      byte: 'B',
      char: 'C',
      double: 'D',
      float: 'F',
      int: 'I',
      long: 'J',
      short: 'S',
      void: 'V'
    };

    var encoding: string;
    if (clazz.isPrimitiveSync()) {
      encoding = primitives[name];
    } else if (clazz.isArraySync()) {
      encoding = name;
    } else {
      encoding = clazz.getCanonicalNameSync();
      assert.ok(encoding, 'typeEncoding cannot handle type');
      encoding = 'L' + encoding + ';';
    }

    return encoding.replace(/\./g, '/');
  }

  // #### **methodSignature()**: return the signature of a method, i.e. a string unique to any method variant,
  // encoding the method name, types of parameters, and the return type.
  // This string may be passed as the method name to java.callMethod() in order to execute a specific variant.
  methodSignature(method: Java.Executable): string {
    var name = method.getNameSync();
    var paramTypes = method.getParameterTypesSync();
    var sigs = paramTypes.map((p: Java.Class) => { return this.typeEncoding(p); });
    var signature = name + '(' + sigs.join('') + ')';
    if ('getReturnTypeSync' in method) {
      // methodSignature can be called on either a constructor or regular method.
      // constructors don't have return types.
      signature += this.typeEncoding((<Java.Method>method).getReturnTypeSync());
    }
    return signature;
  }

  // #### **tsTypeName()**: given a java type name, return a typescript type name
  tsTypeName(javaTypeName: string, context: ParamContext = ParamContext.eInput): string {
    var typeName = javaTypeName;

    var ext = '';
    while (typeName[0] === '[') {
      typeName = typeName.slice(1);
      ext += '[]';
    }

    var m = typeName.match(/^L(.*);$/);
    if (m) {
      typeName = m[1];
    }

    // First convert the 1-letter JNI abbreviated type names to their human readble types
    var jniAbbreviations: StringDictionary = {
      // see http://docs.oracle.com/javase/7/docs/technotes/guides/jni/spec/types.html
      B: 'byte',
      C: 'char',
      D: 'double',
      F: 'float',
      I: 'int',
      J: 'long',
      S: 'short',
      Z: 'boolean'
    };
    if (typeName in jniAbbreviations) {
      typeName = jniAbbreviations[typeName];
    }

    // Next, promote primitive types to their corresponding Object types, to avoid redundancy below.
    var primitiveToObjectMap: StringDictionary = {
      'byte': 'java.lang.Object',
      'char': 'java.lang.Object',
      'boolean': 'java.lang.Boolean',
      'short': 'java.lang.Short',
      'long' : 'java.lang.Long',
      'int': 'java.lang.Integer',
      'float': 'java.lang.Float',
      'double': 'java.lang.Double'
    };
    if (typeName in primitiveToObjectMap) {
      typeName = primitiveToObjectMap[typeName];
    }

    if (!this.inWhiteList(typeName) && typeName !== 'void') {
      // Since the type is not in our whiteList, we might want to use the Typescript 'any' type.
      // However, array_t<any> doesn't really make sense. Rather, we want array_t<Object>,
      // or possibly instead of Object a superclass that is in our whitelist.
      this.unhandledTypes = this.unhandledTypes.add(typeName);
      typeName = 'java.lang.Object';
    }

    // Finally, convert Java primitive types to Typescript primitive types.

    // node-java does type translation for a set of common/primitive types.
    // Translation is done both for function input parameters, and function return values.
    // In general, it's not a 1-1 mapping between types.
    // For function input parameters, we generaly need union types, so that methods can accept
    // either javascript values, or java values (object pointers of a given Java type).
    // Function return results are always a single type, but several java types may map to
    // one javascript type (e.g. number).

    // string_t is a union type [string|java.lang.String] defined in the handlebars template.
    // Likewise object_t is the union type [string|java.lang.Object], a special case because it
    // is common to pass a string to methods that are declared to take Object.
    // (This may change when we implement generics).

    // java.lang.Long type requires special handling, since javascript does not have 64-bit integers.
    // For return values, node-java returns a Number that has an additional key 'longValue' holding a string
    // representation of the full long integer. The value of the Number itself is the best floating point
    // approximation (53 bits of the mantissa plus an exponent).
    // We define an interface longValue_t (in package.txt) that that extends Number and adds a string member longValue.
    // We also define long_t, which is the union [number|longValue_t|java.lang.Long].

    var javaTypeToTypescriptType: StringDictionary = {
      void: 'void',
      'java.lang.Boolean': context === ParamContext.eInput ? 'boolean_t' : 'boolean',
      'java.lang.Double':  context === ParamContext.eInput ? 'double_t' : 'number',
      'java.lang.Float':   context === ParamContext.eInput ? 'float_t' : 'number',
      'java.lang.Integer': context === ParamContext.eInput ? 'integer_t' : 'number',
      'java.lang.Long':    context === ParamContext.eInput ? 'long_t' : 'longValue_t',
      'java.lang.Number':  context === ParamContext.eInput ? 'number_t' : 'number',
      'java.lang.Object':  context === ParamContext.eInput ? 'object_t' : 'object_t', // special case
      'java.lang.Short':   context === ParamContext.eInput ? 'short_t' : 'number',
      'java.lang.String':  context === ParamContext.eInput ? 'string_t' : 'string'
    };

    if (typeName in javaTypeToTypescriptType) {
      typeName = javaTypeToTypescriptType[typeName];
    } else if (this.inWhiteList(typeName)) {
      // Use the short class name if it doesn't cause name conflicts.
      // This can only be done correctly in our 2nd pass, when this.shortToLongNameMap has been populated.
      // However, conflicts are very rare, and unit tests currently don't run two passes,
      // so it is convenient to always map to the short name in the first pass.
      var shortName = this.shortClassName(typeName);
      if (!this.shortToLongNameMap || this.shortToLongNameMap[shortName] === typeName) {
        typeName = shortName;
      }
    } else {
      dlog('Unhandled type:', typeName);
      this.unhandledTypes = this.unhandledTypes.add(typeName);
      typeName = 'any';
    }

    // Handle arrays
    assert.ok(ext.length % 2 === 0);  // ext must be sequence of zero or more '[]'.
    if (ext === '') {
      // A scalar type, nothing to do here
    } else if (context === ParamContext.eReturn) {
      // Functions that return a Java array are thunked by node-java to return a
      // javascript array of the corresponding type.
      // This seems to work even for multidimensional arrays.
      typeName = typeName + ext;
    } else if (ext === '[]') {
      // Node-java has support for 1d arrays via newArray. We need the special opaque type array_t<T> to
      // model the type of these array objects.
      typeName = 'array_t<' + typeName  + '>';
    } else {
      // This final else block handles two cases for multidimensial arrays:
      // 1) When used as a function input.
      // 2) When returned as a function result, and the element type is not a primitive.
      // Node-java currently doesn't handle these cases. We use the 'void' type here so that
      // such uses will be flagged with an error at compile time.
      this.unhandledTypes = this.unhandledTypes.add(typeName + ext);
      typeName = 'void';
    }

    return typeName;
  }

  baseType(typeName: string): [string, string] {
    var ext = '';
    while (typeName[0] === '[') {
      typeName = typeName.slice(1);
      ext += '[]';
    }

    var m = typeName.match(/^L(.*);$/);
    if (m) {
      typeName = m[1];
    }

    return [typeName, ext];
  }

  addToTheToDoList(canonicalTypeName: string, work: Work): void {
    // We expect various type names here, 4 general categories:
    // 1) primitive types such as int, long, char
    // 2) arrays of primitive types, such as int[]
    // 3) class names such as java.util.Iterator
    // 4) array-of-class names such as java.util.Iterator[]
    // We only add to the todo list for the last two, and only in the non-array form.
    var parts: [string, string] = this.baseType(canonicalTypeName);
    canonicalTypeName = parts[0];
    if (this.inWhiteList(canonicalTypeName)) {
        work.addTodo(canonicalTypeName);
    }
  }

  // *mapMethod()*: return a map of useful properties of a method or constructor.
  // For our purposes, we can treat constructors as methods except for the handling of return type.
  mapMethod(method: Java.Executable, work: Work): MethodDefinition {

    var signature = this.methodSignature(method);

    var modifiers: number = method.getModifiersSync();
    var isStatic: boolean = (modifiers & 8) === 8;

    var returnType: string = 'void';
    if ('getReturnTypeSync' in method) {
      returnType = (<Java.Method>method).getReturnTypeSync().getNameSync();
    } else {
      // It is convenient to declare the return type for a constructor to be the type of the class,
      // possibly transformed by tsTypeName. This is because node-java will always convert boxed primitive
      // types to the corresponding javascript primitives, e.g. java.lang.String -> string, and
      // java.lang.Integer -> number.
      returnType = method.getDeclaringClassSync().getNameSync();
    }

    var methodMap: MethodDefinition = {
      name: method.getNameSync(),
      declared: method.getDeclaringClassSync().getNameSync(),
      returns: returnType,
      tsReturns: this.tsTypeName(returnType, ParamContext.eReturn),
      paramNames: _.map(method.getParametersSync(), (p: Java.Parameter) => { return p.getNameSync(); }),
      paramTypes: _.map(method.getParameterTypesSync(), (p: Java.Class) => { return p.getNameSync(); }),
      tsParamTypes: _.map(method.getParameterTypesSync(), (p: Java.Class) => { return this.tsTypeName(p.getNameSync()); }),
      isStatic: isStatic,
      isVarArgs: method.isVarArgsSync(),
      generic_proto: method.toGenericStringSync(),
      plain_proto: method.toStringSync(),
      signature: signature
    };

    this.addToTheToDoList(methodMap.declared, work);
    this.addToTheToDoList(methodMap.returns, work);
    _.forEach(methodMap.paramTypes, (p: string) => {
      this.addToTheToDoList(p, work);
    });

    return methodMap;
  }

  // *mapClassMethods()*: return a methodMap array for the methods of a class
  mapClassMethods(className: string, clazz: Java.Class, work: Work): Array<MethodDefinition> {
    return _.map(clazz.getMethodsSync(), function (m: Java.Method) { return this.mapMethod(m, work); }, this);
  }

  // *mapField()*: return a map of useful properties of a field.
  mapField(field: Java.Field, work: Work): FieldDefinition {
    var name: string = field.getNameSync();
    var fieldType: Java.Class = field.getTypeSync();
    var fieldTypeName: string = fieldType.getNameSync();
    var declaredIn: string = field.getDeclaringClassSync().getNameSync();
    var tsType: string = this.tsTypeName(fieldTypeName, ParamContext.eReturn);

    if (this.inWhiteList(fieldTypeName)) {
      this.addToTheToDoList(fieldTypeName, work);
    }

    var modifiers: number = field.getModifiersSync();
    var isStatic: boolean = (modifiers & 8) === 8;
    var isSynthetic: boolean = field.isSyntheticSync();

    var fieldDefinition: FieldDefinition = {
      name: name,
      tsType: tsType,
      isStatic: isStatic,
      isSynthetic: isSynthetic,
      modifiers: modifiers,
      declaredIn: declaredIn
    };

    return fieldDefinition;
  }

  // *mapClassFields()*: return a FieldDefinition array for the fields of a class
  mapClassFields(className: string, clazz: Java.Class, work: Work): Array<FieldDefinition> {
    // For reasons I don't understand, it seems that getFields() can return duplicates.
    // TODO: Figure out why there are duplicates, as perhaps there is a better fix.
    // In the meantime, we dedup here.
    var allFields: Array<FieldDefinition> = _.map(clazz.getFieldsSync(), function (f: Java.Field) { return this.mapField(f, work); }, this);
    return _.uniq(allFields, false, 'name');
  }

  // *mapClassConstructors()*: return a methodMap array for the constructors of a class
  mapClassConstructors(className: string, clazz: Java.Class, work: Work): Array<MethodDefinition> {
    return _.map(clazz.getConstructorsSync(), function (m: Java.Constructor) { return this.mapMethod(m, work); }, this);
  }

  compareVariants(a: MethodDefinition, b: MethodDefinition): number {
    function countArgsOfTypeAny(a: MethodDefinition): number {
      return _.filter(a.tsParamTypes, (t: string) => t === 'any').length;
    }

    // We want variants with more parameters to come first.
    if (a.paramTypes.length > b.paramTypes.length) {
      return -1;
    } else if (a.paramTypes.length < b.paramTypes.length) {
      return 1;
    }

    // For the same number of parameters, order methods with fewer 'any' arguments first
    if (countArgsOfTypeAny(a) < countArgsOfTypeAny(b)) {
      return -1;
    } else if (countArgsOfTypeAny(a) > countArgsOfTypeAny(b)) {
      return 1;
    }

    // For the same number of parameters, order the longer (presumably more complex) signature to be first
    if (a.signature.length > b.signature.length) {
      return -1;
    } else if (a.signature.length < b.signature.length) {
      return 1;
    }

    // As a penultimate catch-all, sort lexically by signature.
    var result: number = b.signature.localeCompare(a.signature);
    if (result !== 0) {
      return result;
    }

    // As a final catch-all, sort lexically by the generic proto signature.
    return a.generic_proto.localeCompare(b.generic_proto);
  }

  // *flattenDictionary()*: return an array of the dictionary's values, sorted by the dictionary's keys.
  flattenDictionary<T>(dict: Dictionary<T>): T[] {
    function caseInsensitiveOrder(a: string, b: string): number {
      var A = a.toLowerCase();
      var B = b.toLowerCase();
      if (A < B) {
        return -1;
      } else if (A > B) {
        return  1;
      } else {
      return 0;
      }
    }
    var keys = _.keys(dict).sort(caseInsensitiveOrder);
    return _.map(keys, (key: string): T => dict[key]);
  }

  // *groupMethods()*: group overloaded methods (i.e. having the same name)
  groupMethods(flatList: Array<MethodDefinition>): VariantsArray {
    var variantsMap = _.groupBy(flatList, (method: MethodDefinition) => { return method.name; });
    _.forEach(variantsMap, (variants: Array<MethodDefinition>, name: string) => {
      variantsMap[name] = variants.sort(this.compareVariants);
    });

    return this.flattenDictionary(variantsMap);
  }

  // *fixClassPath()*: given a full class path name, rename any path components that are reserved words.
  fixClassPath(fullName: string): string {
    var reservedWords = [
      // TODO: include full list of reserved words
      'function',
      'package'
    ];
    var parts = fullName.split('.');
    parts = _.map(parts, (part: string) => {
      if (_.indexOf(reservedWords, part) === -1) {
        return part;
      } else {
        return part + '_';
      }
    });
    return parts.join('.');
  }

  // *packageName()*: given a full class path name, return the package name.
  packageName(className: string): string {
    var parts = className.split('.');
    parts.pop();
    return parts.join('.');
  }

  // *mapClass()*: return a map of all useful properties of a class.
  mapClass(className: string, work: Work): ClassDefinition {
    var clazz: Java.Class = this.loadClass(className);
    assert.strictEqual(className, clazz.getNameSync());

    var interfaces = this.mapClassInterfaces(className, clazz, work);
    var methods: Array<MethodDefinition> = this.mapClassMethods(className, clazz, work);
    var fields: Array<FieldDefinition> = this.mapClassFields(className, clazz, work);

    var constructors: Array<MethodDefinition> = this.mapClassConstructors(className, clazz, work);

    var shortName: string = this.shortClassName(className);
    var alias: string = shortName;
    var useAlias: boolean = true;

    if (this.shortToLongNameMap === null) {
      // First pass, don't do this work yet
    } else if (this.shortToLongNameMap[shortName] !== className) {
      alias = className;
      useAlias = false;
    }

    var isInterface = clazz.isInterfaceSync();
    var isPrimitive = clazz.isPrimitiveSync();
    var isEnum = clazz.isEnumSync();

    // Get the superclass of the class, if it exists, and is in our white list.
    // If the immediate type is not in the whitelist, we ascend up the ancestry
    // until we find a whitelisted superclass. If none exists, we declare the
    // class to not have a superclass, even though it does.
    // The developer may want to include the superclass in the seed classes.
    var superclass: Java.Class = clazz.getSuperclassSync();
    while (superclass && !this.inWhiteList(superclass.getNameSync())) {
      this.unhandledTypes = this.unhandledTypes.add(superclass.getNameSync());
      this.unhandledSuperClasses = this.unhandledSuperClasses.add(superclass.getNameSync());
      superclass = superclass.getSuperclassSync();
    }

    function bySignature(a: MethodDefinition, b: MethodDefinition) {
      return a.signature.localeCompare(b.signature);
    }

    var tsInterfaces = _.map(interfaces, (intf: string) => { return this.fixClassPath(intf); });
    if (superclass) {
      work.addTodo(superclass.getNameSync());
      tsInterfaces.unshift(this.fixClassPath(superclass.getNameSync()));
    }

    // tsInterfaces is used in the extends clause of an interface declaration.
    // Each intf is an interface name is a fully scoped java path, but in typescript
    // these paths are all relative paths under the output module Java.
    // In most cases it is not necessary to include the 'Java.' module in the interface
    // name, but in few cases leaving it out causes naming conflicts, most notably
    // between java.lang and groovy.lang.
    tsInterfaces = _.map(tsInterfaces, (intf: string) => { return 'Java.' + intf; });

    var classMap: ClassDefinition = {
      quotedPkgName: this.packageName(this.fixClassPath(className)),
      packageName: this.packageName(className),
      fullName: className,
      shortName: shortName,
      alias: alias,
      useAlias: useAlias,
      tsType: this.tsTypeName(className),
      isInterface: isInterface,
      isPrimitive: isPrimitive,
      superclass: superclass === null ? null : superclass.getNameSync(),
      interfaces: interfaces,
      tsInterfaces: tsInterfaces,
      methods: methods.sort(bySignature),
      constructors: constructors.sort(this.compareVariants),
      variants: this.groupMethods(methods),
      isEnum: isEnum,
      fields: fields
    };

    return classMap;
  }

  // *loadAllClasses()*: load and map all classes of interest
  loadAllClasses(seedClasses: Array<string>): Work {
    var work = new Work();
    _.forEach(seedClasses, (className: string) => work.addTodo(className));
    _.forEach(requiredSeedClasses, (className: string) => work.addTodo(className));

    while (!work.isDone()) {
      var className = work.next();
      work.setDone(className);
      this.classes[className] = this.mapClass(className, work);
    }

    return work;
  }

  // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
  getClasses(): ClassDefinitionMap {
    return this.classes;
  }

  // *getSortedClasses()*: return a sorted array of classes.
  getSortedClasses(): Array<ClassDefinition> {
    return this.flattenDictionary(this.classes);
  }

  getWhitedListedClassesInJar(jarpath: string): BluePromise<Array<string>> {
    var listArchive = BluePromise.promisify(archive.list, archive);
    return listArchive(jarpath)
      .then((entries: Array<ArchiveEntry>) => {
        var allPaths: Array<string> = _.map(entries, (entry: ArchiveEntry) => entry.getPath());
        var classFilePaths: Array<string> = _.filter(allPaths, (path: string) => /.class$/.test(path));
        var classNames: Array<string> = _.map(classFilePaths, (path: string) => {
          return path.slice(0, -'.class'.length).replace(/\//g, '.');
        });
        var result: Array<string> = _.filter(classNames, (name: string) => this.inWhiteList(name));
        return result;
      });
  }

  // *initialize()*: fully initialize from seedClasses and whitelists.
  initialize(): BluePromise<void> {
    return this.preScanAllClasses()
      .then(() => {
        // We assume this.allClasses now contains a complete list of all classes
        // that we will process. We scan it now to create the shortToLongNameMap,
        // which allows us to discover class names conflicts.
        // Conflicts are recorded by using null for the longName.
        this.shortToLongNameMap = {};
        this.allClasses.forEach((longName: string): any => {
          var shortName = this.shortClassName(longName);
          if (shortName in reservedShortNames || shortName in this.shortToLongNameMap) {
            // We have a conflict
            this.shortToLongNameMap[shortName] = null;
          } else {
            // No conflict yet
            this.shortToLongNameMap[shortName] = longName;
          }
        });

        var seeds: Array<string> = this.allClasses.toArray();
        this.loadAllClasses(seeds);
      });
  }

  // *preScanAllClasses()*: scan all jars in the class path and find all classes matching our filter.
  // The result is stored in the member variable this.allClasses and returned as the function result
  private preScanAllClasses(): BluePromise<Immutable.Set<string>> {
    var options = this.options;
    return BluePromise.reduce(options.classpath, (allSoFar: Immutable.Set<string>, jarpath: string) => {
      return this.getWhitedListedClassesInJar(jarpath)
        .then((classes: Array<string>) => {
          return BluePromise.reduce(classes, (allSoFar: Immutable.Set<string>, className: string) => allSoFar.add(className), allSoFar);
        });
    }, Immutable.Set<string>())
    .then((allSoFar: Immutable.Set<string>) => {
      // We don't have java.lang classes in the scan of jars in the class path.
      // We'll get them from these two sources of seed classes.
      allSoFar = allSoFar.union(options.seedClasses);
      allSoFar = allSoFar.union(requiredSeedClasses);
      this.allClasses = allSoFar;
      return allSoFar;
    });
  }

}

module ClassesMap {

  'use strict';

  // ### MethodDefinition
  // All of the properties on interest for a method.
  export interface MethodDefinition {
    name: string;           // name of method, e.g. 'forEachRemaining'
    declared: string;       // interface where first declared: 'java.util.Iterator'
    returns: string;        // return type, e.g. 'void', 'int', of class name
    tsReturns: string;        // return type, e.g. 'void', 'number', of class name
    paramNames: Array<string>;  // [ 'arg0' ],
    paramTypes: Array<string>;  // [ 'java.util.function.Consumer', '[S' ],
    tsParamTypes: Array<string>;  // [ 'java.util.function_.Consumer',  'number' ],
    isStatic: boolean;      // true if this is a static method
    isVarArgs: boolean;     // true if this method's last parameter is varargs ...type
    generic_proto: string;  // The method prototype including generic type information
    plain_proto: string;    // The java method prototype without generic type information
    signature: string;     // A method signature related to the plain_proto prototype above
                            // This signature does not include return type info, as java does not
                            // use return type to distinguish among overloaded methods.
  }

  // ### VariantsArray
  export type VariantsArray = Array<Array<MethodDefinition>>;

  export interface FieldDefinition {
    name: string;
    tsType: string;
    isStatic: boolean;
    isSynthetic: boolean;
    modifiers: number;
    declaredIn: string;
  }

  // ### ClassDefinition
  // All of the properties on interest for a class.
  export interface ClassDefinition {
    quotedPkgName: string;             // 'java.util.function_'
    packageName: string;               // 'java.util.function'
    fullName: string;                  // 'java.util.Iterator'
    shortName: string;                 // 'Iterator'
    alias: string;                     // This will be shortName, unless two classes have the same short name,
                                       // of if the short name conflicts with a Javascript type (e.g. Number).
    useAlias: boolean;                 // true if alias is the shortName.
    tsType: string;                    // For primitive wrappers, the ts type, e.g. 'java.lang.String' -> 'string'
    isInterface: boolean;              // true if this is an interface, false for class or primitive type.
    isPrimitive: boolean;              // true for a primitive type, false otherwise.
    superclass: string;                // null if no superclass, otherwise class name
    interfaces: Array<string>;         // [ 'java.util.function.Function' ]
    tsInterfaces: Array<string>;       // [ 'java.util.function_.Function' ]
    methods: Array<MethodDefinition>;  // definitions of all methods implemented by this class
    constructors: Array<MethodDefinition>; // definitions of all constructors for this class, may be empty.
    variants: VariantsArray;             // definitions of all methods, grouped by method name
    isEnum: boolean;                   // true for an Enum, false otherwise.
    fields: Array<FieldDefinition>;    // array of FieldDefinitions for public fields.

  }

  export interface ClassDefinitionMap {
    [index: string]: ClassDefinition;
  }

}

export = ClassesMap;
