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

declare function require(name: string): any;
require('source-map-support').install();

import _ = require('lodash');
import BluePromise = require('bluebird');
import chalk = require('chalk');
import ClassesMap = require('../lib/classes-map');
import CodeWriter = require('../lib/code-writer');
import debug = require('debug');
import findJavaHome = require('find-java-home');
import fs = require('fs');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import mkdirp = require('mkdirp');
import path = require('path');
import program = require('commander');
import readJson = require('read-package-json');
import TsJavaOptions = require('../lib/TsJavaOptions');
import Work = require('../lib/work');

import ClassDefinition = ClassesMap.ClassDefinition;
import ClassDefinitionMap = ClassesMap.ClassDefinitionMap;

BluePromise.longStackTraces();
var writeFilePromise = BluePromise.promisify(fs.writeFile);
var readFilePromise = BluePromise.promisify(fs.readFile);
var mkdirpPromise = BluePromise.promisify(mkdirp);
var readJsonPromise = BluePromise.promisify(readJson);
var globPromise = BluePromise.promisify(glob);
var findJavaHomePromise = BluePromise.promisify(findJavaHome);

var dlog = debug('ts-java:main');
var error = chalk.bold.red;
var bold = chalk.bold;

class Main {

  private options: TsJavaOptions;
  private classesMap: ClassesMap;

  constructor(options: TsJavaOptions) {
    this.options = options;
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

  run(): BluePromise<ClassesMap> {
    return this.initJava()
      .then(() => { this.classesMap = new ClassesMap(java, this.options); })
      .then(() => this.loadClasses())
      .then(() => BluePromise.join(this.writeJsons(), this.writeInterpolatedFiles(), this.writeAutoImport()))
      .then(() => dlog('run() completed.'))
      .then(() => this.outputSummaryDiagnostics())
      .then(() => this.classesMap);
  }

  private writeInterpolatedFiles() : BluePromise<void> {
    var classesMap: ClassesMap = this.classesMap;
    return this.options.granularity === 'class' ? this.writeClassFiles(classesMap) : this.writePackageFiles(classesMap);
  }

  private writeJsons(): BluePromise<void> {
    var classes: ClassDefinitionMap = this.classesMap.getClasses();
    dlog('writeJsons() entered');
    return mkdirpPromise('o/json')
      .then(() => {
        return _.map(_.keys(classes), (className: string) => {
          var classMap = classes[className];
          return writeFilePromise('o/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
        });
      })
      .then((promises: Promise<any[]>) => BluePromise.all(promises))
      .then(() => dlog('writeJsons() completed.'));
  }

  private writeClassFiles(classesMap: ClassesMap): BluePromise<void> {
    dlog('writeClassFiles() entered');
    return mkdirpPromise('o/lib')
      .then(() => {
        var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
        var tsWriter = new CodeWriter(classesMap, templatesDirPath);
        var classes: ClassDefinitionMap = classesMap.getClasses();
        return _.map(_.keys(classes), (name: string) => tsWriter.writeLibraryClassFile(name, this.options.granularity));
      })
      .then((promises: Promise<any[]>) => BluePromise.all(promises))
      .then(() => dlog('writeClassFiles() completed.'));
  }

  private writePackageFiles(classesMap: ClassesMap): BluePromise<void> {
    dlog('writePackageFiles() entered');
    var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
    var tsWriter = new CodeWriter(classesMap, templatesDirPath);
    return mkdirpPromise(path.dirname(this.options.outputPath))
      .then(() => tsWriter.writePackageFile(this.options))
      .then(() => dlog('writePackageFiles() completed'));
  }

  private writeAutoImport(): BluePromise<void> {
    dlog('writeAutoImport() entered');
    if (this.options.autoImportPath === undefined) {
      return BluePromise.resolve();
    } else {
      var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
      var tsWriter = new CodeWriter(this.classesMap, templatesDirPath);
      return mkdirpPromise(path.dirname(this.options.autoImportPath))
        .then(() => tsWriter.writeAutoImportFile(this.options))
        .then(() => dlog('writeAutoImport() completed'));
    }
  }

  private outputSummaryDiagnostics(): BluePromise<void> {
    if (program.opts().quiet) {
      return;
    }

    var warn = chalk.bold.yellow;
    console.log('ts-java version %s', tsJavaVersion);

    var classesMap: ClassDefinitionMap = this.classesMap.getClasses();
    var classList = _.keys(classesMap).sort();
    if (program.opts().details) {
      console.log(bold('Generated classes:'));
      classList.forEach((clazz: string) => console.log('  ', clazz));
    } else {
      console.log('Generated %s with %d classes.', this.options.outputPath, classList.length);
    }

    if (!this.classesMap.unhandledTypes.isEmpty()) {
      if (program.opts().details) {
        console.log(bold('Classes that were referenced, but excluded by the current configuration:'));
        this.classesMap.unhandledTypes.sort().forEach((clazz: string) => console.log('  ', clazz));
      } else {
       console.log('Excluded %d classes referenced as method parameters.', this.classesMap.unhandledTypes.size);
      }
    }

    if (!this.classesMap.unhandledInterfaces.isEmpty()) {
      if (program.opts().details) {
        console.log(warn('Classes that were referenced as *interfaces*, but excluded by the current configuration:'));
        this.classesMap.unhandledInterfaces.sort().forEach((clazz: string) => console.log('  ', clazz));
      } else {
        console.log(warn('Excluded %d classes referenced as *interfaces*.'), this.classesMap.unhandledInterfaces.size);
      }
    }

    if (!this.classesMap.unhandledSuperClasses.isEmpty()) {
      if (program.opts().details) {
        console.log(warn('Classes that were referenced as *superclasses*, but excluded by the current configuration:'));
        this.classesMap.unhandledSuperClasses.sort().forEach((clazz: string) => console.log('  ', clazz));
      } else {
        console.log(warn('Excluded %d classes referenced as *superclasses*.'), this.classesMap.unhandledSuperClasses.size);
      }
    }

    return;
  }

  private initJava(): BluePromise<void> {
    var classpath: Array<string> = [];
    return BluePromise.all(_.map(this.options.classpath, (globExpr: string) => globPromise(globExpr)))
      .then((pathsArray: Array<Array<string>>) => _.flatten(pathsArray))
      .then((paths: Array<string>) => {
        _.forEach(paths, (path: string) => {
          dlog('Adding to classpath:', path);
          java.classpath.push(path);
          classpath.push(path);
        });
      })
      .then(() => findJavaHomePromise())
      .then((javaHome: string) => {
        // Add the Java runtime library to the class path so that ts-java is aware of java.lang and java.util classes.
        var rtJarPath = path.join(javaHome, 'jre', 'lib', 'rt.jar');
        dlog('Adding rt.jar to classpath:', rtJarPath);
        classpath.push(rtJarPath);
      })
      .then(() => {
        // The classpath in options is an array of glob expressions.
        // It is convenient to replace it here with the equivalent expanded array jar file paths.
        this.options.classpath = classpath;
      });
  }

  private loadClasses(): BluePromise<ClassesMap> {
    return this.classesMap.initialize()
      .then(() => this.classesMap);
  }
}

var helpText = [
'  All configuration options must be specified in a node.js package.json file,',
'  in a property tsjava.',
'',
'  See the README.md file for more information.'
];

var tsJavaAppPackagePath = path.resolve(__dirname, '..', 'package.json');
var packageJsonPath = path.resolve('.', 'package.json');
var tsJavaVersion: string;

readJsonPromise(tsJavaAppPackagePath, console.error, false)
  .then((packageContents: any) => {
    tsJavaVersion = packageContents.version;

    program
      .version(tsJavaVersion)
      .option('-q, --quiet', 'Run silently with no output')
      .option('-d, --details', 'Output diagnostic details')
      .on('--help', () => {
        _.forEach(helpText, (line: string) => console.log(chalk.bold(line)));
      });

    program.parse(process.argv);
  })
  .then(() => readJsonPromise(packageJsonPath, console.error, false))
  .then((packageContents: any) => {

    if (!('tsjava' in packageContents)) {
      console.error(error('package.json does not contain a tsjava property'));
      program.help();
    }

    var main = new Main(packageContents.tsjava);
    return main.run();
  })
  .catch((err: any) => {
    if ('cause' in err && err.cause.code === 'ENOENT' && err.cause.path === packageJsonPath) {
      console.error(error('Not found:', packageJsonPath));
      program.help();
    } else {
      console.error(error(err));
      if (err.stack) {
        console.error(err.stack);
      }
      process.exit(1);
    }
  })
  .done();
