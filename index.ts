/// <reference path='node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='typings/commander/commander.d.ts' />
/// <reference path='typings/glob/glob.d.ts' />
/// <reference path='typings/handlebars/handlebars.d.ts' />
/// <reference path='typings/lodash/lodash.d.ts' />
/// <reference path='typings/mkdirp/mkdirp.d.ts' />
/// <reference path='typings/node/node.d.ts' />
/// <reference path='lib/bluebird.d.ts' />

'use strict';

declare function require(name: string);
require('source-map-support').install();

import _ = require('lodash');
import BluePromise = require('bluebird');
import ClassesMap = require('./lib/classes-map');
import CodeWriter = require('./lib/code-writer');
import fs = require('fs');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import mkdirp = require('mkdirp');
import program = require('commander');
import Work = require('./lib/work');

import ClassDefinition = ClassesMap.ClassDefinition;
import ClassDefinitionMap = ClassesMap.ClassDefinitionMap;

BluePromise.longStackTraces();

class Main {

  private granularity: string;

  run(program: any): BluePromise<ClassesMap> {
    this.parseArgs(program);
    this.initJava();
    var classesMap = this.loadClasses();
    this.writeJsons(classesMap.getClasses());

    if (this.granularity === 'class') {
      return this.writeClassFiles(classesMap).then(() => classesMap);
    } else {
      return this.writePackageFiles(classesMap).then(() => classesMap);
    }
  }

  private writeJsons(classes: ClassDefinitionMap): void {
    mkdirp.sync('o/json');
    _.forOwn(classes, (classMap: ClassDefinition, className: string) => {
      fs.writeFileSync('o/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
    });
  }

  private writeClassFiles(classesMap: ClassesMap): BluePromise<any> {
    mkdirp.sync('o/lib');
    var tsWriter = new CodeWriter(classesMap, 'ts-templates');
    var classes: ClassDefinitionMap = classesMap.getClasses();
    return BluePromise.all(_.keys(classes))
      .each((className: string) => {
        return tsWriter.writeLibraryClassFile(className, this.granularity);
      });
  }

  private writePackageFiles(classesMap: ClassesMap): BluePromise<any> {
    var tsWriter = new CodeWriter(classesMap, 'ts-templates');
    var classes: ClassDefinitionMap = classesMap.getClasses();
    return tsWriter.writePackageFile();
  }

  private initJava(): void {
    var filenames = glob.sync('target/dependency/**/*.jar');
    _.forEach(filenames, (name: string) => { java.classpath.push(name); });
  }

  private loadClasses(): ClassesMap {
    var seedClasses = [
      'com.tinkerpop.gremlin.structure.Graph',
      'com.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph',
      'com.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory',
      'java.util.ArrayList'
    ];
    var classesMap = new ClassesMap(java, Immutable.Set([
        /^java\.util\./,
        /^java\.math\./,
        /^com\.tinkerpop\.gremlin\./
    ]));
    classesMap.initialize(seedClasses);
    return classesMap;
  }

  private parseArgs(program: any): void {
    var gran = program.granularity;
    if (gran !== 'class' && gran !== 'package') {
      program.help();
    }
    this.granularity = gran;
  }
}

program.usage('[options]')
  .option('-g, --granularity [package]', 'Granularity of output, \'package\' or \'class\'.', 'package')
  .parse(process.argv);

program.on('--help', () => {
    console.log('--granularity must be either \'class\' or \'package\'');
    console.log('Templates are read from ./ts-templates/*.txt, e.g. ./ts-templates/package.txt');
});

var main = new Main();
main.run(program)
  .then((classesMap: ClassesMap) => {
    console.log(classesMap.unhandledTypes);
  })
  .done();

