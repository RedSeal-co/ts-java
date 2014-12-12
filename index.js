'use strict';

var _ = require('lodash');
var assert = require('assert-plus');
var ClassesMap = require('./lib/classes-map.js');
var JavascriptWriter = require('./lib/javascript-writer.js');
var fs = require('fs');
var mkdirp = require('mkdirp');
var Work = require('./lib/work.js');

var BluePromise = require("bluebird");
BluePromise.longStackTraces();

function writeJsons(classes) {
  _.forOwn(classes, function (classMap, className) {
    fs.writeFileSync('out/json/' + classMap.shortName + '.json', JSON.stringify(classMap, null, '  '));
  });
}

function writeLib(classesMap) {
  var jsWriter = new JavascriptWriter(classesMap);
  var classes = classesMap.getClasses();
  return BluePromise.all(_.keys(classes))
    .each(function (className) {
      return jsWriter.writeLibraryClassFile(className);
    });
}

function main() {
  mkdirp.sync('out/json');
  mkdirp.sync('out/lib');
  mkdirp.sync('out/test');

  var seedClasses = ['com.tinkerpop.gremlin.structure.Graph'];
  var classesMap = new ClassesMap();
  classesMap.initialize(seedClasses);

  writeJsons(classesMap.getClasses());
  writeLib(classesMap).done();
}

main();
