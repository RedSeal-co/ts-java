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
        this.sortedClasses = classesMap.getSortedClasses();
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
        handlebars.registerHelper('margs', function (method, options) {
            var tsParamTypes = method.tsParamTypes;
            var names = method.paramNames;
            // Map each parameter to the correct typescript type declaration.
            // We need special processing to take into account various ways that array arguments must be treated.
            var args = _.map(names, function (name, i) {
                // The last parameter might be a varargs parameter.
                var isLastParam = i === tsParamTypes.length - 1;
                // Is this argument an array type `array_t<T>`
                var argType = tsParamTypes[i];
                var m = argType.match(/^array_t<(.+)>$/);
                if (m) {
                    // We do have a Java array type array_t<T>. Create the Javascript representation T[] for use below.
                    argType = m[1] + '[]';
                }
                // If this parameter is not or should not be treated as a varargs parameter.
                // (options.hash.norest is context provided by the handlebars template.)
                if (options.hash.norest || !method.isVarArgs || !isLastParam) {
                    // It this parameter an array of object_t?
                    if (m && m[1] === 'object_t') {
                        // Yes we do. This is a special case, where we can accept either array_t<Object> or object_t[]
                        return util.format('%s: object_array_t', name);
                    }
                    else {
                        // Not an array of object_t, the type tsParamTypes[i] is the correct type (whether an array or not)
                        return util.format('%s: %s', name, tsParamTypes[i]);
                    }
                }
                else {
                    // This is a varargs parameter, use the javascript representation T[] recorded in argType.
                    return util.format('...%s: %s', name, argType);
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
            else {
                return options.inverse(_this);
            }
        });
        handlebars.registerHelper('ifdef', function (conditional, options) {
            if (conditional !== undefined) {
                return options.fn(this);
            }
        });
        handlebars.registerHelper('join', function (array, sep, options) {
            return array.map(function (item) { return options.fn(item); }).join(sep);
        });
    };
    // *streamTsJavaModule(): stream the tsJavaModule.ts file contents
    CodeWriter.prototype.streamTsJavaModule = function (options, streamFn, endFn) {
        var _this = this;
        // Remove the runtime libary rt.jar, which was added earlier as 'a convenience'.
        // TODO: refactor so that rt.jar is not present.
        var classpath = _.filter(options.classpath, function (jarpath) { return path.basename(jarpath) !== 'rt.jar'; });
        // Compute the relative path from the directory that will contain the tsJavaModule file to
        // the root directory of the module (i.e. directory containing package.json with tsjava section).
        // This relative path must be applied to each path in the classpath.
        var tsJavaModuleDir = path.dirname(path.resolve(options.tsJavaModulePath));
        var relativePath = path.relative(tsJavaModuleDir, process.cwd());
        var context = {
            config: options,
            classes: this.sortedClasses,
            opts: options.asyncOptions,
            classpath: classpath,
            classpathAdjust: relativePath,
            debug: _.isString(options.debugTypingsPath)
        };
        var lodashTypingsPath = options.javaTypingsPath.replace(/java/g, 'lodash');
        var templateName = options.generics ? 'tsJavaModuleGenerics' : 'tsJavaModule';
        var outputBaseName = path.basename(options.tsJavaModulePath);
        return streamFn('// ' + outputBaseName + '\n')
            .then(function () { return streamFn('// This file was generated by ts-java.\n'); })
            .then(function () { return streamFn('/// <reference path="' + options.javaTypingsPath + '" />\n'); })
            .then(function () { return streamFn('/// <reference path="' + lodashTypingsPath + '" />\n'); })
            .then(function () {
            if (context.debug) {
                return streamFn('/// <reference path="' + options.debugTypingsPath + '" />\n');
            }
            else {
                return;
            }
        })
            .then(function () { return streamFn('\n'); })
            .then(function () { return streamFn(_this.fill(templateName, context)); })
            .then(function () { return endFn(); });
    };
    // *writeTsJavaModule(): write the tsJavaModule.ts file, small .ts source file that makes it possible
    // to import java classes with just their class name;
    CodeWriter.prototype.writeTsJavaModule = function (options) {
        var stream = fs.createWriteStream(options.tsJavaModulePath);
        var streamFn = BluePromise.promisify(stream.write, stream);
        var endFn = BluePromise.promisify(stream.end, stream);
        return this.streamTsJavaModule(options, streamFn, endFn);
    };
    // *getClassMap(): accessor method to return the 'class map' for the given class name.
    // The class map is a javascript object map/dictionary containing all properties of interest for the class.
    CodeWriter.prototype.getClassMap = function (className) {
        return this.classes[className];
    };
    // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
    CodeWriter.prototype.getMethodVariants = function (className, methodName) {
        var methods = this.classes[className].methods;
        return _.filter(methods, function (method) { return method.name === methodName; });
    };
    return CodeWriter;
})();
module.exports = CodeWriter;
//# sourceMappingURL=code-writer.js.map