/// <reference path='node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='typings/handlebars/handlebars.d.ts' />
/// <reference path='typings/lodash/lodash.d.ts' />
/// <reference path='typings/mkdirp/mkdirp.d.ts' />
/// <reference path='typings/node/node.d.ts' />
/// <reference path='lib/bluebird.d.ts' />
/// <reference path='lib/glob.d.ts' />

'use strict';

import _ = require('lodash');
import BluePromise = require('bluebird');
import _ClassesMap = require('./lib/classes-map');
import CodeWriter = require('./lib/code-writer');
import fs = require('fs');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import mkdirp = require('mkdirp');
import Work = require('./lib/work');

import ClassesMap = _ClassesMap.ClassesMap;
import IClassDefinition = _ClassesMap.IClassDefinition;
import IClassDefinitionMap = _ClassesMap.IClassDefinitionMap;

BluePromise.longStackTraces();

function writeJsons(classes: IClassDefinitionMap): void {
  _.forOwn(classes, (classMap: IClassDefinition, className: string) => {
    fs.writeFileSync('out/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
  });
}

function writeLib(classesMap: ClassesMap): BluePromise<any> {
  var tsWriter = new CodeWriter(classesMap, 'ts-templates');
  var classes: IClassDefinitionMap = classesMap.getClasses();
  return BluePromise.all(_.keys(classes))
    .each(function (className: string) {
      return tsWriter.writeLibraryClassFile(className);
    });
}

function main(): void {
  mkdirp.sync('out/json');
  mkdirp.sync('out/lib');

  var filenames = glob.sync('test/**/*.jar');
  _.forEach(filenames, (name: string) => { java.classpath.push(name); });

  var seedClasses = ['com.tinkerpop.gremlin.structure.Graph'];
  var classesMap = new ClassesMap(java, Immutable.Set([
      /^java\.util\.(\w+)$/,
      /^java\.util\.function\.(\w+)$/,
      /^com\.tinkerpop\.gremlin\./
  ]));
  classesMap.initialize(seedClasses);

  writeJsons(classesMap.getClasses());
  writeLib(classesMap).done();
}

main();
