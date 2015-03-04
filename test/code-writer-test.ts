// code-writer-test.ts
///<reference path='../lib/java.d.ts' />
///<reference path='../node_modules/immutable/dist/immutable.d.ts'/>
///<reference path='../typings/bluebird/bluebird.d.ts' />
///<reference path='../typings/chai/chai.d.ts'/>
///<reference path='../typings/glob/glob.d.ts'/>
///<reference path='../typings/lodash/lodash.d.ts' />
///<reference path='../typings/mocha/mocha.d.ts'/>
///<reference path='../typings/node/node.d.ts'/>

'use strict';

declare function require(name: string): any;
require('source-map-support').install();

import _ = require('lodash');
import BluePromise = require('bluebird');
import chai = require('chai');
import ClassesMap = require('../lib/classes-map');
import CodeWriter = require('../lib/code-writer');
import concat = require('concat-stream');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import path = require('path');
import stream = require('stream');

BluePromise.longStackTraces();

interface StreamFunction {
  (data: string): Promise<void>;
}

interface EndFunction {
  (): Promise<void>;
}

describe('CodeWriter', () => {
  var expect = chai.expect;

  var classesMap: ClassesMap;
  var theWriter: CodeWriter;

  before(() => {
    var globPath = path.join('tinkerpop', 'target', 'dependency', '**', '*.jar');
    return BluePromise.promisify(glob)(globPath)
      .then((filenames: Array<string>) => {
        _.forEach(filenames, (name: string) => { java.classpath.push(name); });
        var classesMap = new ClassesMap(java, Immutable.Set([
          /^java\.util\.Iterator$/,
          /^java\.util\.function\./,
          /^com\.tinkerpop\.gremlin\./
        ]));
        classesMap.initialize(['com.tinkerpop.gremlin.structure.Graph']);
        var templatesDirPath = path.resolve(__dirname, 'templates');
        theWriter = new CodeWriter(classesMap, templatesDirPath);
      });
  });

  var streamFn: StreamFunction;
  var endFn: EndFunction;
  var resultPromise: Promise<any>;

  beforeEach(() => {
    var memstream: stream.Writable;
    resultPromise = new BluePromise(function (resolve: () => void, reject: (error: any) => void) {
      memstream = concat({}, resolve);
    });
    streamFn = (data: string): Promise<any> => {
      return new BluePromise(function (resolve: () => void, reject: (error: any) => void) {
        memstream.write(data, 'utf8', () => {
          resolve();
        });
      });
    };
    endFn = (): Promise<any> => {
      return new BluePromise(function (resolve: () => void, reject: (error: any) => void) {
        memstream.end();
        resolve();
      });
    };
  });


  describe('initialize', () => {
    it('should initialize', () => {
      expect(theWriter).to.be.ok;
      expect(streamFn).to.be.a('function');
      expect(endFn).to.be.a('function');
    });
    it('should make usable streamFn and endFn', () => {
      var expectedData = 'We write this data.';
      var runPromise = streamFn(expectedData).then(endFn);
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });

  describe('streamLibraryClassFile', () => {
    it('should write expected given template class_summary', () => {
      var className = 'java.util.Iterator';
      var runPromise = theWriter.streamLibraryClassFile(className, 'class_summary', streamFn, endFn).then(endFn);
      var expectedData = [
        'Class Definition for class java.util.Iterator:',
        'packageName: java.util',
        'fullName: java.util.Iterator',
        'shortName: Iterator',
        'alias: Iterator',
        'useAlias: true',
        'tsType: Iterator',
        'isInterface: true',
        'isPrimitive: false',
        'superclass: ',
        'interfaces: java.lang.Object',
        'tsInterfaces: Java.java.lang.Object',
        'methods: [object Object],[object Object],[object Object],[object Object]',
        'constructors: ',
        'variants: [object Object]',
        'isEnum: false',
        'enumConstants: ',
        ''
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
    it('should write expected given template methods', () => {
      var className = 'java.util.Iterator';
      var runPromise = theWriter.streamLibraryClassFile(className, 'methods', streamFn, endFn).then(endFn);
      var expectedData = [
        'Method signatures for class java.util.Iterator:',
        'forEachRemaining(Ljava/util/function/Consumer;)V',
        'hasNext()Z',
        'next()Ljava/lang/Object;',
        'remove()V',
        ''
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
    it('should write expected given template interfaces', () => {
      var className = 'com.tinkerpop.gremlin.structure.Edge';
      var runPromise = theWriter.streamLibraryClassFile(className, 'interfaces', streamFn, endFn).then(endFn);
      var expectedData = [
        'Inherited interfaces for class com.tinkerpop.gremlin.structure.Edge:',
        'o Element',
        'o EdgeTraversal',
        '',
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });
});
