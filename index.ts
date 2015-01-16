/// <reference path='node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='typings/handlebars/handlebars.d.ts' />
/// <reference path='typings/lodash/lodash.d.ts' />
/// <reference path='typings/minimist/minimist.d.ts' />
/// <reference path='typings/mkdirp/mkdirp.d.ts' />
/// <reference path='typings/node/node.d.ts' />
/// <reference path='lib/bluebird.d.ts' />
/// <reference path='lib/glob.d.ts' />

'use strict';

import _ = require('lodash');
import BluePromise = require('bluebird');
import ClassesMap = require('./lib/classes-map');
import CodeWriter = require('./lib/code-writer');
import fs = require('fs');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import minimist = require('minimist');
import mkdirp = require('mkdirp');
import Work = require('./lib/work');

import IClassDefinition = ClassesMap.IClassDefinition;
import IClassDefinitionMap = ClassesMap.IClassDefinitionMap;

BluePromise.longStackTraces();

class Main {

  private granularity: string;

  writeJsons(classes: IClassDefinitionMap): void {
    mkdirp.sync('out/json');
    _.forOwn(classes, (classMap: IClassDefinition, className: string) => {
      fs.writeFileSync('out/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
    });
  }

  writeClassFiles(classesMap: ClassesMap): BluePromise<any> {
    mkdirp.sync('out/lib');
    var tsWriter = new CodeWriter(classesMap, 'ts-templates');
    var classes: IClassDefinitionMap = classesMap.getClasses();
    return BluePromise.all(_.keys(classes))
      .each((className: string) => {
        return tsWriter.writeLibraryClassFile(className, this.granularity);
      });
  }

  writePackageFiles(classesMap: ClassesMap): BluePromise<any> {
    var tsWriter = new CodeWriter(classesMap, 'ts-templates');
    var classes: IClassDefinitionMap = classesMap.getClasses();
    return tsWriter.writePackageFile();
  }

  initJava(): void {
    var filenames = glob.sync('test/**/*.jar');
    _.forEach(filenames, (name: string) => { java.classpath.push(name); });
  }

  loadClasses(): ClassesMap {
    var seedClasses = ['com.tinkerpop.gremlin.structure.Graph'];
    var classesMap = new ClassesMap(java, Immutable.Set([
        /^java\.util\.(\w+)$/,
        /^java\.util\.function\.(\w+)$/,
        /^com\.tinkerpop\.gremlin\./
    ]));
    classesMap.initialize(seedClasses);
    return classesMap;
  }

  usage(): void {
    console.log('Usage: node index.js [options]');
    console.log('  options:');
    console.log('    -h --help:           print this usage summary');
    console.log('    -g --granularity (\'class\'|\'package\') [default: \'package\'] ');
    console.log(' Templates are read from ./ts-templates/*.txt');
  }

  parseArgs(argv: any): void {
    if ('help' in argv || 'h' in argv) {
      return this.usage();
    }
    var gran = argv.g || argv.granularity || 'package';
    if (gran !== 'class' && gran !== 'package') {
      console.error('--granularity must be either \'class\' or \'package\'');
      return this.usage();
    }
    this.granularity = gran;
  }

  run(argv: minimist.ParsedArgs): BluePromise<any> {
    this.parseArgs(argv);
    this.initJava();
    var classesMap = this.loadClasses();
    this.writeJsons(classesMap.getClasses());

    if (this.granularity === 'class') {
      return this.writeClassFiles(classesMap);
    } else {
      return this.writePackageFiles(classesMap);
    }
  }
}

var argv = minimist(process.argv.slice(2));

var main = new Main();
main.run(argv).done();

