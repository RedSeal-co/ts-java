/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./java.d.ts' />

'use strict';

import _ = require('lodash');
import assert = require('assert');
import Immutable = require('immutable');
import Work = require('./work');

var requiredSeedClasses = [
  'java.lang.Class',
  'java.lang.Cloneable',
  'java.lang.Comparable',
  'java.lang.Enum',
  'java.lang.Iterable',
  'java.lang.Long',
  'java.lang.Number',
  'java.lang.Object',
];

var mustExcludeClasses = [
  // Node java automatically coerces string to java.lang.String for input parameters,
  // and does the reverse for return results, so we never need to use the java.lang.String class.
  // Note that tsTypeName treats java.lang.String as a primitive type mapped to string.
  'java.lang.String'
  // TODO: are there other classes we should do this with?
];

import ClassDefinition = ClassesMap.ClassDefinition;
import ClassDefinitionMap = ClassesMap.ClassDefinitionMap;
import MethodDefinition = ClassesMap.MethodDefinition;
import VariantsMap = ClassesMap.VariantsMap;

// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
class ClassesMap {

  private java: Java.Singleton;
  private classes: ClassDefinitionMap;
  private methodOriginations: Immutable.Map<string, string>;
  private includedPatterns: Immutable.Set<RegExp>;
  private excludedPatterns: Immutable.Set<RegExp>;

  constructor(java: Java.Singleton,
              includedPatterns: Immutable.Set<RegExp>,
              excludedPatterns?: Immutable.Set<RegExp>) {
    this.java = java;
    this.classes = {};
    this.methodOriginations = Immutable.Map<string, string>();

    assert.ok(includedPatterns);
    assert.ok(includedPatterns instanceof Immutable.Set);
    this.includedPatterns = includedPatterns;
    this.excludedPatterns = excludedPatterns ? excludedPatterns : Immutable.Set<RegExp>();

    var requiredPatterns = _.map(requiredSeedClasses, (s: string) => {
      var pattern = '^' + s.replace(/\./g, '\\.') + '$';
      return new RegExp(pattern);
    });
    this.includedPatterns = this.includedPatterns.merge(requiredPatterns);

    var excludedPats = _.map(mustExcludeClasses, (s: string) => {
      var pattern = '^' + s.replace(/\./g, '\\.') + '$';
      return new RegExp(pattern);
    });
    this.excludedPatterns = this.excludedPatterns.merge(excludedPats);
  }

  // *inWhiteList()*: Return true for classes of iterest.
  inWhiteList(className: string): boolean {
    var result =
      this.includedPatterns.find((ns: RegExp) => { return className.match(ns) !== null; }) !== undefined &&
      this.excludedPatterns.find((ns: RegExp) => { return className.match(ns) !== null; }) === undefined;
    return result;
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
  mapClassInterfaces(className: string, clazz: Java.Class, work: Work) : Array<string>{
    assert.strictEqual(clazz.getNameSync(), className);
    var interfaces = _.map(clazz.getInterfacesSync(), (intf: Java.Class) => { return intf.getNameSync(); });
    interfaces = _.filter(interfaces, (intf: string) => { return this.inWhiteList(intf); });

    var javaLangObject = 'java.lang.Object';
    if (interfaces.length === 0 && className !== javaLangObject) {
      interfaces.push(javaLangObject);
    }

    _.forEach(interfaces, (intf: string) => { work.addTodo(intf); });

    return interfaces;
  }

  // *typeEncoding()*: return the JNI encoding string for a java class
  typeEncoding(clazz: Java.Class): string {
    var name = clazz.getNameSync();
    var primitives = {
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


  // *methodSignature()*: return the signature of a method, i.e. a string unique to any method variant,
  // encoding the method name, types of parameters, and the return type.
  // This string may be passed as the method name to java.callMethod() in order to execute a specific variant.
  methodSignature(method: Java.Method): string {
    var name = method.getNameSync();
    var paramTypes = method.getParameterTypesSync();
    var sigs = paramTypes.map((p: Java.Class) => { return this.typeEncoding(p); });
    return name + '(' + sigs.join('') + ')' + this.typeEncoding(method.getReturnTypeSync());
  }


  tsTypeName(javaTypeName: string): string {
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

    var primitiveTypes = {
      B: 'number', // byte. What does node-java do with byte arrays?
      C: 'string', // char. What does node-java do with char arrays?
      D: 'number', // double
      F: 'number', // float
      I: 'number', // int
      J: 'number', // long
      S: 'number', // short
      Z: 'boolean',
      boolean: 'boolean',
      byte: 'number',
      char: 'string',
      double: 'number',
      float: 'number',
      int: 'number',
      long: 'number',
      short: 'number',
      void: 'void',
      'java.lang.String': 'string'
    };
    if (typeName in primitiveTypes) {
      return primitiveTypes[typeName] + ext;
    }

    if (this.inWhiteList(typeName)) {
      var shortName = this.shortClassName(typeName);
      return shortName + ext;
    } else {
      return 'any' + ext;
    }
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


  // *mapMethod()*: return a map of useful properties of a method.
  mapMethod(method: Java.Method, work: Work): MethodDefinition {

    var signature = this.methodSignature(method);

    var methodMap: MethodDefinition = {
      name: method.getNameSync(),
      declared: method.getDeclaringClassSync().getNameSync(),
      returns: method.getReturnTypeSync().getNameSync(),
      tsReturns: this.tsTypeName(method.getReturnTypeSync().getNameSync()),
      paramNames: _.map(method.getParametersSync(), (p: Java.Parameter) => { return p.getNameSync(); }),
      paramTypes: _.map(method.getParameterTypesSync(), (p: Java.Class) => { return p.getNameSync(); }),
      tsParamTypes: _.map(method.getParameterTypesSync(), (p: Java.Class) => { return this.tsTypeName(p.getNameSync()); }),
      isVarArgs: method.isVarArgsSync(),
      generic_proto: method.toGenericStringSync(),
      plain_proto: method.toStringSync(),
      signature: signature
    };

    var addToTheToDoList = (canonicalTypeName: string) => {
      // We expect various type names here, 4 general categories:
      // 1) primitive types such as int, long, char
      // 2) arrays of primitive types, such as int[]
      // 3) class names such as java.util.Iterator
      // 4) array-of-class names such as java.util.Iterator[]
      // We only add to the todo list for the last two, and only in the non-array form.
      var parts: [string, string] = this.baseType(canonicalTypeName);
      canonicalTypeName = parts[0];
      if (this.inWhiteList(canonicalTypeName)) {
        if (!work.alreadyAdded(canonicalTypeName)) {
//           console.log('Adding:', canonicalTypeName);
          work.addTodo(canonicalTypeName);
        }
      } else {
//         console.log('Not in white list:', canonicalTypeName);
      }
    };

    addToTheToDoList(methodMap.declared);
    addToTheToDoList(methodMap.returns);
    _.forEach(methodMap.paramTypes, (p: string) => {
      addToTheToDoList(p);
    });

    return methodMap;
  }


  // *mapClassMethods()*: return a methodMap array for the methods of a class
  mapClassMethods(className: string, clazz: Java.Class, work: Work): Array<MethodDefinition> {
    return _.map(clazz.getMethodsSync(), function (m: Java.Method) { return this.mapMethod(m, work); }, this);
  }

  // *groupMethods()*: group overloaded methods (i.e. having the same name)
  groupMethods(flatList: Array<MethodDefinition>): VariantsMap {
    function compareVariants(a: MethodDefinition, b: MethodDefinition) {
      // We want variants with more parameters to come first.
      if (a.paramTypes.length > b.paramTypes.length) {
        return -1;
      } else if (a.paramTypes.length < b.paramTypes.length) {
        return 1;
      }
      // For the same number of parameters, order the longer (presumably more complex) signature to be first
      if (a.signature.length > b.signature.length) {
        return -1;
      } else if (a.signature.length < b.signature.length) {
        return 1;
      }
      // As a final catch-all, just sort lexically by signature.
      return b.signature.localeCompare(a.signature);
    }

    var variantsMap = _.groupBy(flatList, (method: MethodDefinition) => { return method.name; });
    _.forEach(variantsMap, (variants: Array<MethodDefinition>, name: string) => {
      variantsMap[name] = variants.sort(compareVariants);
    });

    return variantsMap;
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

    var isInterface = clazz.isInterfaceSync();
    var isPrimitive = clazz.isPrimitiveSync();
    var superclass: Java.Class = clazz.getSuperclassSync();

    function bySignature(a: MethodDefinition, b: MethodDefinition) {
      return a.signature.localeCompare(b.signature);
    }

    var classMap: ClassDefinition = {
      packageName: this.packageName(this.fixClassPath(className)),
      fullName: className,
      shortName: this.shortClassName(className),
      isInterface: isInterface,
      isPrimitive: isPrimitive,
      superclass: superclass === null ? null : superclass.getNameSync(),
      interfaces: interfaces,
      methods: methods.sort(bySignature),
      variants: this.groupMethods(methods)
    };

    return classMap;
  }


  // *loadAllClasses()*: load and map all classes of interest
  loadAllClasses(seedClasses: Array<string>): Work {
    var work = new Work(seedClasses);

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


  // *_interfacesClosure()*: extend interfaces to the transitive closure of all inherited interfaces.
  _interfacesClosure(className: string, work: Work): void {
    assert.ok(!work.alreadyDone(className));
    var transitiveClosure = Immutable.Set(this.classes[className].interfaces);

    var maxdepth = 0;
    _.forEach(this.classes[className].interfaces, (intf: string) => {
      if (!work.alreadyDone(intf)) {
        this._interfacesClosure(intf, work);
      }
      assert.ok(work.alreadyDone(intf));
      assert.ok(typeof this.classes[intf].depth === 'number');
      if (maxdepth < this.classes[intf].depth) {
        maxdepth = this.classes[intf].depth;
      }
      transitiveClosure = transitiveClosure.union(this.classes[intf].interfaces);
    });

    var byDepth = (a: string, b: string) => {
      var result = this.classes[a].depth - this.classes[b].depth;
      if (result === 0) {
        // for tiebreaker, arrange for java.* to sort before com.*
        result = this.classes[b].fullName.localeCompare(this.classes[a].fullName);
      }
      return result;
    };

    this.classes[className].interfaces = transitiveClosure.toArray().sort(byDepth);
    this.classes[className].depth = maxdepth + 1;
    work.setDone(className);
  }


  // *transitiveClosureInterfaces()*: compute the _interfacesClosure for all classes.
  transitiveClosureInterfaces(): void {
    var work = new Work(_.keys(this.classes));

    while (!work.isDone()) {
      var className = work.next();
      this._interfacesClosure(className, work);
    }
  }


  // *_locateMethodOriginations()*: find where each method of className was first defined.
  // Private method for use by *mapMethodOriginations()*.
  // This method will resursively call itself for all inherited interfaces
  // before it locates the methods of this class.
  _locateMethodOriginations(className: string, work: Work): void {
    assert.ok(className in this.classes);
    var classMap: ClassDefinition = this.classes[className];
    assert.strictEqual(className, classMap.fullName);

    _.forEach(classMap.interfaces, (intf: string) => {
      if (!work.alreadyDone(intf)) {
        assert.ok(intf in this.classes, 'Unknown interface:' + intf);
        this._locateMethodOriginations(intf, work);
      }
    });

    _.forEach(classMap.methods, (method: MethodDefinition, index: number) => {
      assert.ok(typeof method.signature === 'string');
      var definedHere = false;
      if (!(this.methodOriginations.has(method.signature))) {
        if (!(method.signature in classMap.interfaces)) {
          definedHere = true;
          this.methodOriginations = this.methodOriginations.set(method.signature, className);
          if (method.declared !== className) {
            console.log('Method %s located in %s but declared in %s', method.signature, className, method.declared);
          }
        }
      }
      classMap.methods[index].definedHere = definedHere;
    });

    work.setDone(className);
  }


  // *mapMethodOriginations()*: Create a map of all methods. Keys are method signatures, values are class names.
  mapMethodOriginations(): Immutable.Map<string, string> {
    var work = new Work(_.keys(this.classes));
    while (!work.isDone()) {
      var className = work.next();
      this._locateMethodOriginations(className, work);
    }
    return this.methodOriginations;
  }


  // *getMethodOriginations()*: return the map of all original method definitions.
  getMethodOriginations(): Immutable.Map<string, string> {
    return this.methodOriginations;
  }


  // *initialize()*: fully initialize from seedClasses.
  initialize(seedClasses: Array<string>) {
    this.loadAllClasses(seedClasses);
    this.transitiveClosureInterfaces();
    this.mapMethodOriginations();
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
    isVarArgs: boolean;     // true if this method's last parameter is varargs ...type
    generic_proto: string;  // The method prototype including generic type information
    plain_proto: string;    // The java method prototype without generic type information
    definedHere?: boolean;  // True if this method is first defined in this class
    signature?: string;     // A method signature related to the plain_proto prototype above
                            // This signature does not include return type info, as java does not
                            // use return type to distinguish among overloaded methods.
  }

  // ### VariantsMap
  // A map of method name to list of overloaded method variants
  export interface VariantsMap {
      [index: string]: Array<MethodDefinition>;
  }

  // ### ClassDefinition
  // All of the properties on interest for a class.
  export interface ClassDefinition {
    packageName: string;               // 'java.util'
    fullName: string;                  // 'java.util.Iterator'
    shortName: string;                 // 'Iterator'
    isInterface: boolean;              // true if this is an interface, false for class or primitive type.
    isPrimitive: boolean;              // true for a primitive type, false otherwise.
    superclass: string;                // null if no superclass, otherwise class name
    interfaces: Array<string>;         // [ 'java.lang.Object' ]
    methods: Array<MethodDefinition>; // definitions of all methods implemented by this class
    variants: VariantsMap;            // definitions of all methods, grouped by method name
    depth?: number;                    // distance from the root of the class inheritance tree
  }

  export interface ClassDefinitionMap {
    [index: string]: ClassDefinition;
  }

}

export = ClassesMap;
