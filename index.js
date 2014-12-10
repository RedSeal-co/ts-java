'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var fs = require('fs');
var Gremlin = require('gremlin-v3');
var mkdirp = require('mkdirp');
var Work = require('./lib/work.js');

var gremlin = new Gremlin();
var java = gremlin.java;
var Class = java.import('java.lang.Class');

function loadClass(className) {
  return java.getClassLoader().loadClassSync(className);
}

function shortClassName(className) {
  var m = className.match(/\.([\$\w]+)$/);
  assert.ok(m);
  return m[1];
}

//   'com.tinkerpop.gremlin.process.graph.GraphTraversal',
//   'com.tinkerpop.gremlin.process.graph.ElementTraversal',
//   'com.tinkerpop.gremlin.structure.Vertex',
//   'com.tinkerpop.gremlin.structure.Edge',
//   'com.tinkerpop.gremlin.process.Traversal$SideEffects'

// The set of packages and classes we are interested in. We ignore others.
var whiteList = [
  /^com\.tinkerpop\.gremlin/,
  /^java\.util\.Iterator/
];

function inWhiteList(className) {
  return _.find(whiteList, function (ns) { return className.match(ns); });
}

function mapMethod(method, work) {
  var methodMap = {
    name: method.getNameSync(),
    declared: method.getDeclaringClassSync().getNameSync(),
    returns: method.getReturnTypeSync().getNameSync(),
    params: _.map(method.getParameterTypesSync(), function (p) { return p.getNameSync(); }),
    isVarArgs: method.isVarArgsSync(),
    generic: method.toGenericStringSync(),
    string: method.toStringSync(),
  };

  methodMap.signature = methodMap.name + ':[' + methodMap.params.join() + ']';

  function addIfNotQueued(className) {
    if (inWhiteList(className)) {
      work.addTodo(className);
    }
  }

  addIfNotQueued(methodMap.declared);
  addIfNotQueued(methodMap.returns);

  return methodMap;
}

function mapClass(className, work) {
  var clazz = loadClass(className);
  assert.strictEqual(clazz.getNameSync(), className);

  var shortName = shortClassName(className);
  var methods = _.map(clazz.getMethodsSync(), function (m) { return mapMethod(m, work); });

  var interfaces = _.map(clazz.getInterfacesSync(), function (intf) { return intf.getNameSync(); });

  var classMap = {
    fullName: className,
    shortName: shortName,
    interfaces: interfaces,
    methods: methods
  };

  return classMap;
}

function processClass(className, work) {
  var classMap = mapClass(className, work);
  fs.writeFileSync('out/txt/' + classMap.shortName + '.txt', JSON.stringify(classMap, null, '  '));
  return classMap;
}

function locateMethodDefinitions(className, classes, work) {
  assert.ok(className in classes);
  var classMap = classes[className];
  assert.strictEqual(className, classMap.fullName);

  _.forEach(classMap.interfaces, function (intf) {
    if (!work.alreadyDone(intf) && intf in classes) {
      locateMethodDefinitions(intf, classes, work);
    }
  });

  console.log(className);
  work.setDone(className);
}

function main() {

  mkdirp.sync('out/txt');
  mkdirp.sync('out/lib');
  mkdirp.sync('out/test');

  var classes = {};

  var work = new Work();
  work.addTodo('com.tinkerpop.gremlin.structure.Graph');

  while (!work.isDone()) {
    var className = work.next();
    work.setDone(className);
    classes[className] = processClass(className, work);
  }

  // HACK: in TP3, some *Traversal classes are not declared to implement Traversal,
  // e.g. ElementTraversal. I believe we will want to treat these classes as if they
  // actually do implement that interface.
  var baseTraversal = 'com.tinkerpop.gremlin.process.Traversal';
  _.forOwn(classes, function (classMap, className) {
    if (className.match(/(\w+)Traversal$/)) {
      if (_.indexOf(classMap.interfaces, baseTraversal) === -1) {
        classMap.interfaces.push(baseTraversal);
        console.log('Added %s to interfaces of %s', baseTraversal, className);
      }
    }
  });

  var newWork = new Work(work.getDone());

  locateMethodDefinitions('com.tinkerpop.gremlin.process.Traversal', classes, newWork);
  while (!newWork.isDone()) {
    var className = newWork.next();
    locateMethodDefinitions(className, classes, newWork);
  }

}

main();
