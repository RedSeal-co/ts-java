'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var ClassesMap = require('./lib/classes-map.js');
var fs = require('fs');
var mkdirp = require('mkdirp');
var Work = require('./lib/work.js');

var BluePromise = require("bluebird");
BluePromise.longStackTraces();

function writeJsons(classes) {
  _.forOwn(classes, function (classMap, className) {
    fs.writeFileSync('out/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
  });
}

function block(lines, extra) {
  extra = _.isNumber(extra) ? extra : 2;
  function extraLines() {
    var s = '';
    for (var i=0; i<extra; ++i)
      s = s + '\n';
    return s;
  }
  return lines.join('\n') + extraLines();
}

function writeRequiredInterfaces(classes, write, classMap) {
  var imports = block([
    "var ${name} = require('./${name}.js');"
  ], 1);

  return BluePromise.all(classMap.interfaces)
    .each(function (intf) {
      assert.ok(intf in classes, 'Unknown interface:' + intf);
      var interfaceMap = classes[intf];
      var interfaceName = interfaceMap.shortName + 'Wrapper';
      return write(_.template(imports, { name: interfaceName }));
    })
    .then(function () { return write('\n'); });
}

function writeJsHeader(classes, write, className, classMap) {
  var firstLines = block([
    "// ${name}.js'",
    "",
    "'use strict';"
  ]);

  var constructor = block([
    "function ${name}(_jThis) {",
    "  if (!(this instanceof ${name})) {",
    "    return new ${name}(_jThis);",
    "  }",
    "  this.jThis = _jThis;",
    "}"
  ]);

  return write(_.template(firstLines, { name: className }))
    .then(function () {
      return writeRequiredInterfaces(classes, write, classMap);
    })
    .then(function () {
      return write(_.template(constructor, { name: className }));
    });
}

function writeOneDefinedMethod(write, className, method) {
  var text = block([
    "// ${signature}",
    "${clazz}.prototype.${method} = function() {",
    "};"
  ]);

  var methodName = method.name;
  var signature = method.signature;
  return write(_.template(text, { clazz: className, method: methodName, signature: signature }));
}

function writeOneInheritedMethod(classesMap, write, className, method) {
  var text = block([
    "// ${signature}",
    "${clazz}.prototype.${method} = ${defining}.prototype.${method};"
  ]);

  var methodName = method.name;
  var signature = method.signature;
  var classes = classesMap.getClasses();
  var methodDefinitions = classesMap.getMethodDefinitions();
  var defining = classes[methodDefinitions[signature]].shortName + 'Wrapper';
  return write(_.template(text, { clazz: className, method: methodName, signature: signature, defining: defining }));
}

function writeJsMethods(classesMap, write, className, classMap) {
  function bySignature(a, b) {
    return a.signature.localeCompare(b.signature);
  }

  return BluePromise.all(classMap.methods.sort(bySignature))
    .each(function (method) {
      if (method.definedHere)
        return writeOneDefinedMethod(write, className, method);
      else
        return writeOneInheritedMethod(classesMap, write, className, method);
    });
}

function writeClassLib(classesMap, classMap) {
  var className = classMap.shortName + 'Wrapper';
  var fileName = 'out/lib/' + className + '.js';

  var stream = fs.createWriteStream(fileName);
  var write = BluePromise.promisify(stream.write, stream);
  var end = BluePromise.promisify(stream.end, stream);

  var classes = classesMap.getClasses();
  return writeJsHeader(classes, write, className, classMap)
    .then(function () { return writeJsMethods(classesMap, write, className, classMap); })
    .then(function () { return end(); });
}

function writeLib(classesMap) {
  var classes = classesMap.getClasses();
  return BluePromise.all(_.keys(classes))
    .each(function (className) {
      return writeClassLib(classesMap, classes[className]);
    });
}

function main() {
  mkdirp.sync('out/json');
  mkdirp.sync('out/lib');
  mkdirp.sync('out/test');

  var classesMap = new ClassesMap();

  var seedClasses = ['java.lang.Object', 'com.tinkerpop.gremlin.structure.Graph'];
  classesMap.loadAllClasses(seedClasses);
  classesMap.transitiveClosureInterfaces();
  classesMap.mapMethodDefinitions();

  writeJsons(classesMap.getClasses());
  writeLib(classesMap).done();
}

main();
