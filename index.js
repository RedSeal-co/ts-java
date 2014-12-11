'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var fs = require('fs');
var Gremlin = require('gremlin-v3');
var Immutable = require('immutable');
var mkdirp = require('mkdirp');
var Work = require('./lib/work.js');

var gremlin = new Gremlin();
var java = gremlin.java;
var Class = java.import('java.lang.Class');

var Promise = require("bluebird");
Promise.longStackTraces();

var classes = {};
var methodsDefinitions = {};

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

function addIfNotQueued(className, work) {
  if (inWhiteList(className)) {
    work.addTodo(className);
  }
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
    methodMap.signature = methodMap.name + '(' + params.join() + '): ' + methodMap.returns;
  }
  else {
    methodMap.signature = methodMap.name + '(' + methodMap.params.join() + varArgs + '): ' + methodMap.returns;
  }


  addIfNotQueued(methodMap.declared, work);
  addIfNotQueued(methodMap.returns, work);

  return methodMap;
}

function mapClass(className, work) {
  var clazz = loadClass(className);
  assert.strictEqual(clazz.getNameSync(), className);

  var shortName = shortClassName(className);
  var methods = _.map(clazz.getMethodsSync(), function (m) { return mapMethod(m, work); });

  var interfaces = _.map(clazz.getInterfacesSync(), function (intf) { return intf.getNameSync(); });
  interfaces = _.filter(interfaces, function (intf) { return inWhiteList(intf); });

  // HACK: in TP3, some *Traversal classes are not declared to implement Traversal,
  // e.g. ElementTraversal. I believe we will want to treat these classes as if they
  // actually do implement that interface.
  if (className.match(/(\w+)Traversal$/)) {
    var baseTraversal = 'com.tinkerpop.gremlin.process.Traversal';
    if (_.indexOf(interfaces, baseTraversal) === -1) {
      interfaces.push(baseTraversal);
    }
  }

  var javaLangObject = 'java.lang.Object';
  if (interfaces.length === 0 && className !== javaLangObject)
    interfaces.push(javaLangObject);

  _.forEach(interfaces, function (intf) { addIfNotQueued(intf, work); });

  var classMap = {
    fullName: className,
    shortName: shortName,
    superClass: superClass,
    interfaces: interfaces,
    methods: methods
  };

  var superClass = clazz.getSuperclassSync()
  if (superClass) {
    classMap.superClass = superClass.getNameSync();
    console.log('Superclass of %s is %s', className, classMap.superClass);
  }
  else {
    console.log('Class %s has no superclass', className);
  }

  return classMap;
}

function locateMethodDefinitions(className, work) {
  assert.object(methodsDefinitions);

  assert.ok(className in classes);
  var classMap = classes[className];
  assert.strictEqual(className, classMap.fullName);

  _.forEach(classMap.interfaces, function (intf) {
    if (!work.alreadyDone(intf)) {
      assert.ok(intf in classes, 'Unknown interface:' + intf);
      locateMethodDefinitions(intf, work);
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
  var work = new Work();
  work.addTodo('java.lang.Object');
  work.addTodo('com.tinkerpop.gremlin.structure.Graph');

  while (!work.isDone()) {
    var className = work.next();
    work.setDone(className);
    classes[className] = mapClass(className, work);
  }
}

function byDepth(a, b) {
  var result = classes[a].depth - classes[b].depth;
  if (result === 0) {
    // for tiebreaker, arrange for java.* to sort before com.*
    result = classes[b].fullName.localeCompare(classes[a].fullName);
  }
  return result;
}

function interfacesClosure(className, work) {
  assert.ok(!work.alreadyDone(className));
  var transitiveClosure = Immutable.Set(classes[className].interfaces);

  var maxdepth = 0;
  _.forEach(classes[className].interfaces, function (intf) {
    if (!work.alreadyDone(intf))
      interfacesClosure(intf, work);
    assert.ok(work.alreadyDone(intf));
    assert.number(classes[intf].depth);
    if (maxdepth < classes[intf].depth)
      maxdepth = classes[intf].depth;
    transitiveClosure = transitiveClosure.union(classes[intf].interfaces);
  });

//   console.log('For class %s, before %j, after %j:', className, classes[className].interfaces, transitiveClosure);
  classes[className].interfaces = transitiveClosure.toArray().sort(byDepth);
  classes[className].depth = maxdepth+1;
  work.setDone(className);
}

function transitiveClosureInterfaces() {
  var work = new Work(_.keys(classes));

  while (!work.isDone()) {
    var className = work.next();
    interfacesClosure(className, work);
  }
}

function mapMethodDefinitions() {
  var work = new Work(_.keys(classes));
  while (!work.isDone()) {
    var className = work.next();
    locateMethodDefinitions(className, work);
  }
}

function writeJsons() {
  _.forOwn(classes, function (classMap, className) {
    fs.writeFileSync('out/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
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

function writeRequiredInterfaces(write, classMap) {
  var imports = Block([
    "var ${name} = require('./${name}.js');"
  ], 1);

  return Promise.all(classMap.interfaces)
    .each(function (intf) {
      assert.ok(intf in classes, 'Unknown interface:' + intf);
      var interfaceMap = classes[intf];
      var interfaceName = interfaceMap.shortName + 'Wrapper';
      return write(_.template(imports, { name: interfaceName }));
    })
    .then(function () { return write('\n'); });
}

function writeJsHeader(write, className, classMap) {
  var firstLines = Block([
    "// ${name}.js'",
    "",
    "'use strict';"
  ]);

  var constructor = Block([
    "function ${name}(_jThis) {",
    "  if (!(this instanceof ${name})) {",
    "    return new ${name}(_jThis);",
    "  }",
    "  this.jThis = _jThis;",
    "}"
  ]);

  return write(_.template(firstLines, { name: className }))
    .then(function () {
      return writeRequiredInterfaces(write, classMap);
    })
    .then(function () {
      return write(_.template(constructor, { name: className }));
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
  return write(_.template(text, { clazz: className, method: methodName, signature: signature }));
}

function writeOneInheritedMethod(write, className, method) {
  var text = Block([
    "// ${signature}",
    "${clazz}.prototype.${method} = ${defining}.prototype.${method};"
  ]);

  var methodName = method.name;
  var signature = method.signature;
  var defining = classes[methodsDefinitions[signature]].shortName + 'Wrapper';
  return write(_.template(text, { clazz: className, method: methodName, signature: signature, defining: defining }));
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

function writeLib() {
  return Promise.all(_.keys(classes))
    .each(function (className) {
      return writeClassLib(classes[className]);
    });
}

function main() {

  mkdirp.sync('out/json');
  mkdirp.sync('out/lib');
  mkdirp.sync('out/test');

  loadAllClasses();

  transitiveClosureInterfaces();

  mapMethodDefinitions();

  writeJsons();
  writeLib().done();
}

main();
