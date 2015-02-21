/// <reference path='../node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path='../typings/glob/glob.d.ts' />
/// <reference path='../typings/handlebars/handlebars.d.ts' />
/// <reference path='../typings/lodash/lodash.d.ts' />
/// <reference path='../typings/node/node.d.ts' />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var BluePromise = require('bluebird');
var fs = require('fs');
var glob = require('glob');
var handlebars = require('handlebars');
var Immutable = require('immutable');
var path = require('path');
var util = require('util');
// ## CodeWriter
// A class for writing Javascript/TypeScript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.ts.
var CodeWriter = (function () {
    function CodeWriter(classesMap, templatesDirPath) {
        this.classesMap = classesMap;
        this.classes = classesMap.getClasses();
        this.templates = this.loadTemplates(templatesDirPath);
        this.registerHandlebarHelpers();
    }
    CodeWriter.prototype.loadTemplates = function (templatesDirPath) {
        var templates = Immutable.Map();
        var extension = '.txt';
        var globExpr = path.join(templatesDirPath, '*' + extension);
        var filenames = glob.sync(globExpr);
        if (filenames.length === 0) {
            throw new Error('No templates found in:' + globExpr);
        }
        _.forEach(filenames, function (path) {
            var lastSlash = path.lastIndexOf('/');
            assert(lastSlash !== -1);
            var name = path.slice(lastSlash + 1, -extension.length);
            var contents = fs.readFileSync(path, { encoding: 'utf8' });
            var compiled = handlebars.compile(contents);
            templates = templates.set(name, compiled);
        });
        return templates;
    };
    CodeWriter.prototype.fill = function (name, ctx) {
        return this.templates.get(name)(ctx);
    };
    // *registerHandlebarHelpers()*
    CodeWriter.prototype.registerHandlebarHelpers = function () {
        var _this = this;
        handlebars.registerHelper('intf', function (interfaces, options) {
            return _.reduce(interfaces, function (out, intf) {
                var interfaceMap = _this.classes[intf];
                return out + options.fn(interfaceMap.shortName);
            }, '');
        });
        handlebars.registerHelper('margs', function (method, options) {
            var tsParamTypes = method.tsParamTypes;
            var names = method.paramNames;
            var args = _.map(names, function (name, i) {
                if (method.isVarArgs && i === names.length - 1) {
                    var t = tsParamTypes[i].slice(0, -2);
                    return util.format('%s: array_t<%s>', name, t);
                }
                else {
                    return util.format('%s: %s', name, tsParamTypes[i]);
                }
            });
            return args.join(', ');
        });
        handlebars.registerHelper('mcall', function (method, options) {
            return method.paramNames.join(', ');
        });
        handlebars.registerHelper('hasClass', function (className, options) {
            if (_this.classes[className]) {
                return options.fn(_this.classes[className]);
            }
        });
    };
    // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
    CodeWriter.prototype.streamLibraryClassFile = function (className, template, streamFn, endFn) {
        return streamFn(this.fill(template, this.classes[className])).then(function () {
            return endFn();
        });
    };
    // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.ts).
    CodeWriter.prototype.writeLibraryClassFile = function (className, template, ext) {
        if (template === void 0) { template = 'sourcefile'; }
        if (ext === void 0) { ext = '.ts'; }
        var classMap = this.classes[className];
        var fileName = classMap.shortName;
        var filePath = 'o/lib/' + fileName + ext;
        var stream = fs.createWriteStream(filePath);
        var streamFn = BluePromise.promisify(stream.write, stream);
        var endFn = BluePromise.promisify(stream.end, stream);
        return this.streamLibraryClassFile(className, template, streamFn, endFn);
    };
    // *writePackageFile(): write a .d.ts file a package/namespace
    // This currently writes one file for the entire set of classes.
    // TODO: refactor so that we write one file per top-level package/namespace.
    CodeWriter.prototype.writePackageFile = function (options) {
        var _this = this;
        var stream = fs.createWriteStream(options.outputPath);
        var streamFn = BluePromise.promisify(stream.write, stream);
        var endFn = BluePromise.promisify(stream.end, stream);
        var outputBaseName = path.basename(options.outputPath);
        return streamFn('// ' + outputBaseName + '\n').then(function () { return streamFn('// This file was generated by ts-java.\n'); }).then(function () { return streamFn('/// <reference path=\'' + options.promisesPath + '\' />\n\n'); }).then(function () { return streamFn(_this.fill('package', _this.classes)); }).then(function () { return endFn(); });
    };
    // *getClassMap(): accessor method to return the 'class map' for the given class name.
    // The class map is a javascript object map/dictionary containing all properties of interest for the class.
    CodeWriter.prototype.getClassMap = function (className) {
        return this.classes[className];
    };
    // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
    CodeWriter.prototype.getMethodVariants = function (className, methodName) {
        var methods = this.classes[className].methods;
        return _.filter(methods, function (method) {
            return method.name === methodName;
        });
    };
    return CodeWriter;
})();
module.exports = CodeWriter;
//# sourceMappingURL=code-writer.js.map