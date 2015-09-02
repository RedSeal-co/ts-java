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

import _ = require('lodash');
import AsyncOptions = require('./AsyncOptions');
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

import ClassDefinition = ClassesMap.ClassDefinition;
import ClassDefinitionMap = ClassesMap.ClassDefinitionMap;

// Typescript & bluebird.promisify needs some assistance with functions such as fs.writefile.
// Node.d.ts declares writeFile as follows, with the exception that the callback argument is declared optional.
interface WriteFile {
  (filename: string, data: any, callback: (err: NodeJS.ErrnoException) => void): void;
}

BluePromise.longStackTraces();
var writeFilePromise = BluePromise.promisify(<WriteFile> fs.writeFile);
var readFilePromise = BluePromise.promisify(fs.readFile);
var mkdirpPromise = BluePromise.promisify(mkdirp);
var readJsonPromise = BluePromise.promisify(readJson);
var globPromise = BluePromise.promisify(glob);
var findJavaHomePromise = BluePromise.promisify(findJavaHome);

// ts-java must use asyncOptions that are 'compatible' with the java/java.d.ts in Definitely typed,
// which uses the following settings.
// Options are incompatible if a different value is defined for any of the three properties,
// but any of them can be left undefined.
var expectedAsyncOptions: AsyncOptions = {
  syncSuffix: '',
  asyncSuffix: 'A',
  promiseSuffix: 'P'
};

function areCompatibleAsyncOptions(opts: AsyncOptions): boolean {
  return _.isEqual(expectedAsyncOptions, _.defaults({}, opts, expectedAsyncOptions));
}

interface Func {
  (result: any): void;
}

var dlog = debug('ts-java:main');
var bold = chalk.bold;
var error = bold.red;
var warn = bold.yellow;

class Main {

  private packagePath: string;
  private options: TsJavaOptions;
  private classesMap: ClassesMap;

  constructor(param: TsJavaOptions | string) {
    this.packagePath = undefined;
    this.options = undefined;
    if (typeof param === 'string') {
      this.packagePath = param;
    } else {
      this.options = param;
    }
  }

  run(): BluePromise<ClassesMap> {
    return this.load()
      .then(() => BluePromise.join(this.writeJsons(), this.writeInterpolatedFiles(), this.writeTsJavaModule()))
      .then(() => dlog('run() completed.'))
      .then(() => this.outputSummaryDiagnostics())
      .then(() => this.classesMap);
  }

  load(): BluePromise<ClassesMap> {
    var start: BluePromise<void> = this.options ? this.initFromOptions() : this.initFromPackagePath();
    return start
      .then(() => this.initJava())
      .then(() => {
        this.classesMap = new ClassesMap(this.options);
        return this.classesMap.initialize();
      })
      .then(() => this.classesMap);
  }

  getOptions(): TsJavaOptions {
    return this.options;
  }

  private initFromPackagePath(): BluePromise<void> {
    return readJsonPromise(this.packagePath, console.error, false)
      .then((packageContents: any) => {
        if (!('tsjava' in packageContents)) {
          return BluePromise.reject(new Error('package.json does not contain a tsjava property'));
        } else {
          this.options = packageContents.tsjava;
          return this.initFromOptions();
        }
      });
  }

  private initFromOptions(): BluePromise<void>  {
    if (this.options.granularity !== 'class') {
      this.options.granularity = 'package';
    }
    if (!this.options.promisesPath) {
      // TODO: Provide more control over promises
      this.options.promisesPath = '../bluebird/bluebird.d.ts';
    }
    if (!this.options.javaTypingsPath) {
      this.options.javaTypingsPath = 'typings/java/java.d.ts';
    }
    if (!this.options.asyncOptions) {
      this.options.asyncOptions = expectedAsyncOptions;
    } else if (!areCompatibleAsyncOptions(this.options.asyncOptions)) {
      console.warn(warn('tsjava.asyncOptions are not compatible with the asyncOptions used in the standard typings/java/java.d.ts'));
    }
    if (!this.options.packages && this.options.whiteList) {
      console.warn(warn('tsjava.whiteList in package.json is deprecated. Please use tsjava.packages instead.'));
      this.options.packages = this.options.whiteList;
      this.options.whiteList = undefined;
    }
    var deprecated: string = _.find(this.options.packages, (s: string) => {
      return s.slice(-2) !== '.*' && s.slice(-3) !== '.**';
    });
    if (deprecated) {
      console.warn(warn('tsjava.packages should have expressions ending in .* or .**'));
      dlog('Deprecated package expression:', deprecated);
    }
    return BluePromise.resolve();
  }

  private writeInterpolatedFiles() : BluePromise<void> {
    var classesMap: ClassesMap = this.classesMap;
    return this.options.granularity === 'class' ? this.writeClassFiles(classesMap) : this.writePackageFiles(classesMap);
  }

  private writeJsons(): BluePromise<void> {
    if (!program.opts().json) {
      return;
    }

    var classes: ClassDefinitionMap = this.classesMap.getClasses();
    dlog('writeJsons() entered');
    return mkdirpPromise('o/json')
      .then(() => {
        var parray: BluePromise<void>[] = _.map(_.keys(classes), (className: string) => {
          var classMap = classes[className];
          var p: BluePromise<any> = writeFilePromise('o/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
          return p;
        });
        return parray;
      })
      .then((promises: BluePromise<void>[]) => BluePromise.all(promises))
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
      .then((promises: Promise<any>[]) => BluePromise.all(promises))
      .then(() => dlog('writeClassFiles() completed.'));
  }

  private writePackageFiles(classesMap: ClassesMap): BluePromise<void> {
    dlog('writePackageFiles() entered');
    if (!this.options.outputPath) {
      dlog('No java.d.ts outputPath specified, skipping generation.');
      return BluePromise.resolve();
    } else {
      var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
      var tsWriter = new CodeWriter(classesMap, templatesDirPath);
      return mkdirpPromise(path.dirname(this.options.outputPath))
        .then(() => tsWriter.writePackageFile(this.options))
        .then(() => dlog('writePackageFiles() completed'));
    }
  }

  private writeTsJavaModule(): BluePromise<void> {
    dlog('writeTsJavaModule() entered');
    if (this.options.tsJavaModulePath === undefined) {
      dlog('No tsJavaModulePath specified, skipping generation.');
      return BluePromise.resolve();
    } else {
      var templatesDirPath = path.resolve(__dirname, '..', 'ts-templates');
      var tsWriter = new CodeWriter(this.classesMap, templatesDirPath);
      return mkdirpPromise(path.dirname(this.options.tsJavaModulePath))
        .then(() => tsWriter.writeTsJavaModule(this.options))
        .then(() => dlog('writeTsJavaModule() completed'));
    }
  }

  private checkForUnrecognizedClasses(): void {
    var allClasses: Immutable.Set<string> = this.classesMap.getAllClasses();
    var configuredClasses = Immutable.Set<string>(this.classesMap.getOptions().classes);
    var unrecognizedClasses = configuredClasses.subtract(allClasses);
    unrecognizedClasses.forEach((className: string) => {
      console.log(warn('tsjava.classes contained classes not in classpath:'), error(className));
    });
  }

  private checkForUselessPackageExpresions(): void {
    var packages: Immutable.Set<string> = Immutable.Set<string>(this.classesMap.getOptions().packages);
    var classes: Immutable.Set<string> = this.classesMap.getAllClasses();

    packages.forEach((expr: string) => {
      var pattern = this.classesMap.packageExpressionToRegExp(expr);
      var match: boolean = classes.some((className: string) => pattern.test(className));
      if (!match) {
        console.log(warn('tsjava.packages contained package expression that didn\'t match any classes in classpath:'),
                    error(expr));
      }
    });
  }

  private outputSummaryDiagnostics(): BluePromise<void> {
    if (program.opts().quiet) {
      return;
    }

    var classesMap: ClassDefinitionMap = this.classesMap.getClasses();
    var classList = _.keys(classesMap).sort();
    if (program.opts().details) {
      console.log(bold('Generated classes:'));
      classList.forEach((clazz: string) => console.log('  ', clazz));
    } else {
      // TODO: remove support for generating java.d.ts files.
      if (this.options.outputPath) {
        console.log('Generated %s with %d classes.', this.options.outputPath, classList.length);
      }
      // TODO: always generate tsJavaModule.ts files, by using a default when value not specified.
      if (this.options.tsJavaModulePath) {
        console.log('Generated %s with %d classes.', this.options.tsJavaModulePath, classList.length);
      }
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

    this.checkForUnrecognizedClasses();
    this.checkForUselessPackageExpresions();

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
}

export = Main;
