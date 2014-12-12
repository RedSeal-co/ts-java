'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var Gremlin = require('gremlin-v3');
var Immutable = require('immutable');
var Work = require('./work.js');

var gremlin = new Gremlin();
var java = gremlin.java;

// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
function ClassesMap(_config) {

  var self = this;
  var config = _config || {};

  config.whitelist = config.whitelist || [];
  config.blacklist = config.blacklist || [];

  if (_.isEmpty(config.whitelist)) {
    config.whitelist = [
      /^java\.lang\.Object$/,
      /^java\.lang\.String$/,
      /^java\.lang\.CharSequence$/,
      /^java\.util\.Iterator$/,
      /^java\.util\.function\./,
      /^com\.tinkerpop\.gremlin\./
    ];
  }

  if (_.isEmpty(config.blacklist)) {
    config.blacklist = [
      /^java\.lang\.reflect\./
    ];
  }

  // *classes* is a javascript object used as a map {className: classMap}.
  // Each *className* key is a full java classname string, e.g. `'java.lang.Object'`.
  // Each *classMap* value is a javascript object that defines properties of the class, and has the form:
  // {
  //   fullName: string,         // full class name, e.g. 'java.util.Iterator'
  //   shortName: string,        // short class name, e.g. 'Iterator'
  //   interfaces: [ string ],   // an array of full names of interfacs this class inherits, e.g. [ 'java.lang.Object' ]
  //   methods: [ methodMaps ]   // an array of methodMap objects
  // }
  var classes = {};

  // *methodDefinitions* is a javascript object used as a map { methodSignature: definingInterface }
  // Each *methodSignature* key is a string containing the signature of a method.
  // Each *definingInterface* value is a string containing the full class name where the method is first defined.
  // Example { 'equals(java.lang.Object): boolean' : 'java.lang.Object' }
  var methodDefinitions = {};


  // *inWhiteList()*: Return true for classes of iterest.
  self.inWhiteList = function inWhiteList(className) {
    var result =
      _.find(config.whitelist, function (ns) { return className.match(ns); }) !== undefined &&
      _.find(config.blacklist, function (ns) { return className.match(ns); }) === undefined;
    return result;
  };


  // *shortClassName()*: Return the short class name given the full className (class path).
  self.shortClassName = function shortClassName(className) {
    if (!self.inWhiteList(className))
      throw new Error('shortClassName given bad classname:' + className);
    var m = className.match(/\.([\$\w]+)$/);
    return m[1];
  };


  // *loadClass()*: load the class and return its Class object.
  self.loadClass = function loadClass(className) {
    return java.getClassLoader().loadClassSync(className);
  };


  // *mapClassInterfaces()*: Find the direct interfaces of className.
  // Note that we later compute the transitive closure of all inherited interfaces
  self.mapClassInterfaces = function mapClassInterfaces(className, clazz, work) {
    assert.strictEqual(clazz.getNameSync(), className);
    var interfaces = _.map(clazz.getInterfacesSync(), function (intf) { return intf.getNameSync(); });
    interfaces = _.filter(interfaces, function (intf) { return self.inWhiteList(intf); }, this);

    var javaLangObject = 'java.lang.Object';
    if (interfaces.length === 0 && className !== javaLangObject)
      interfaces.push(javaLangObject);

    _.forEach(interfaces, function (intf) { work.addTodo(intf); }, this);

    return interfaces;
  };


  // *methodSignature()*: return the signature of a method, i.e. a string unique to any method variant,
  // containing method name and types of parameters.
  // Note: Java does not consider the function return type to be part of the method signature.
  self.methodSignature = function methodSignature(methodMap) {
    var signature;
    var varArgs = methodMap.isVarArgs ? '...' : '';
    if (methodMap.isVarArgs) {
      var last = _.last(methodMap.params);
      var match = /\[L(.+);/.exec(last);
      assert.ok(match, require('util').inspect(methodMap, {depth: null}));
      var finalArg = match[1] + '...';
      var params = methodMap.params.slice(0, -1);
      params.push(finalArg);
      signature = methodMap.name + '(' + params.join() + ')';
    }
    else {
      signature = methodMap.name + '(' + methodMap.params.join() + varArgs + ')';
    }
    return signature;
  };


  // *referencedInterfaces()*: return a set of all interfaces referenced by a method.
  // Thet set includes the interfaces of all parameters and the function return type.
  // Only java classes in the white list are included.
  self.referencedInterfaces = function referencedInterfaces(methodMap) {
  };

  // *mapMethod()*: return a map of useful properties of a method.
  self.mapMethod = function mapMethod(method, work) {
    var methodMap = {
      name: method.getNameSync(),
      declared: method.getDeclaringClassSync().getNameSync(),
      returns: method.getReturnTypeSync().getNameSync(),
      params: _.map(method.getParameterTypesSync(), function (p) { return p.getNameSync(); }),
      isVarArgs: method.isVarArgsSync(),
      generic: method.toGenericStringSync(),
      string: method.toStringSync(),
    };

    methodMap.signature = self.methodSignature(methodMap);

//     methodMap.referenced = self.referencedInterfaces(methodMap);

    function addToTheToDoList(canonicalTypeName) {
      // We expect various type names here, 4 general categories:
      // 1) primitive types such as int, long, char
      // 2) arrays of primitive types, such as int[]
      // 3) class names such as java.util.Iterator
      // 4) array-of-class names such as java.util.Iterator[]
      // We only add to the todo list for the last two, and only in the non-array form.
      var match = /(.*)\[\]/.exec(canonicalTypeName);
      if (match)
        canonicalTypeName = match[1];
      if (self.inWhiteList(canonicalTypeName)) {
        if (!work.alreadyAdded(canonicalTypeName)) {
//           console.log('Adding:', canonicalTypeName);
          work.addTodo(canonicalTypeName);
        }
      }
    }

    addToTheToDoList(methodMap.declared);
    addToTheToDoList(methodMap.returns);

    return methodMap;
  };


  // *mapClassMethods()*: return a methodMap array for the methods of a class
  self.mapClassMethods = function mapClassMethods(className, clazz, work) {
    return _.map(clazz.getMethodsSync(), function (m) { return self.mapMethod(m, work); }, this);
  };


  // *mapClass()*: return a map of all useful properties of a class.
  self.mapClass = function mapClass(className, work) {
    var clazz = self.loadClass(className);

    var interfaces = self.mapClassInterfaces(className, clazz, work);
    var methods = self.mapClassMethods(className, clazz, work);

    var classMap = {
      fullName: className,
      shortName: self.shortClassName(className),
      interfaces: interfaces,
      methods: methods
    };

    return classMap;
  };


  // *loadAllClasses()*: load and map all classes of interest
  self.loadAllClasses = function loadAllClasses(seedClasses) {
    var work = new Work(seedClasses);

    while (!work.isDone()) {
      var className = work.next();
      work.setDone(className);
      classes[className] = self.mapClass(className, work);
    }

    return work;
  };


  // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
  self.getClasses = function getClasses() {
    return classes;
  };


  // *_interfacesClosure()*: extend interfaces to the transitive closure of all inherited interfaces.
  self._interfacesClosure = function _interfacesClosure(className, work) {
    assert.ok(!work.alreadyDone(className));
    var transitiveClosure = Immutable.Set(classes[className].interfaces);

    var maxdepth = 0;
    _.forEach(classes[className].interfaces, function (intf) {
      if (!work.alreadyDone(intf))
        _interfacesClosure(intf, work);
      assert.ok(work.alreadyDone(intf));
      assert.number(classes[intf].depth);
      if (maxdepth < classes[intf].depth)
        maxdepth = classes[intf].depth;
      transitiveClosure = transitiveClosure.union(classes[intf].interfaces);
    });

    function byDepth(a, b) {
      var result = classes[a].depth - classes[b].depth;
      if (result === 0) {
        // for tiebreaker, arrange for java.* to sort before com.*
        result = classes[b].fullName.localeCompare(classes[a].fullName);
      }
      return result;
    }

  //   console.log('For class %s, before %j, after %j:', className, classes[className].interfaces, transitiveClosure);
    classes[className].interfaces = transitiveClosure.toArray().sort(byDepth);
    classes[className].depth = maxdepth+1;
    work.setDone(className);
  };


  // *transitiveClosureInterfaces()*: compute the _interfacesClosure for all classes.
  self.transitiveClosureInterfaces = function transitiveClosureInterfaces() {
    var work = new Work(_.keys(classes));

    while (!work.isDone()) {
      var className = work.next();
      self._interfacesClosure(className, work);
    }
  };


  // *_locateMethodDefinitions()*: find where each method of className was first defined.
  // Private method for use by *mapMethodDefinitions()*.
  // This method will resursively call itself for all inherited interfaces
  // before it locates the methods of this class.
  self._locateMethodDefinitions = function _locateMethodDefinitions(className, work) {
    assert.object(methodDefinitions);

    assert.ok(className in classes);
    var classMap = classes[className];
    assert.strictEqual(className, classMap.fullName);

    _.forEach(classMap.interfaces, function (intf) {
      if (!work.alreadyDone(intf)) {
        assert.ok(intf in classes, 'Unknown interface:' + intf);
        _locateMethodDefinitions(intf, work);
      }
    });

    _.forEach(classMap.methods, function (method, index) {
      assert.string(method.signature);
      var definedHere = false;
      if (!(method.signature in methodDefinitions)) {
        if (!(method.signature in classMap.interfaces)) {
          definedHere = true;
          methodDefinitions[method.signature] = className;
          if (method.declared !== className) {
            console.log('Method %s located in %s but declared in %s', method.signature, className, method.declared);
          }
        }
      }
      classMap.methods[index].definedHere = definedHere;
    });

    work.setDone(className);
  };


  // *mapMethodDefinitions()*: Create a map of all methods. Keys are method signatures, values are class names.
  self.mapMethodDefinitions = function mapMethodDefinitions() {
    var work = new Work(_.keys(classes));
    while (!work.isDone()) {
      var className = work.next();
      self._locateMethodDefinitions(className, work);
    }
    return methodDefinitions;
  };


  // *getMethodDefinitions()*: return the map of all original method definitions.
  self.getMethodDefinitions = function getMethodDefinitions() {
    return methodDefinitions;
  };


  // *initialize()*: fully initialize from seedClasses.
  self.initialize = function initialize(seedClasses) {
    self.loadAllClasses(seedClasses);
    self.transitiveClosureInterfaces();
    self.mapMethodDefinitions();
  };

}

module.exports = ClassesMap;
