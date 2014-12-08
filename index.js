'use strict';

var _ = require('lodash');
var Gremlin = require('gremlin-v3');
var assert = require('assert');
var fs = require('fs');

var gremlin = new Gremlin();
var java = gremlin.java;
var Class = java.import('java.lang.Class');

function loadClass(className) {
  return java.getClassLoader().loadClassSync(className);
}

function mapMethod(method) {
  return {
    name: method.getNameSync(),
    declared: method.getDeclaringClassSync().getNameSync(),
    returns: method.getReturnTypeSync().getNameSync(),
    params: _.map(method.getParameterTypesSync(), function (p) { return p.getNameSync(); }),
    isVarArgs: method.isVarArgsSync(),
    generic: method.toGenericStringSync(),
    string: method.toStringSync(),
  };
}

function processClass(className) {
  var clazz = loadClass(className);
  var methods = _.map(clazz.getMethodsSync(), mapMethod);
  fs.writeFileSync('out/' + className + '.txt', JSON.stringify(methods, null, '  '));
}

processClass('com.tinkerpop.gremlin.process.graph.GraphTraversal');
processClass('com.tinkerpop.gremlin.process.graph.ElementTraversal');
processClass('com.tinkerpop.gremlin.structure.Vertex');
processClass('com.tinkerpop.gremlin.structure.Edge');
processClass('com.tinkerpop.gremlin.structure.Graph');
