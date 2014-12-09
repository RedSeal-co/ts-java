'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var fs = require('fs');
var Gremlin = require('gremlin-v3');
var Immutable = require('immutable');
var mkdirp = require('mkdirp');

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

var done = Immutable.Set();
var todo = Immutable.Set([
  'com.tinkerpop.gremlin.structure.Graph'
]);

//   'com.tinkerpop.gremlin.process.graph.GraphTraversal',
//   'com.tinkerpop.gremlin.process.graph.ElementTraversal',
//   'com.tinkerpop.gremlin.structure.Vertex',
//   'com.tinkerpop.gremlin.structure.Edge',
//   'com.tinkerpop.gremlin.process.Traversal$SideEffects'

var classes = {};

function mapMethod(method) {
  var methodMap = {
    name: method.getNameSync(),
    declared: method.getDeclaringClassSync().getNameSync(),
    returns: method.getReturnTypeSync().getNameSync(),
    params: _.map(method.getParameterTypesSync(), function (p) { return p.getNameSync(); }),
    isVarArgs: method.isVarArgsSync(),
    generic: method.toGenericStringSync(),
    string: method.toStringSync(),
  };

  function addIfNotQueued(className) {
    if (className.match(/^com.tinkerpop.gremlin/)) {
      if (!done.has(className) && !todo.has(className))
        todo = todo.add(className);
    }
  }

  addIfNotQueued(methodMap.declared);
  addIfNotQueued(methodMap.returns);

  return methodMap;
}

function mapClass(className) {
  var clazz = loadClass(className);
  assert.strictEqual(clazz.getNameSync(), className);

  var shortName = shortClassName(className);
  var methods = _.map(clazz.getMethodsSync(), mapMethod);

  var classMap = {
    fullName: className,
    shortName: shortName,
    methods: methods
  };

  return classMap;
}

function processClass(className) {
  var classMap = mapClass(className);
  var methods = classMap.methods;
  var shortName = classMap.shortName;

  var definedMethods = _.filter(methods, function (m) { return m.declared === className; });
  var inheritedMethods = _.filter(methods, function (m) { return m.declared !== className; });
  fs.writeFileSync('out/txt/' + shortName + '.defined.txt', JSON.stringify(definedMethods, null, '  '));
  fs.writeFileSync('out/txt/' + shortName + '.inherited.txt', JSON.stringify(inheritedMethods, null, '  '));
}

function main() {

  mkdirp.sync('out/txt');
  mkdirp.sync('out/lib');
  mkdirp.sync('out/test');

  while (todo.size > 0) {
    var className = todo.first();
    todo = todo.remove(className);
    done = done.add(className);
    processClass(className);
  }

  console.log(done);
}

main();
