/// <reference path='bluebird.d.ts' />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path="../typings/lodash/lodash.d.ts" />

'use strict';

import _ = require('lodash');
import assert = require('assert');
import BluePromise = require("bluebird");
import fs = require('fs');
import ClassesMap = require('./classes-map');

interface FunctionReturningPromise<R> {
  (any): BluePromise<R>;
}

interface StreamFn {
  (string): BluePromise<void>;
}

interface EndFn {
  (): BluePromise<void>;
}

// ## JavascriptWriter
// A class that provides methods for writing Javascript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.js.
class JavascriptWriter {

  private classes: ClassesMap.ClassDefinitionMap;
  private methodOriginations: ClassesMap.MethodOriginationMap;

  constructor(classesMap: ClassesMap.ClassesMap) {
    this.classes = classesMap.getClasses();
    this.methodOriginations = classesMap.getMethodOriginations();
  }


  // *writeRequiredInterfaces()*: write the require() statements for all required interfaces.
  writeRequiredInterfaces(streamFn: StreamFn, className: string): BluePromise<void> {
    assert.ok(this.classes);
    var classMap = this.classes[className];
    assert.ok(classMap);

    var imports = this.block([
      "var ${name} = require('./${name}.js');"
    ], 1);

    return BluePromise.all(classMap.interfaces)
      .each((intf) => {
        assert.ok(intf in this.classes, 'Unknown interface:' + intf);
        var interfaceMap = this.classes[intf];
        var interfaceName = interfaceMap.shortName + 'Wrapper';
        return streamFn(_.template(imports, { name: interfaceName }));
      })
      .then(() => { return streamFn('\n'); });
  }


  // *writeJsHeader(): write the 'header' of a library .js file for the given class.
  // The header includes a minimal doc comment, the necessary requires(), and the class constructor.
  writeJsHeader(streamFn: StreamFn, className: string) {
    var classMap = this.classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var firstLines = this.block([
      "// ${name}.js",
      "",
      "'use strict';"
    ]);

    var constructor = this.block([
      "function ${name}(_jThis) {",
      "  if (!(this instanceof ${name})) {",
      "    return new ${name}(_jThis);",
      "  }",
      "  this.jThis = _jThis;",
      "}"
    ]);

    return streamFn(_.template(firstLines, { name: jsClassName }))
      .then(() => {
        return this.writeRequiredInterfaces(streamFn, className);
      })
      .then(() => {
        return streamFn(_.template(constructor, { name: jsClassName }));
      });
  }


  // *writeOneDefinedMethod(): write one method definition.
  writeOneDefinedMethod(streamFn: StreamFn, className: string, method) {
    var classMap = this.classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var text = this.block([
      "// ${signature}",
      "${clazz}.prototype.${method} = function() {",
      "};"
    ]);

    var methodName = method.name;
    var signature = method.signature;
    return streamFn(_.template(text, { clazz: jsClassName, method: methodName, signature: signature }));
  }


  // *writeOneInheritedMethod(): write the declaration of one method 'inherited' from another class.
  writeOneInheritedMethod(streamFn: StreamFn, className: string, method) {
    var classMap = this.classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var text = this.block([
      "// ${signature}",
      "${clazz}.prototype.${method} = ${defining}.prototype.${method};"
    ]);

    var methodName = method.name;
    var signature = method.signature;
    var defining = this.classes[this.methodOriginations[signature]].shortName + 'Wrapper';
    return streamFn(_.template(text, { clazz: jsClassName, method: methodName, signature: signature, defining: defining }));
  }


  // *writeJsMethods(): write all method declarations for a class.
  writeJsMethods(streamFn: StreamFn, className: string) {
    function bySignature(a, b) {
      return a.signature.localeCompare(b.signature);
    }

    var classMap = this.classes[className];
    return BluePromise.all(classMap.methods.sort(bySignature))
      .each((method) => {
        if (method.definedHere)
          return this.writeOneDefinedMethod(streamFn, className, method);
        else
          return this.writeOneInheritedMethod(streamFn, className, method);
      });
  }


  // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
  streamLibraryClassFile(className: string, streamFn: StreamFn, endFn: EndFn) {
    return this.writeJsHeader(streamFn, className)
      .then(() => { return this.writeJsMethods(streamFn, className); })
      .then(() => { return endFn(); });
  }


  // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.js).
  writeLibraryClassFile(className: string) {
    var classMap = this.classes[className];

    var fileName = classMap.shortName + 'Wrapper';
    var filePath = 'out/lib/' + fileName + '.js';

    var stream = fs.createWriteStream(filePath);
    var streamFn: StreamFn = <StreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = <EndFn> BluePromise.promisify(stream.end, stream);

    return this.streamLibraryClassFile(className, streamFn, endFn);
  }


  // *getClassMap(): accessor method to return the 'class map' for the given class name.
  // The class map is a javascript object map/dictionary containing all properties of interest for the class.
  getClassMap(className: string) {
    return this.classes[className];
  }


  // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
  getMethodVariants(className: string, methodName: string) {
    var methods = this.classes[className].methods;
    return _.filter(methods, (method) => { return method.name === methodName; });
  }


  // *block(): a private helper method to assemble an array of lines of text into a contiguous text block.
  block(lines: string[], extra?: number): string {
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
