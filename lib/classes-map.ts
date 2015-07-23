/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./zip.d.ts' />

'use strict';

import _ = require('lodash');
import assert = require('assert');
import BluePromise = require('bluebird');
import debug = require('debug');
import fs = require('fs');
import Immutable = require('immutable');
import ParamContext = require('./paramcontext');
import TsJavaOptions = require('./TsJavaOptions');
import Work = require('./work');
import zip = require('zip');

import reflection = require('./reflection');
import Java = reflection.Java;

var openAsync = BluePromise.promisify(fs.open);

var dlog = debug('ts-java:classes-map');

var requiredCoreClasses: string[] = [
  'java.lang.Object',
  'java.lang.String',
];

interface Dictionary<T> {
  [index: string]: T;
}

type StringDictionary = Dictionary<string>;

// One method's variants, grouped by method signature.
type VariantsBySignature = Dictionary<MethodDefinition>;

// All of one class's methods in a doubly-indexed map, by method name then by method signature.
type MethodsByNameBySignature = Dictionary<VariantsBySignature>;

var reservedShortNames: StringDictionary = {
  'Number': null
};

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

  // *unhandledTypes* is the set of all types that are not included by the configured classes/packages lists
  // yet are referenced by methods of classes that are included in the output java.d.ts file.
  public unhandledTypes: Immutable.Set<string>;

  // *unhandledInterfaces* are any excluded types that are interfaces of included types.
  public unhandledInterfaces: Immutable.Set<string>;

  // *unhandledSuperClasses* are any excluded that are superclasses of included types.
  public unhandledSuperClasses: Immutable.Set<string>;

  private classCache: Immutable.Map<string, Java.Class>;

  private options: TsJavaOptions;

  private classes: ClassDefinitionMap;
  private includedPatterns: Immutable.Set<RegExp>;

  // shortToLongNameMap is used to detect whether a class name unambiguously identifies one class path.
  private shortToLongNameMap: StringDictionary;

  // allClasses is the list of all classes that should appear in the output java.d.ts file.
  // The list is created via two steps:
  // 1) Scan the jars in the class path for all classes matching the inWhiteList filter.
  // 2) Remove any non-public classes from the list.
  private allClasses: Immutable.Set<string>;

  private interfaceDepthCache: Immutable.Map<string, number>;

  constructor(options: TsJavaOptions) {
    this.options = options;

    this.classCache = Immutable.Map<string, Java.Class>();
    this.classes = {};
    this.unhandledTypes = Immutable.Set<string>();
    this.unhandledInterfaces = Immutable.Set<string>();
    this.unhandledSuperClasses = Immutable.Set<string>();
    this.allClasses = Immutable.Set<string>();

    // We create this after the first pass.
    this.shortToLongNameMap = null;

    this.interfaceDepthCache = Immutable.Map<string, number>();

    // TODO: remove these two lines when the deprecated `seedClasses` and `whiteList` are no longer needed.
    options.classes = options.classes || options.seedClasses;
    options.packages = options.packages || options.whiteList;

    this.includedPatterns = Immutable.Set(_.map(this.options.packages, (expr: string) => {
      var pattern: RegExp = this.packageExpressionToRegExp(expr);
      dlog('package pattern:', pattern);
      return pattern;
    }));

    var seeds = Immutable.Set(requiredCoreClasses).merge(options.classes);
    seeds.forEach((className: string) => {
      if (!this.inWhiteList(className)) {
        var pattern = new RegExp('^' + className.replace(/([\.\$])/g, '\\$1') + '$');
        this.includedPatterns = this.includedPatterns.add(pattern);
      }
    });
  }

  // *initialize()*: fully initialize from configured packages & classes.
  public initialize(): BluePromise<void> {
    return BluePromise.resolve()
      .then(() => this.preScanAllClasses())
      .then(() => this.loadClassCache())
      .then(() => this.createShortNameMap())
      .then(() => this.analyzeIncludedClasses());
  }

  // *getSortedClasses()*: return a sorted array of classes.
  public getSortedClasses(): Array<ClassDefinition> {
    return this.flattenDictionary(this.classes);
  }

  // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
  public getClasses(): ClassDefinitionMap {
    return this.classes;
  }

  // *getAllClasses()*: Return the set of all classes selected by the configuration, i.e. appearing in output java.d.ts.
  public getAllClasses(): Immutable.Set<string> {
    return this.allClasses;
  }

  // *getOptions()*: Return the TsJavaOptions used to configure this ClassesMap.
  public getOptions(): TsJavaOptions {
    return this.options;
  }

  // *packageExpressionToRegExp()*: Return a RegExp equivalent to the given package expression.
  public packageExpressionToRegExp(expr: string): RegExp {
    if (/\.\*$/.test(expr)) {
      // package string ends with .*
      expr = expr.slice(0, -1); // remove the *
      expr = expr + '[\\w\\$]+$'; // and replace it with expression designed to match exactly one classname string
    } else if (/\.\*\*$/.test(expr)) {
      // package string ends with .**
      expr = expr.slice(0, -2); // remove the **
    }
    expr = '^' + expr.replace(/\./g, '\\.');
    return new RegExp(expr);
  }

  // #### **tsTypeName()**: given a java type name, return a typescript type name
  // declared public only for unit tests
  public tsTypeName(javaTypeName: string, context: ParamContext = ParamContext.eInput): string {
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

    if (!this.isIncludedClass(typeName) && typeName !== 'void') {
      // Since the type is not in our included classes, we might want to use the Typescript 'any' type.
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
    } else if (this.isIncludedClass(typeName)) {
      // Use the short class name if it doesn't cause name conflicts.
      // This can only be done correctly after running prescanAllClasses,
      // when this.shortToLongNameMap has been populated.
      // However, conflicts are very rare, and unit tests currently don't run prescanAllClasses,
      // so it is convenient to always map to the short name if shortToLongNameMap doesn't exist.
      var shortName = this.shortClassName(typeName);
      if (!this.shortToLongNameMap || this.shortToLongNameMap[shortName] === typeName) {
        typeName = shortName;
      }
      // Add the 'Java.' namespace
      typeName = 'Java.' + typeName;
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

  // *mapMethod()*: return a map of useful properties of a method or constructor.
  // For our purposes, we can treat constructors as methods except for the handling of return type.
  // declared public only for unit tests
  public mapMethod(method: Java.Executable): MethodDefinition {

    var signature = this.methodSignature(method);

    var Modifier: Java.Modifier.Static = Java.importClass('java.lang.reflect.Modifier');
    var isStatic: boolean = Modifier.isStatic(method.getModifiers());

    var returnType: string = 'void';
    if ('getReturnType' in method) {
      returnType = (<Java.Method>method).getReturnType().getName();
    } else {
      // It is convenient to declare the return type for a constructor to be the type of the class,
      // possibly transformed by tsTypeName. This is because node-java will always convert boxed primitive
      // types to the corresponding javascript primitives, e.g. java.lang.String -> string, and
      // java.lang.Integer -> number.
      returnType = method.getDeclaringClass().getName();
    }

    var methodMap: MethodDefinition = {
      name: method.getName(),
      declared: method.getDeclaringClass().getName(),
      returns: returnType,
      tsReturns: this.tsTypeName(returnType, ParamContext.eReturn),
      paramNames: _.map(method.getParameters(), (p: Java.Parameter) => { return p.getName(); }),
      paramTypes: _.map(method.getParameterTypes(), (p: Java.Class) => { return p.getName(); }),
      tsParamTypes: _.map(method.getParameterTypes(), (p: Java.Class) => { return this.tsTypeName(p.getName()); }),
      isStatic: isStatic,
      isVarArgs: method.isVarArgs(),
      generic_proto: method.toGenericString(),
      plain_proto: method.toString(),
      signature: signature
    };

    return methodMap;
  }

  // *mapClassMethods()*: return a methodMap array for the methods of a class
  // declared public only for unit tests
  public mapClassMethods(className: string, clazz: Java.Class): Array<MethodDefinition> {
    return _.map(clazz.getMethods(), function (m: Java.Method) { return this.mapMethod(m); }, this);
  }

  // *mapClass()*: return a map of all useful properties of a class.
  // declared public only for unit tests
  public mapClass(className: string, work: Work): ClassDefinition {
    var clazz: Java.Class = this.getClass(className);
    assert.strictEqual(className, clazz.getName());

    // Get the superclass of the class, if it exists, and is an included class.
    // If the immediate type is not an included class, we ascend up the ancestry
    // until we find an included superclass. If none exists, we declare the
    // class to not have a superclass, even though it does.
    // We report all such skipped superclasses in the summary diagnostics.
    // The developer can then choose to add any of these classes to the seed classes list.
    var superclass: Java.Class = clazz.getSuperclass();
    while (superclass && !this.isIncludedClass(superclass.getName())) {
      this.unhandledSuperClasses = this.unhandledSuperClasses.add(superclass.getName());
      superclass = superclass.getSuperclass();
    }

    var interfaces = this.mapClassInterfaces(className, clazz).sort();
    if (superclass) {
      interfaces.unshift(superclass.getName());
    }

    interfaces.forEach((intfName: string) => {
      if (!work.alreadyDone(intfName)) {
        work.addTodo(intfName);  // needed only to simplify a unit test. Normally a no-op.
        dlog('Recursing in mapClass to do inherited interface:', intfName);
        this.classes[intfName] = this.mapClass(intfName, work);
        work.setDone(intfName);
      }
    });

    var methods: Array<MethodDefinition> = this.mapClassMethods(className, clazz).sort(bySignature);
    var fields: Array<FieldDefinition> = this.mapClassFields(className, clazz);

    var constructors: Array<MethodDefinition> = this.mapClassConstructors(className, clazz);

    var shortName: string = this.shortClassName(className);
    var alias: string = shortName;
    var useAlias: boolean = true;

    if (this.shortToLongNameMap === null) {
      // First pass, don't do this work yet
    } else if (this.shortToLongNameMap[shortName] !== className) {
      alias = className;
      useAlias = false;
    }

    var isInterface = clazz.isInterface();
    var isPrimitive = clazz.isPrimitive();
    var isEnum = clazz.isEnum();

    function bySignature(a: MethodDefinition, b: MethodDefinition) {
      return a.signature.localeCompare(b.signature);
    }

    var tsInterfaces = _.map(interfaces, (intf: string) => { return this.fixClassPath(intf); });

    // tsInterfaces is used in the extends clause of an interface declaration.
    // Each intf is an interface name is a fully scoped java path, but in typescript
    // these paths are all relative paths under the output module Java.
    // In most cases it is not necessary to include the 'Java.' module in the interface
    // name, but in few cases leaving it out causes naming conflicts, most notably
    // between java.lang and groovy.lang.
    tsInterfaces = _.map(tsInterfaces, (intf: string) => { return 'Java.' + intf; });

    var variantsDict: MethodsByNameBySignature = this.groupMethods(methods);

    this.mergeOverloadedVariants(variantsDict, interfaces);

    var variants: VariantsArray = _.map(variantsDict, (bySig: VariantsBySignature) =>
                                                        this.flattenDictionary(bySig).sort(this.compareVariants));

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
      superclass: superclass === null ? null : superclass.getName(),
      interfaces: interfaces,
      tsInterfaces: tsInterfaces,
      methods: methods,
      constructors: constructors.sort(this.compareVariants),
      variantsDict: variantsDict,
      variants: variants,
      isEnum: isEnum,
      fields: fields
    };

    return classMap;
  }

  // *inWhiteList()*: Return true for classes of interest.
  // declared public only for unit tests
  public inWhiteList(className: string): boolean {
    var allowed: boolean = this.includedPatterns.find((ns: RegExp) => { return className.match(ns) !== null; }) !== undefined;
    if (allowed) {
      var isAnon: boolean = /\$\d+$/.test(className);
      if (isAnon) {
        dlog('Filtering out anon class:', className);
        allowed = false;
      }
    }
    return allowed;
  }

  // *shortClassName()*: Return the short class name given the full className (class path).
  // declared public only for unit tests
  public shortClassName(className: string): string {
    return _.last(className.split('.'));
  }

  // *getClass()*: get the Class object for the given full class name.
  // declared public only for unit tests
  public getClass(className: string): Java.Class {
    var clazz = this.classCache.get(className);
    if (!clazz) {
      // For historical reasons, we simulate the exception thrown when the Java classloader doesn't find class
      throw new Error('java.lang.ClassNotFoundException:' + className);
    }
    return clazz;
  }

  // *mapClassInterfaces()*: Find the direct interfaces of className.
  // declared public only for unit tests
  public mapClassInterfaces(className: string, clazz: Java.Class) : Array<string> {
    assert.strictEqual(clazz.getName(), className);
    var interfaces: Array<string> = this.resolveInterfaces(clazz).toArray();

    // Methods of Object must always be available on any instance variable, even variables whose static
    // type is a Java interface. Java does this implicitly. We have to do it explicitly.
    var javaLangObject = 'java.lang.Object';
    if (interfaces.length === 0 && className !== javaLangObject && clazz.getSuperclass() === null) {
      interfaces.push(javaLangObject);
    }

    return interfaces;
  }

  // *fixClassPath()*: given a full class path name, rename any path components that are reserved words.
  // declared public only for unit tests
  public fixClassPath(fullName: string): string {
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

  // *isIncludedClass()*: Return true if the class will appear in the output java.d.ts file.
  // All such classes 1) match the classes or package expressions in the tsjava section of the package.json,
  // and 2) are public.
  private isIncludedClass(className: string): boolean {
    return this.allClasses.has(className);
  }

  // *resolveInterfaces()*: Find the set of non-excluded interfaces for the given class `clazz`.
  // If an interface of a class is excluded by the configuration, we check the ancestors of that class.
  private resolveInterfaces(clazz: Java.Class): Immutable.Set<string> {
    var result = Immutable.Set<string>();

    _.forEach(clazz.getInterfaces(), (intf: Java.Class): void => {
      var intfName: string = intf.getName();
      if (this.isIncludedClass(intfName)) {
        result = result.add(intfName);
      } else {
        // Remember the excluded interface
        this.unhandledInterfaces = this.unhandledInterfaces.add(intfName);
        // recurse and merge results.
        result = result.merge(this.resolveInterfaces(intf));
      }
    });

    return result;
  }

  // *typeEncoding()*: return the JNI encoding string for a java class
  private typeEncoding(clazz: Java.Class): string {
    var name = clazz.getName();
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
    if (clazz.isPrimitive()) {
      encoding = primitives[name];
    } else if (clazz.isArray()) {
      encoding = name;
    } else {
      encoding = clazz.getCanonicalName();
      assert.ok(encoding, 'typeEncoding cannot handle type');
      encoding = 'L' + encoding + ';';
    }

    return encoding.replace(/\./g, '/');
  }

  // #### **methodSignature()**: return the signature of a method, i.e. a string unique to any method variant,
  // encoding the method name, types of parameters, and the return type.
  // This string may be passed as the method name to java.callMethod() in order to execute a specific variant.
  private methodSignature(method: Java.Executable): string {
    var name = method.getName();
    var paramTypes = method.getParameterTypes();
    var sigs = paramTypes.map((p: Java.Class) => { return this.typeEncoding(p); });
    var signature = name + '(' + sigs.join('') + ')';
    if ('getReturnType' in method) {
      // methodSignature can be called on either a constructor or regular method.
      // constructors don't have return types.
      signature += this.typeEncoding((<Java.Method>method).getReturnType());
    }
    return signature;
  }

  // *mapField()*: return a map of useful properties of a field.
  private mapField(field: Java.Field): FieldDefinition {
    var name: string = field.getName();
    var fieldType: Java.Class = field.getType();
    var fieldTypeName: string = fieldType.getName();
    var declaredIn: string = field.getDeclaringClass().getName();
    var tsType: string = this.tsTypeName(fieldTypeName, ParamContext.eReturn);

    var Modifier: Java.Modifier.Static = Java.importClass('java.lang.reflect.Modifier');
    var isStatic: boolean = Modifier.isStatic(field.getModifiers());
    var isSynthetic: boolean = field.isSynthetic();

    var fieldDefinition: FieldDefinition = {
      name: name,
      tsType: tsType,
      isStatic: isStatic,
      isSynthetic: isSynthetic,
      declaredIn: declaredIn
    };

    return fieldDefinition;
  }

  // *mapClassFields()*: return a FieldDefinition array for the fields of a class
  private mapClassFields(className: string, clazz: Java.Class): Array<FieldDefinition> {
    var allFields: Array<Java.Field> = clazz.getFields();
    var allFieldDefs: Array<FieldDefinition> = _.map(allFields, (f: Java.Field) => this.mapField(f));

    // For instance fields, we should keep only the fields declared in this class.
    // We'll have access to inherited fields through normal inheritance.
    // If we kept the inherited fields, it would result in duplicate definitions in the derived classes.
    allFieldDefs = _.filter(allFieldDefs, (f: FieldDefinition) => f.isStatic || f.declaredIn === clazz.getName());

    return allFieldDefs;
  }

  // *mapClassConstructors()*: return a methodMap array for the constructors of a class
  private mapClassConstructors(className: string, clazz: Java.Class): Array<MethodDefinition> {
    return _.map(clazz.getConstructors(), function (m: Java.Constructor) { return this.mapMethod(m); }, this);
  }

  // *compareVariants()*: Compare two method definitions, which should be two variants with the same method name.
  // We arrange to sort methods from most specific to most generic, as expected by Typescript.
  private compareVariants(a: MethodDefinition, b: MethodDefinition): number {
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
  private flattenDictionary<T>(dict: Dictionary<T>): T[] {
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

  // *groupMethods()*: group methods first by name, and then by signature.
  private groupMethods(flatList: Array<MethodDefinition>): MethodsByNameBySignature {
    var result: MethodsByNameBySignature = {};
    _.forEach(flatList, (method: MethodDefinition) => {
      if (!_.has(result, method.name)) {
        result[method.name] = {};
      }
      result[method.name][method.signature] = method;
    });
    return result;
  }

  // *interfacesTransitiveClosure()*: return the transitive closure of all inherited interfaces given
  // a set of directly inherited interfaces.
  private interfacesTransitiveClosure(directInterfaces: string[]): string[] {
    var work: Work = new Work();
    directInterfaces.forEach((intf: string) => work.addTodo(intf));
    work.forEach((intf: string) => {
      this.classes[intf].interfaces.forEach((parent: string) => work.addTodo(parent));
    });
    return work.getDone().toArray();
  }

  // *interfaceDepth()*: return the 'depth' of a class in the class graph.
  // A class with no inherited interfaces has depth 0. We arrange so that java.lang.Object is the only such class.
  // Every other interface has a depth 1 greater than the maximum depth of any of its direct parent interfaces.
  private interfaceDepth(intf: string): number {
    if (this.interfaceDepthCache.has(intf)) {
      return this.interfaceDepthCache.get(intf);
    }

    var parents: string[] = this.classes[intf].interfaces;

    var intfDepth: number = 0;
    if (parents.length > 0) {
      var depths: number[] = _.map(parents, (parent: string) => this.interfaceDepth(parent));
      intfDepth = _.max(depths) + 1;
    }

    this.interfaceDepthCache = this.interfaceDepthCache.set(intf, intfDepth);
    return intfDepth;
  }

  // *mergeOverloadedVariants()*: Merge into a class's variants dictionary all inherited overloaded variants.
  // The algorithm intentionally overwrites any method definition with the definition from the inherited
  // interface that first declared it. The only sigificant difference between the original declaration and a later override
  // is the generic_proto field, which we render into the output .d.ts file as a comment before the method.
  private mergeOverloadedVariants(variantsDict: MethodsByNameBySignature, directInterfaces: string[]): void {
    var self = this;
    // Get the list of all inherited interfaces, ordered in descending order by interface depth.
    var interfaces: string[] = this.interfacesTransitiveClosure(directInterfaces)
      .sort((intf1: string, intf2: string): number => {
        return self.interfaceDepth(intf2) - self.interfaceDepth(intf1);
      });

    // for each method name of the class
    _.forEach(variantsDict, (methodVariants: VariantsBySignature, methodName: string) => {
      // for all inherited interfaces
      _.forEach(interfaces, (intfName: string) => {
        var intfVariantsDict: MethodsByNameBySignature = this.classes[intfName].variantsDict;
        // if the inherited interface declares any of the variants of the method
        if (_.has(intfVariantsDict, methodName)) {
          // merge all of the variants into the class's variants dictionary.
          _.assign(variantsDict[methodName], intfVariantsDict[methodName]);
        }
      });
    });
  }

  // *packageName()*: given a full class path name, return the package name.
  private packageName(className: string): string {
    var parts = className.split('.');
    parts.pop();
    return parts.join('.');
  }

  // *getWhitedListedClassesInJar()*: For the given jar, read the index, and return an array of all classes
  // from the jar that are selected by the configuration.
  private getWhitedListedClassesInJar(jarpath: string): BluePromise<Array<string>> {
    dlog('getWhitedListedClassesInJar started for:', jarpath);
    var result: Array<string> = [];
    return openAsync(jarpath, 'r')
      .then((fd: number) => {
        var reader = zip.Reader(fd);
        reader.forEach((entry: zip.Entry) => {
          if (entry) {
            var entryPath: string = entry.getName();
            if (/\.class$/.test(entryPath)) {
              var className: string = entryPath.slice(0, -'.class'.length).replace(/\//g, '.');
              if (this.inWhiteList(className)) {
                result.push(className);
              }
            }
          }
        });
      })
      .then(() => result);
  }

  // *createShortNameMap()*: Find all classes with unique class names, and create a map from name to full class name.
  // E.g. if `java.lang.String` is the only class named `String`, the map will contain {'String': 'java.lang.String'}.
  // For non-unique class names, the name is added to the map with a null value.
  private createShortNameMap(): BluePromise<void> {
    dlog('createShortNameMap started');
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
    dlog('createShortNameMap completed');
    return;
  }

  // *analyzeIncludedClasses()*: Analyze all of the classes included by the configuration, creating a ClassDefinition
  // for each class.
  private analyzeIncludedClasses(): BluePromise<void> {
    dlog('analyzeIncludedClasses started');
    var work: Work = new Work();
    this.allClasses.forEach((className: string): void => work.addTodo(className));

    work.forEach((className: string): void => {
      this.classes[className] = this.mapClass(className, work);
    });

    dlog('analyzeIncludedClasses completed');
    return;
  }

  // *loadClassCache()*: Load all classes seen in prescan, pruning any non-public classes.
  private loadClassCache(): BluePromise<void> {
    var Modifier: Java.Modifier.Static = Java.importClass('java.lang.reflect.Modifier');
    var nonPublic = Immutable.Set<string>();
    var classLoader = Java.getClassLoader();
    this.allClasses.forEach((className: string): void => {
      var clazz: Java.Class = classLoader.loadClass(className);
      var modifiers: number = clazz.getModifiers();
      var isPublic: boolean = Modifier.isPublic(modifiers);
      var isPrivate: boolean = Modifier.isPrivate(modifiers);
      var isProtected: boolean = Modifier.isProtected(modifiers);
      if (isPublic) {
        this.classCache = this.classCache.set(className, clazz);
      } else {
        nonPublic = nonPublic.add(className);
        if (isPrivate) {
          dlog('Pruning private class:', className);
        } else if (isProtected) {
          dlog('Pruning protected class:', className);
        } else {
          dlog('Pruning package-private class:', className);
        }
      }
    });
    this.allClasses = this.allClasses.subtract(nonPublic);
    return;
  }

  // *preScanAllClasses()*: scan all jars in the class path and find all classes matching our filter.
  // The result is stored in the member variable this.allClasses and returned as the function result
  private preScanAllClasses(): BluePromise<void> {
    dlog('preScanAllClasses started');
    var options = this.options;
    var result = Immutable.Set<string>();
    var promises: BluePromise<Array<string>>[] = _.map(options.classpath, (jarpath: string) => this.getWhitedListedClassesInJar(jarpath));
    return BluePromise.all(promises)
      .each((classes: Array<string>) => {
        result = result.merge(classes);
      })
      .then(() => {
        this.allClasses = result;
        dlog('preScanAllClasses completed');
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
    variantsDict: MethodsByNameBySignature;
    variants: VariantsArray;             // definitions of all methods, grouped by method name
    isEnum: boolean;                   // true for an Enum, false otherwise.
    fields: Array<FieldDefinition>;    // array of FieldDefinitions for public fields.

  }

  export interface ClassDefinitionMap {
    [index: string]: ClassDefinition;
  }

}

export = ClassesMap;
