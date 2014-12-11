'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var Gremlin = require('gremlin-v3');
var Immutable = require('immutable');
var Work = require('./work.js');

var gremlin = new Gremlin();
var java = gremlin.java;

function ClassesMap(_config) {

  var config = _config || {};
  var classes = {};
  var methodDefinitions = {};
  this.java = java;

  config.whitelist = config.whitelist || [];

  if (_.isEmpty(config.whitelist)) {
    config.whitelist = [
      /^com\.tinkerpop\.gremlin\./,
      /^java\.util\.Iterator$/,
      /^java\.lang\.Object$/
    ];
  }


  // *inWhiteList()*: Return true for classes of iterest.
  this.inWhiteList = function inWhiteList(className) {
    return _.find(config.whitelist, function (ns) { return className.match(ns); }) !== undefined;
  };


  // *shortClassName()*: Return the short class name given the full className (class path).
  this.shortClassName = function shortClassName(className) {
    if (!this.inWhiteList(className))
      throw new Error('shortClassName given bad classname:' + className);
    var m = className.match(/\.([\$\w]+)$/);
    return m[1];
  };


  // *loadClass()*: load the class and return its Class object.
  this.loadClass = function loadClass(className) {
    return java.getClassLoader().loadClassSync(className);
  };


  // *mapClassInterfaces()*: Find the direct interfaces of className.
  // Note that we later compute the transitive closure of all inherited interfaces
  this.mapClassInterfaces = function mapClassInterfaces(className, clazz, work) {
    assert.strictEqual(clazz.getNameSync(), className);
    var interfaces = _.map(clazz.getInterfacesSync(), function (intf) { return intf.getNameSync(); });
    interfaces = _.filter(interfaces, function (intf) { return this.inWhiteList(intf); }, this);

    var javaLangObject = 'java.lang.Object';
    if (interfaces.length === 0 && className !== javaLangObject)
      interfaces.push(javaLangObject);

    _.forEach(interfaces, function (intf) { work.addTodo(intf); }, this);

    return interfaces;
  };


  // *mapMethod()*: return a map of useful properties of a method.
  this.mapMethod = function mapMethod(method, work) {
    var methodMap = {
      name: method.getNameSync(),
      declared: method.getDeclaringClassSync().getNameSync(),
      returns: method.getReturnTypeSync().getNameSync(),
      params: _.map(method.getParameterTypesSync(), function (p) { return p.getNameSync(); }),
      isVarArgs: method.isVarArgsSync(),
      generic: method.toGenericStringSync(),
      string: method.toStringSync(),
    };

    var varArgs = methodMap.isVarArgs ? '...' : '';
    if (methodMap.isVarArgs) {
      var last = _.last(methodMap.params);
      var match = /\[L(.+);/.exec(last);
      assert.ok(match);
      var finalArg = match[1] + '...';
      var params = methodMap.params.slice(0, -1);
      params.push(finalArg);
      methodMap.signature = methodMap.name + '(' + params.join() + '): ' + methodMap.returns;
    }
    else {
      methodMap.signature = methodMap.name + '(' + methodMap.params.join() + varArgs + '): ' + methodMap.returns;
    }

    if (this.inWhiteList(methodMap.declared))
      work.addTodo(methodMap.declared);
    if (this.inWhiteList(methodMap.returns))
      work.addTodo(methodMap.returns);

    return methodMap;
  };


  // *mapClassMethods()*: return a methodMap array for the methods of a class
  this.mapClassMethods = function mapClassMethods(className, clazz, work) {
    return _.map(clazz.getMethodsSync(), function (m) { return this.mapMethod(m, work); }, this);
  };


  // *mapClass()*: return a map of all useful properties of a class.
  this.mapClass = function mapClass(className, work) {
    var clazz = this.loadClass(className);

    var interfaces = this.mapClassInterfaces(className, clazz, work);
    var methods = this.mapClassMethods(className, clazz, work);

    var classMap = {
      fullName: className,
      shortName: this.shortClassName(className),
      interfaces: interfaces,
      methods: methods
    };

    return classMap;
  };


  // *loadAllClasses()*: load and map all classes of interest
  this.loadAllClasses = function loadAllClasses(seedClasses) {
    var work = new Work(seedClasses);

    while (!work.isDone()) {
      var className = work.next();
      work.setDone(className);
      classes[className] = this.mapClass(className, work);
    }

    return work;
  };


  // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
  this.getClasses = function getClasses() {
    return classes;
  };


  // *_interfacesClosure()*: extend interfaces to the transitive closure of all inherited interfaces.
  this._interfacesClosure = function _interfacesClosure(className, work) {
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
  this.transitiveClosureInterfaces = function transitiveClosureInterfaces() {
    var work = new Work(_.keys(classes));

    while (!work.isDone()) {
      var className = work.next();
      this._interfacesClosure(className, work);
    }
  };


  // *_locateMethodDefinitions()*: find where each method of className was first defined.
  // Private method for use by *mapMethodDefinitions()*.
  // This method will resursively call itself for all inherited interfaces
  // before it locates the methods of this class.
  this._locateMethodDefinitions = function _locateMethodDefinitions(className, work) {
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
  this.mapMethodDefinitions = function mapMethodDefinitions() {
    var work = new Work(_.keys(classes));
    while (!work.isDone()) {
      var className = work.next();
      this._locateMethodDefinitions(className, work);
    }
    return methodDefinitions;
  };


  // *getMethodDefinitions()*: return the map of all original method definitions.
  this.getMethodDefinitions = function getMethodDefinitions() {
    return methodDefinitions;
  };
}

module.exports = ClassesMap;
