/// <reference path='../node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path='../typings/chalk/chalk.d.ts' />
/// <reference path='../typings/commander/commander.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path='../typings/glob/glob.d.ts' />
/// <reference path='../typings/handlebars/handlebars.d.ts' />
/// <reference path='../typings/lodash/lodash.d.ts' />
/// <reference path='../typings/mkdirp/mkdirp.d.ts' />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='../lib/find-java-home.d.ts' />
/// <reference path='../lib/read-package-json.d.ts' />
'use strict';
var _ = require('lodash');
var BluePromise = require('bluebird');
var chalk = require('chalk');
var ClassesMap = require('../lib/classes-map');
var CodeWriter = require('../lib/code-writer');
var debug = require('debug');
var findJavaHome = require('find-java-home');
var fs = require('fs');
var glob = require('glob');
var Immutable = require('immutable');
var java = require('java');
var mkdirp = require('mkdirp');
var path = require('path');
var program = require('commander');
var readJson = require('read-package-json');
BluePromise.longStackTraces();
var writeFilePromise = BluePromise.promisify(fs.writeFile);
var readFilePromise = BluePromise.promisify(fs.readFile);
var mkdirpPromise = BluePromise.promisify(mkdirp);
var readJsonPromise = BluePromise.promisify(readJson);
var globPromise = BluePromise.promisify(glob);
var findJavaHomePromise = BluePromise.promisify(findJavaHome);
// ts-java must use asyncOptions that are 'compatible' with the java/java.d.ts in Definitely typed,
// which uses the following settings.
// Options are incompatible if a different value is defined for any of the three properties,
// but any of them can be left undefined.
var expectedAsyncOptions = {
    syncSuffix: '',
    asyncSuffix: 'A',
    promiseSuffix: 'P'
};
function areCompatibleAsyncOptions(opts) {
    return _.isEqual(expectedAsyncOptions, _.defaults({}, opts, expectedAsyncOptions));
}
var dlog = debug('ts-java:main');
var bold = chalk.bold;
var error = bold.red;
var warn = bold.yellow;
var Main = (function () {
    function Main(param) {
        this.packagePath = undefined;
        this.options = undefined;
        if (typeof param === 'string') {
            this.packagePath = param;
        }
        else {
            var defaults = {
                classpath: [],
                tsJavaModulePath: 'tsJavaModule.ts',
                promisesPath: '../bluebird/bluebird.d.ts',
                javaTypingsPath: 'typings/java/java.d.ts',
                asyncOptions: expectedAsyncOptions
            };
            this.options = _.assign(defaults, param);
        }
    }
    Main.prototype.run = function () {
        var _this = this;
        return this.load()
            .then(function () { return BluePromise.join(_this.writeJsons(), _this.writeTsJavaModule()); })
            .then(function () { return dlog('run() completed.'); })
            .then(function () { return _this.outputSummaryDiagnostics(); })
            .then(function () { return _this.classesMap; });
    };
    Main.prototype.load = function () {
        var _this = this;
        var start = this.options ? this.initFromOptions() : this.initFromPackagePath();
        return start
            .then(function () { return _this.initJava(); })
            .then(function () {
            _this.classesMap = new ClassesMap(_this.options);
            return _this.classesMap.initialize();
        })
            .then(function () { return _this.classesMap; });
    };
    Main.prototype.getOptions = function () {
        return this.options;
    };
    Main.prototype.initFromPackagePath = function () {
        var _this = this;
        return readJsonPromise(this.packagePath, console.error, false)
            .then(function (packageContents) {
            if (!('tsjava' in packageContents)) {
                return BluePromise.reject(new Error('package.json does not contain a tsjava property'));
            }
            else {
                _this.options = packageContents.tsjava;
                return _this.initFromOptions();
            }
        });
    };
    Main.prototype.initFromOptions = function () {
        if (!areCompatibleAsyncOptions(this.options.asyncOptions)) {
            console.warn(warn('tsjava.asyncOptions are not compatible with the asyncOptions used in the standard typings/java/java.d.ts'));
        }
        var deprecated = _.find(this.options.packages, function (s) {
            return s.slice(-2) !== '.*' && s.slice(-3) !== '.**';
        });
        if (deprecated) {
            console.warn(warn('tsjava.packages should have expressions ending in .* or .**'));
            dlog('Deprecated package expression:', deprecated);
        }
        return BluePromise.resolve();
    };
    Main.prototype.writeJsons = function () {
        if (!program.opts().json) {
            return;
        }
        var classes = this.classesMap.getClasses();
        dlog('writeJsons() entered');
        return mkdirpPromise('o/json')
            .then(function () {
            var parray = _.map(_.keys(classes), function (className) {
                var classMap = classes[className];
                var p = writeFilePromise('o/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
                return p;
            });
            return parray;
        })
            .then(function (promises) { return BluePromise.all(promises); })
            .then(function () { return dlog('writeJsons() completed.'); });
    };
    Main.prototype.writeTsJavaModule = function () {
        var _this = this;
        dlog('writeTsJavaModule() entered');
        if (this.options.tsJavaModulePath === undefined) {
            dlog('No tsJavaModulePath specified, skipping generation.');
            return BluePromise.resolve();
        }
        else {
            var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
            var tsWriter = new CodeWriter(this.classesMap, templatesDirPath);
            return mkdirpPromise(path.dirname(this.options.tsJavaModulePath))
                .then(function () { return tsWriter.writeTsJavaModule(_this.options); })
                .then(function () { return dlog('writeTsJavaModule() completed'); });
        }
    };
    Main.prototype.checkForUnrecognizedClasses = function () {
        var allClasses = this.classesMap.getAllClasses();
        var configuredClasses = Immutable.Set(this.classesMap.getOptions().classes);
        var unrecognizedClasses = configuredClasses.subtract(allClasses);
        unrecognizedClasses.forEach(function (className) {
            console.log(warn('tsjava.classes contained classes not in classpath:'), error(className));
        });
    };
    Main.prototype.checkForUselessPackageExpresions = function () {
        var _this = this;
        var packages = Immutable.Set(this.classesMap.getOptions().packages);
        var classes = this.classesMap.getAllClasses();
        packages.forEach(function (expr) {
            var pattern = _this.classesMap.packageExpressionToRegExp(expr);
            var match = classes.some(function (className) { return pattern.test(className); });
            if (!match) {
                console.log(warn('tsjava.packages contained package expression that didn\'t match any classes in classpath:'), error(expr));
            }
        });
    };
    Main.prototype.outputSummaryDiagnostics = function () {
        if (program.opts().quiet) {
            return;
        }
        var classesMap = this.classesMap.getClasses();
        var classList = _.keys(classesMap).sort();
        if (program.opts().details) {
            console.log(bold('Generated classes:'));
            classList.forEach(function (clazz) { return console.log('  ', clazz); });
        }
        else {
            console.log('Generated %s with %d classes.', this.options.tsJavaModulePath, classList.length);
        }
        if (!this.classesMap.unhandledTypes.isEmpty()) {
            if (program.opts().details) {
                console.log(bold('Classes that were referenced, but excluded by the current configuration:'));
                this.classesMap.unhandledTypes.sort().forEach(function (clazz) { return console.log('  ', clazz); });
            }
            else {
                console.log('Excluded %d classes referenced as method parameters.', this.classesMap.unhandledTypes.size);
            }
        }
        if (!this.classesMap.unhandledInterfaces.isEmpty()) {
            if (program.opts().details) {
                console.log(warn('Classes that were referenced as *interfaces*, but excluded by the current configuration:'));
                this.classesMap.unhandledInterfaces.sort().forEach(function (clazz) { return console.log('  ', clazz); });
            }
            else {
                console.log(warn('Excluded %d classes referenced as *interfaces*.'), this.classesMap.unhandledInterfaces.size);
            }
        }
        if (!this.classesMap.unhandledSuperClasses.isEmpty()) {
            if (program.opts().details) {
                console.log(warn('Classes that were referenced as *superclasses*, but excluded by the current configuration:'));
                this.classesMap.unhandledSuperClasses.sort().forEach(function (clazz) { return console.log('  ', clazz); });
            }
            else {
                console.log(warn('Excluded %d classes referenced as *superclasses*.'), this.classesMap.unhandledSuperClasses.size);
            }
        }
        this.checkForUnrecognizedClasses();
        this.checkForUselessPackageExpresions();
        return;
    };
    Main.prototype.initJava = function () {
        var _this = this;
        var classpath = [];
        return BluePromise.all(_.map(this.options.classpath, function (globExpr) { return globPromise(globExpr); }))
            .then(function (pathsArray) { return _.flatten(pathsArray); })
            .then(function (paths) {
            _.forEach(paths, function (path) {
                dlog('Adding to classpath:', path);
                java.classpath.push(path);
                classpath.push(path);
            });
        })
            .then(function () { return findJavaHomePromise(); })
            .then(function (javaHome) {
            // Add the Java runtime library to the class path so that ts-java is aware of java.lang and java.util classes.
            var rtJarPath = path.join(javaHome, 'jre', 'lib', 'rt.jar');
            dlog('Adding rt.jar to classpath:', rtJarPath);
            classpath.push(rtJarPath);
        })
            .then(function () {
            // The classpath in options is an array of glob expressions.
            // It is convenient to replace it here with the equivalent expanded array jar file paths.
            _this.options.classpath = classpath;
        });
    };
    return Main;
})();
module.exports = Main;
//# sourceMappingURL=ts-java-main.js.map