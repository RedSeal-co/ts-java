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

var Promise = require("bluebird");
Promise.longStackTraces();

function loadClass(className) {
  return java.getClassLoader().loadClassSync(className);
}

function shortClassName(className) {
  var m = className.match(/\.([\$\w]+)$/);
  assert.ok(m);
  return m[1];
}

// The set of packages and classes we are interested in. We ignore others.
var whiteList = [
  /^com\.tinkerpop\.gremlin/,
  /^java\.util\.Iterator/,
  /^java\.lang\.Object/
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

  var varArgs = methodMap.isVarArgs ? '...' : '';
  if (methodMap.isVarArgs) {
    var last = _.last(methodMap.params);
    var match = /\[L(.+);/.exec(last);
    assert.ok(match);
    var finalArg = match[1] + '...';
    var params = methodMap.params.slice(0, -1);
    params.push(finalArg);
    methodMap.signature = methodMap.name + '(' + params.join() + ')';
  }
  else {
    methodMap.signature = methodMap.name + '(' + methodMap.params.join() + varArgs + ')';
  }


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

  var javaLangObject = 'java.lang.Object';
  if (className !== javaLangObject)
    interfaces.push(javaLangObject);

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

function locateMethodDefinitions(className, classes, work, methodsDefinitions) {
  assert.object(methodsDefinitions);

  assert.ok(className in classes);
  var classMap = classes[className];
  assert.strictEqual(className, classMap.fullName);

  _.forEach(classMap.interfaces, function (intf) {
    if (!work.alreadyDone(intf) && intf in classes) {
      locateMethodDefinitions(intf, classes, work, methodsDefinitions);
    }
  });

  _.forEach(classMap.methods, function (method, index) {
    assert.string(method.signature);
    var definedHere = false;
    if (!(method.signature in methodsDefinitions)) {
      if (!(method.signature in classMap.interfaces)) {
        definedHere = true;
        methodsDefinitions[method.signature] = className;
        if (method.declared !== className) {
          console.log('Method %s located in %s but declared in %s', method.signature, className, method.declared);
        }
      }
    }
    classMap.methods[index].definedHere = definedHere;
  });

  console.log(className);
  work.setDone(className);
}

function loadAllClasses() {
  var classes = {};
  var work = new Work();
  work.addTodo('java.lang.Object');
  work.addTodo('com.tinkerpop.gremlin.structure.Graph');

  while (!work.isDone()) {
    var className = work.next();
    work.setDone(className);
    classes[className] = processClass(className, work);
  }
  return classes;
}

function hackTraversalInterfaces(classes) {
  // HACK: in TP3, some *Traversal classes are not declared to implement Traversal,
  // e.g. ElementTraversal. I believe we will want to treat these classes as if they
  // actually do implement that interface.
  var baseTraversal = 'com.tinkerpop.gremlin.process.Traversal';
  _.forOwn(classes, function (classMap, className) {
    if (className.match(/(\w+)Traversal$/)) {
      if (_.indexOf(classMap.interfaces, baseTraversal) === -1) {
        classMap.interfaces.push(baseTraversal);
      }
    }
  });
}

function mapMethodDefinitions(classes) {
  var methodsDefinitions = {};

  var work = new Work(_.keys(classes));
  while (!work.isDone()) {
    var className = work.next();
    locateMethodDefinitions(className, classes, work, methodsDefinitions);
  }

  return methodsDefinitions;
}

function writeTxts(classes) {
  _.forOwn(classes, function (classMap, className) {
    fs.writeFileSync('out/txt/' + classMap.shortName + '.txt', JSON.stringify(classMap, null, '  '));
  });
}

function Block(lines, extra) {
  extra = _.isNumber(extra) ? extra : 2;
  function Extra() {
    var s = '';
    for (var i=0; i<extra; ++i)
      s = s + '\n';
    return s;
  }
  return lines.join('\n') + Extra();
}

function writeJsHeader(write, className, classMap) {
  var firstLines = Block([
    "// ${name}.js'",
    "",
    "'use strict';"
  ]);

  var imports = Block([
    "var ${name} = require('./${name}.js');"
  ], 1);

  var constructor = Block([
    "function ${name}(_jThis) {",
    "  if (!(this instanceof ${name})) {",
    "    return new ${name}(_jThis);",
    "  }",
    "  this.jThis = _jThis;",
    "}"
  ]);

  return write(_.template(firstLines, { name: className }), 'utf8')
    .then(function () {
      return Promise.all(classMap.interfaces)
        .each(function (intf) {
          if (intf in classes) {
            var interfaceMap = classes[intf];
            var interfaceName = interfaceMap.shortName + 'Wrapper';
            return write(_.template(imports, { name: interfaceName }), 'utf8');
          }
        });
    })
    .then(function () {
      return write(_.template(constructor, { name: className }), 'utf8');
    });
}

function writeOneDefinedMethod(write, className, method) {
  var text = Block([
    "// ${signature}",
    "${clazz}.prototype.${method} = function() {",
    "};"
  ]);

  var methodName = method.name;
  var signature = method.signature;
  return write(_.template(text, { clazz: className, method: methodName, signature: signature }), 'utf8');
}

function writeOneInheritedMethod(write, className, method) {
  var text = Block([
    "// ${signature}",
    "${clazz}.prototype.${method} = ${defining}.prototype.${method};"
  ]);

  var methodName = method.name;
  var signature = method.signature;
  var defining = classes[methodsDefinitions[signature]].shortName + 'Wrapper';
  return write(_.template(text, { clazz: className, method: methodName, signature: signature, defining: defining }), 'utf8');
}

function writeJsMethods(write, className, classMap) {
  return Promise.all(classMap.methods)
    .each(function (method) {
      if (method.definedHere)
        return writeOneDefinedMethod(write, className, method);
      else
        return writeOneInheritedMethod(write, className, method);
    });
}

function writeClassLib(classMap) {
  var className = classMap.shortName + 'Wrapper';
  var fileName = 'out/lib/' + className + '.js';

  var stream = fs.createWriteStream(fileName);
  var write = Promise.promisify(stream.write, stream);
  var end = Promise.promisify(stream.end, stream);

  return writeJsHeader(write, className, classMap)
    .then(function () { return writeJsMethods(write, className, classMap); })
    .then(function () { return end(); });
}

function writeLib(classes) {
  return Promise.all(_.keys(classes))
    .each(function (className) {
      return writeClassLib(classes[className]);
    });
}

var classes;
var methodsDefinitions;

function main() {

  mkdirp.sync('out/txt');
  mkdirp.sync('out/lib');
  mkdirp.sync('out/test');

  classes = loadAllClasses();
  hackTraversalInterfaces(classes);
  methodsDefinitions = mapMethodDefinitions(classes);

  writeTxts(classes);
  writeLib(classes).done();
}

main();
