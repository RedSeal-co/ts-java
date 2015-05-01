/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path='../typings/chalk/chalk.d.ts' />
/// <reference path='../typings/commander/commander.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path='../typings/lodash/lodash.d.ts' />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='../lib/read-package-json.d.ts' />
'use strict';
require('source-map-support').install();
var _ = require('lodash');
var BluePromise = require('bluebird');
var chalk = require('chalk');
var debug = require('debug');
var path = require('path');
var program = require('commander');
var readJson = require('read-package-json');
var Main = require('../lib/ts-java-main');
BluePromise.longStackTraces();
var readJsonPromise = BluePromise.promisify(readJson);
var dlog = debug('ts-java:main');
var bold = chalk.bold;
var error = bold.red;
var warn = bold.yellow;
var helpText = [
    '  All configuration options must be specified in a node.js package.json file,',
    '  in a property tsjava.',
    '',
    '  See the README.md file for more information.'
];
var tsJavaAppPackagePath = path.resolve(__dirname, '..', 'package.json');
var packageJsonPath = path.resolve('.', 'package.json');
var tsJavaVersion;
readJsonPromise(tsJavaAppPackagePath, console.error, false).then(function (packageContents) {
    tsJavaVersion = packageContents.version;
    console.log('ts-java version %s', tsJavaVersion);
    program.version(tsJavaVersion).option('-q, --quiet', 'Run silently with no output').option('-d, --details', 'Output diagnostic details').on('--help', function () {
        _.forEach(helpText, function (line) { return console.log(chalk.bold(line)); });
    });
    program.parse(process.argv);
}).then(function () { return readJsonPromise(packageJsonPath, console.error, false); }).then(function (packageContents) {
    if (!('tsjava' in packageContents)) {
        console.error(error('package.json does not contain a tsjava property'));
        program.help();
    }
    var main = new Main(packageContents.tsjava);
    return main.run();
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