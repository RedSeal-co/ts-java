/// <reference path='bluebird.d.ts' />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path="../typings/lodash/lodash.d.ts" />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var BluePromise = require("bluebird");
var fs = require('fs');
// ## JavascriptWriter
// A class that provides methods for writing Javascript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.js.
var JavascriptWriter = (function () {
    function JavascriptWriter(classesMap) {
        this.classes = classesMap.getClasses();
        this.methodOriginations = classesMap.getMethodOriginations();
    }
    // *writeRequiredInterfaces()*: write the require() statements for all required interfaces.
    JavascriptWriter.prototype.writeRequiredInterfaces = function (streamFn, className) {
        var _this = this;
        assert.ok(this.classes);
        var classMap = this.classes[className];
        assert.ok(classMap);
        var imports = this.block([
            "var ${name} = require('./${name}.js');"
        ], 1);
        return BluePromise.all(classMap.interfaces).each(function (intf) {
            assert.ok(intf in _this.classes, 'Unknown interface:' + intf);
            var interfaceMap = _this.classes[intf];
            var interfaceName = interfaceMap.shortName + 'Wrapper';
            return streamFn(_.template(imports, { name: interfaceName }));
        }).then(function () {
            return streamFn('\n');
        });
    };
    // *writeJsHeader(): write the 'header' of a library .js file for the given class.
    // The header includes a minimal doc comment, the necessary requires(), and the class constructor.
    JavascriptWriter.prototype.writeJsHeader = function (streamFn, className) {
        var _this = this;
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
        return streamFn(_.template(firstLines, { name: jsClassName })).then(function () {
            return _this.writeRequiredInterfaces(streamFn, className);
        }).then(function () {
            return streamFn(_.template(constructor, { name: jsClassName }));
        });
    };
    // *writeOneDefinedMethod(): write one method definition.
    JavascriptWriter.prototype.writeOneDefinedMethod = function (streamFn, className, method) {
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
    };
    // *writeOneInheritedMethod(): write the declaration of one method 'inherited' from another class.
    JavascriptWriter.prototype.writeOneInheritedMethod = function (streamFn, className, method) {
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
    };
    // *writeJsMethods(): write all method declarations for a class.
    JavascriptWriter.prototype.writeJsMethods = function (streamFn, className) {
        var _this = this;
        function bySignature(a, b) {
            return a.signature.localeCompare(b.signature);
        }
        var classMap = this.classes[className];
        return BluePromise.all(classMap.methods.sort(bySignature)).each(function (method) {
            if (method.definedHere)
                return _this.writeOneDefinedMethod(streamFn, className, method);
            else
                return _this.writeOneInheritedMethod(streamFn, className, method);
        });
    };
    // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
    JavascriptWriter.prototype.streamLibraryClassFile = function (className, streamFn, endFn) {
        var _this = this;
        return this.writeJsHeader(streamFn, className).then(function () {
            return _this.writeJsMethods(streamFn, className);
        }).then(function () {
            return endFn();
        });
    };
    // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.js).
    JavascriptWriter.prototype.writeLibraryClassFile = function (className) {
        var classMap = this.classes[className];
        var fileName = classMap.shortName + 'Wrapper';
        var filePath = 'out/lib/' + fileName + '.js';
        var stream = fs.createWriteStream(filePath);
        var streamFn = BluePromise.promisify(stream.write, stream);
        var endFn = BluePromise.promisify(stream.end, stream);
        return this.streamLibraryClassFile(className, streamFn, endFn);
    };
    // *getClassMap(): accessor method to return the 'class map' for the given class name.
    // The class map is a javascript object map/dictionary containing all properties of interest for the class.
    JavascriptWriter.prototype.getClassMap = function (className) {
        return this.classes[className];
    };
    // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
    JavascriptWriter.prototype.getMethodVariants = function (className, methodName) {
        var methods = this.classes[className].methods;
        return _.filter(methods, function (method) {
            return method.name === methodName;
        });
    };
    // *block(): a private helper method to assemble an array of lines of text into a contiguous text block.
    JavascriptWriter.prototype.block = function (lines, extra) {
        extra = _.isNumber(extra) ? extra : 2;
        function extraLines() {
            var s = '';
            for (var i = 0; i < extra; ++i)
                s = s + '\n';
            return s;
        }
        return lines.join('\n') + extraLines();
    };
    return JavascriptWriter;
})();
module.exports = JavascriptWriter;
//# sourceMappingURL=javascript-writer.js.map