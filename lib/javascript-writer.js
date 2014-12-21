'use strict';

var _ = require('lodash');
var assert = require('assert');
var BluePromise = require("bluebird");
var fs = require('fs');

// ## JavascriptWriter
// A class that provides methods for writing Javascript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.js.
function JavascriptWriter(classesMap) {

  var self = this;
  var classes = classesMap.getClasses();
  var methodOriginations = classesMap.getMethodOriginations();


  // *writeRequiredInterfaces()*: write the require() statements for all required interfaces.
  self.writeRequiredInterfaces = function writeRequiredInterfaces(streamFn, className) {
    assert.ok(classes);
    var classMap = classes[className];
    assert.ok(classMap);

    var imports = block([
      "var ${name} = require('./${name}.js');"
    ], 1);

    return BluePromise.all(classMap.interfaces)
      .each(function (intf) {
        assert.ok(intf in classes, 'Unknown interface:' + intf);
        var interfaceMap = classes[intf];
        var interfaceName = interfaceMap.shortName + 'Wrapper';
        return streamFn(_.template(imports, { name: interfaceName }));
      })
      .then(function () { return streamFn('\n'); });
  };


  // *writeJsHeader(): write the 'header' of a library .js file for the given class.
  // The header includes a minimal doc comment, the necessary requires(), and the class constructor.
  self.writeJsHeader = function writeJsHeader(streamFn, className) {
    var classMap = classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var firstLines = block([
      "// ${name}.js",
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

    return streamFn(_.template(firstLines, { name: jsClassName }))
      .then(function () {
        return self.writeRequiredInterfaces(streamFn, className);
      })
      .then(function () {
        return streamFn(_.template(constructor, { name: jsClassName }));
      });
  };


  // *writeOneDefinedMethod(): write one method definition.
  self.writeOneDefinedMethod = function writeOneDefinedMethod(streamFn, className, method) {
    var classMap = classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var text = block([
      "// ${signature}",
      "${clazz}.prototype.${method} = function() {",
      "};"
    ]);

    var methodName = method.name;
    var signature = method.signature;
    return streamFn(_.template(text, { clazz: jsClassName, method: methodName, signature: signature }));
  };


  // *writeOneInheritedMethod(): write the declaration of one method 'inherited' from another class.
  self.writeOneInheritedMethod = function writeOneInheritedMethod(streamFn, className, method) {
    var classMap = classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var text = block([
      "// ${signature}",
      "${clazz}.prototype.${method} = ${defining}.prototype.${method};"
    ]);

    var methodName = method.name;
    var signature = method.signature;
    var defining = classes[methodOriginations[signature]].shortName + 'Wrapper';
    return streamFn(_.template(text, { clazz: jsClassName, method: methodName, signature: signature, defining: defining }));
  };


  // *writeJsMethods(): write all method declarations for a class.
  self.writeJsMethods = function writeJsMethods(streamFn, className) {
    function bySignature(a, b) {
      return a.signature.localeCompare(b.signature);
    }

    var classMap = classes[className];
    return BluePromise.all(classMap.methods.sort(bySignature))
      .each(function (method) {
        if (method.definedHere)
          return self.writeOneDefinedMethod(streamFn, className, method);
        else
          return self.writeOneInheritedMethod(streamFn, className, method);
      });
  };


  // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
  self.streamLibraryClassFile = function streamLibraryClassFile(className, streamFn, endFn) {
    return self.writeJsHeader(streamFn, className)
      .then(function () { return self.writeJsMethods(streamFn, className); })
      .then(function () { return endFn(); });
  };


  // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.js).
  self.writeLibraryClassFile = function writeLibraryClassFile(className) {
    var classMap = classes[className];

    var fileName = classMap.shortName + 'Wrapper';
    var filePath = 'out/lib/' + fileName + '.js';

    var stream = fs.createWriteStream(filePath);
    var streamFn = BluePromise.promisify(stream.write, stream);
    var endFn = BluePromise.promisify(stream.end, stream);

    return self.streamLibraryClassFile(className, streamFn, endFn);
  };


  // *getClassMap(): accessor method to return the 'class map' for the given class name.
  // The class map is a javascript object map/dictionary containing all properties of interest for the class.
  self.getClassMap = function getClassMap(className) {
    return classes[className];
  };


  // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
  self.getMethodVariants = function getMethodVariants(className, methodName) {
    var methods = classes[className].methods;
    return _.filter(methods, function (method) { return method.name === methodName; });
  };


  // *block(): a private helper method to assemble an array of lines of text into a contiguous text block.
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

}

module.exports = JavascriptWriter;
