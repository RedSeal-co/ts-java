/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./java.d.ts' />

'use strict';

import _ = require('lodash');
import assert = require('assert');
import Immutable = require('immutable');
import Work = require('./work');

// ### IMethodDefinition
// All of the properties on interest for a method.
export interface IMethodDefinition {
  name: string;           // name of method, e.g. 'forEachRemaining'
  declared: string;       // interface where first declared: 'java.util.Iterator'
  returns: string;        // return type, e.g. 'void', 'int', of class name
  params: Array<string>;  // [ 'java.util.function.Consumer' ],
  paramNames: Array<string>;  // [ 'arg0' ],
  isVarArgs: boolean;     // true if this method's last parameter is varargs ...type
  generic_proto: string;  // The method prototype including generic type information
  plain_proto: string;    // The java method prototype without generic type information
  definedHere?: boolean;  // True if this method is first defined in this class
  signature?: string;     // A method signature related to the plain_proto prototype above
                          // This signature does not include return type info, as java does not
                          // use return type to distinguish among overloaded methods.
}

// ### IClassDefinition
// All of the properties on interest for a class.
export interface IClassDefinition {
  fullName: string;                  // 'java.util.Iterator'
  shortName: string;                 // 'Iterator'
  interfaces: Array<string>;         // [ 'java.lang.Object' ]
  methods: Array<IMethodDefinition>; // definitions of all methods implemented by this class
  depth?: number;                    // distance from the root of the class inheritance tree
}

export interface IClassDefinitionMap {
  [index: string]: IClassDefinition;
}

var requiredSeedClasses = [
  'java.lang.Long',
  'java.lang.Number',
  'java.lang.Object',
  'java.lang.String',
  'java.lang.CharSequence',
];

// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
export class ClassesMap {

  private java: Java.Instance;
  private classes: IClassDefinitionMap;
  private methodOriginations: Immutable.Map<string, string>;
  private includedPatterns: Immutable.Set<RegExp>;
  private excludedPatterns: Immutable.Set<RegExp>;

  constructor(java: Java.Instance,
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
    if (!this.inWhiteList(className)) {
      throw new Error('shortClassName given bad classname:' + className);
    }
    var m = className.match(/\.([\$\w]+)(\[\])?$/);
    if (!m) {
      throw new Error('shortClassName given bad classname:' + className);
    }
    return m[1];
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


  // *methodSignature()*: return the signature of a method, i.e. a string unique to any method variant,
  // containing method name and types of parameters.
  // Note: Java does not consider the function return type to be part of the method signature.
  methodSignature(methodMap: IMethodDefinition): string {
    var signature;
    var varArgs = methodMap.isVarArgs ? '...' : '';
    if (methodMap.isVarArgs) {
      var last = _.last(methodMap.params);
      var match = /(.+)\[\]$/.exec(last);
      assert.ok(match, require('util').inspect(methodMap, {depth: null}));
      var finalArg = match[1] + '...';
      var params = methodMap.params.slice(0, -1);
      params.push(finalArg);
      signature = methodMap.name + '(' + params.join() + ')';
    } else {
      signature = methodMap.name + '(' + methodMap.params.join() + varArgs + ')';
    }
    return signature;
  }


  // *mapMethod()*: return a map of useful properties of a method.
  mapMethod(method: Java.Method, work: Work): IMethodDefinition {
    var methodMap: IMethodDefinition = {
      name: method.getNameSync(),
      declared: method.getDeclaringClassSync().getNameSync(),
      returns: method.getReturnTypeSync().getNameSync(),
      params: _.map(method.getParameterTypesSync(), function (p: Java.Class) { return p.getTypeNameSync(); }),
      paramNames: _.map(method.getParametersSync(), function (p: Java.Parameter) { return p.getNameSync(); }),
      isVarArgs: method.isVarArgsSync(),
      generic_proto: method.toGenericStringSync(),
      plain_proto: method.toStringSync()
    };

    methodMap.signature = this.methodSignature(methodMap);

    var addToTheToDoList = (canonicalTypeName: string) => {
      // We expect various type names here, 4 general categories:
      // 1) primitive types such as int, long, char
      // 2) arrays of primitive types, such as int[]
      // 3) class names such as java.util.Iterator
      // 4) array-of-class names such as java.util.Iterator[]
      // We only add to the todo list for the last two, and only in the non-array form.
      var match = /(.*)\[\]/.exec(canonicalTypeName);
      if (match) {
        canonicalTypeName = match[1];
      }
      if (this.inWhiteList(canonicalTypeName)) {
        if (!work.alreadyAdded(canonicalTypeName)) {
//           console.log('Adding:', canonicalTypeName);
          work.addTodo(canonicalTypeName);
        }
      }
    };

    addToTheToDoList(methodMap.declared);
    addToTheToDoList(methodMap.returns);

    return methodMap;
  }


  // *mapClassMethods()*: return a methodMap array for the methods of a class
  mapClassMethods(className: string, clazz: Java.Class, work: Work): Array<IMethodDefinition> {
    return _.map(clazz.getMethodsSync(), function (m: Java.Method) { return this.mapMethod(m, work); }, this);
  }


  // *mapClass()*: return a map of all useful properties of a class.
  mapClass(className: string, work: Work): IClassDefinition {
    var clazz: Java.Class = this.loadClass(className);

    var interfaces = this.mapClassInterfaces(className, clazz, work);
    var methods  = this.mapClassMethods(className, clazz, work);

    function bySignature(a: IMethodDefinition, b: IMethodDefinition) {
      return a.signature.localeCompare(b.signature);
    }

    var classMap: IClassDefinition = {
      fullName: className,
      shortName: this.shortClassName(className),
      interfaces: interfaces,
      methods: methods.sort(bySignature)
    };

    return classMap;
  }


  // *loadAllClasses()*: load and map all classes of interest
  loadAllClasses(seedClasses: Array<string>): Work {
    var work = new Work(seedClasses);

    work.addTodo('java.lang.Long');
    work.addTodo('java.lang.Number');
    work.addTodo('java.lang.String');

    while (!work.isDone()) {
      var className = work.next();
      work.setDone(className);
      this.classes[className] = this.mapClass(className, work);
    }

    return work;
  }


  // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
  getClasses(): IClassDefinitionMap {
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
    var classMap: IClassDefinition = this.classes[className];
    assert.strictEqual(className, classMap.fullName);

    _.forEach(classMap.interfaces, (intf: string) => {
      if (!work.alreadyDone(intf)) {
        assert.ok(intf in this.classes, 'Unknown interface:' + intf);
        this._locateMethodOriginations(intf, work);
      }
    });

    _.forEach(classMap.methods, (method: IMethodDefinition, index: number) => {
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
