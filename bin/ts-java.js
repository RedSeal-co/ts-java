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
/// <reference path='../lib/jsonfile.d.ts' />
'use strict';
require('source-map-support').install();
var _ = require('lodash');
var BluePromise = require('bluebird');
var chalk = require('chalk');
var ClassesMap = require('../lib/classes-map');
var CodeWriter = require('../lib/code-writer');
var debug = require('debug');
var fs = require('fs');
var glob = require('glob');
var Immutable = require('immutable');
var java = require('java');
var jsonfile = require('jsonfile');
var mkdirp = require('mkdirp');
var path = require('path');
var program = require('commander');
BluePromise.longStackTraces();
var writeFilePromise = BluePromise.promisify(fs.writeFile);
var readFilePromise = BluePromise.promisify(fs.readFile);
var mkdirpPromise = BluePromise.promisify(mkdirp);
var readJsonPromise = BluePromise.promisify(jsonfile.readFile);
var globPromise = BluePromise.promisify(glob);
var dlog = debug('ts-java:main');
var error = chalk.bold.red;
var Main = (function () {
    function Main(options) {
        this.options = options;
        this.classpath = [];
        if (this.options.granularity !== 'class') {
            this.options.granularity = 'package';
        }
        if (!this.options.outputPath) {
            this.options.outputPath = 'typings/java/java.d.ts';
        }
        if (!this.options.promisesPath) {
            // TODO: Provide more control over promises
            this.options.promisesPath = '../bluebird/bluebird.d.ts';
        }
    }
    Main.prototype.run = function () {
        var _this = this;
        return this.initJava().then(function () {
            var classesMap = _this.loadClasses();
            return BluePromise.join(_this.writeJsons(classesMap.getClasses()), _this.writeInterpolatedFiles(classesMap)).then(function () { return dlog('run() completed.'); }).then(function () { return classesMap; });
        });
    };
    Main.prototype.writeInterpolatedFiles = function (classesMap) {
        return this.options.granularity === 'class' ? this.writeClassFiles(classesMap) : this.writePackageFiles(classesMap);
    };
    Main.prototype.writeJsons = function (classes) {
        dlog('writeJsons() entered');
        return mkdirpPromise('o/json').then(function () {
            return _.map(_.keys(classes), function (className) {
                var classMap = classes[className];
                return writeFilePromise('o/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
            });
        }).then(function (promises) { return BluePromise.all(promises); }).then(function () { return dlog('writeJsons() completed.'); });
    };
    Main.prototype.writeClassFiles = function (classesMap) {
        var _this = this;
        dlog('writeClassFiles() entered');
        return mkdirpPromise('o/lib').then(function () {
            var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
            var tsWriter = new CodeWriter(classesMap, templatesDirPath);
            var classes = classesMap.getClasses();
            return _.map(_.keys(classes), function (name) { return tsWriter.writeLibraryClassFile(name, _this.options.granularity); });
        }).then(function (promises) { return BluePromise.all(promises); }).then(function () { return dlog('writeClassFiles() completed.'); });
    };
    Main.prototype.writePackageFiles = function (classesMap) {
        var _this = this;
        dlog('writePackageFiles() entered');
        var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
        var tsWriter = new CodeWriter(classesMap, templatesDirPath);
        var classes = classesMap.getClasses();
        return mkdirpPromise(path.dirname(this.options.outputPath)).then(function () { return tsWriter.writePackageFile(_this.options); }).then(function () { return dlog('writePackageFiles() completed'); });
    };
    Main.prototype.initJava = function () {
        var _this = this;
        return BluePromise.all(_.map(this.options.classpath, function (globExpr) { return globPromise(globExpr); })).then(function (pathsArray) { return _.flatten(pathsArray); }).then(function (paths) {
            _.forEach(paths, function (path) {
                dlog('Adding to classpath:', path);
                java.classpath.push(path);
                _this.classpath.push(path);
            });
        });
    };
    Main.prototype.loadClasses = function () {
        var regExpWhiteList = _.map(this.options.whiteList, function (str) {
            // We used to have true regular expressions in source code.
            // Now we get the white list from the package.json, and convert the strings to RegExps.
            // But writing correct regular expressions in .json files is messy, due to json parser behavior.
            // See e.g. http://stackoverflow.com/questions/17597238/escaping-regex-to-get-valid-json
            // TODO: change the white list to be lists of packages and classes to be included.
            return new RegExp(str);
        });
        var classesMap = new ClassesMap(java, Immutable.Set(regExpWhiteList));
        classesMap.initialize(this.options.seedClasses);
        return classesMap;
    };
    return Main;
})();
var helpText = [
    '  All configuration options must be specified in a node.js package.json file, in a property tsjava.',
    '  See the README.md file for more information.'
];
program.on('--help', function () {
    _.forEach(helpText, function (line) { return console.log(chalk.bold(line)); });
});
program.parse(process.argv);
var packageJsonPath = './package.json';
readJsonPromise(packageJsonPath).then(function (packageContents) {
    if (!('tsjava' in packageContents)) {
        console.error(error('package.json does not contain a tsjava property'));
        program.help();
    }
    var main = new Main(packageContents.tsjava);
    return main.run().then(function (classesMap) {
        console.log(classesMap.unhandledTypes);
    });
}).catch(function (err) {
    if ('cause' in err && err.cause.code === 'ENOENT' && err.cause.path === packageJsonPath) {
        console.error(error('Not found:', packageJsonPath));
        program.help();
    }
    else {
        console.error(error(err));
        if (err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    }
}).done();
//# sourceMappingURL=ts-java.js.map