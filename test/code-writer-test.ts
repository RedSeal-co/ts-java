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
import TsJavaOptions = require('../lib/TsJavaOptions');

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

  var options: TsJavaOptions = {
    'promisesPath': '../typings/bluebird/bluebird.d.ts',
    'outputPath': './java.d.ts',
    'classpath': null,  // initialized below
    'seedClasses': [
      'java.lang.Boolean',
      'java.lang.Double',
      'java.lang.Float',
      'java.lang.Integer',
      'java.lang.Long',
      'java.lang.Short',
      'java.util.Iterator',
      'java.util.function.Function',
      'java.lang.Number',
      'java.lang.Enum',
      'com.redseal.featureset.SomeClass',
    ],
    'whiteList': [
      'com.redseal.featureset.'
    ]
  };

  before(() => {
    var globPath = path.join('featureset', '**', '*.jar');
    return BluePromise.promisify(glob)(globPath)
      .then((filenames: Array<string>) => {
        options.classpath = filenames;
        _.forEach(filenames, (name: string) => { java.classpath.push(name); });
        var classesMap = new ClassesMap(java, options);
        return classesMap.initialize().then(() => {
          var templatesDirPath = path.resolve(__dirname, 'templates');
          theWriter = new CodeWriter(classesMap, templatesDirPath);
        });
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
      var className = 'java.util.function.Function';
      var runPromise = theWriter.streamLibraryClassFile(className, 'class_summary', streamFn, endFn).then(endFn);
      var expectedData = [
        'Class Definition for class java.util.function.Function:',
        'quotedPkgName: java.util.function_',
        'packageName: java.util.function',
        'fullName: java.util.function.Function',
        'shortName: Function',
        'alias: Function',
        'useAlias: true',
        'tsType: Function',
        'isInterface: true',
        'isPrimitive: false',
        'superclass: ',
        'interfaces: java.lang.Object',
        'tsInterfaces: Java.java.lang.Object',
        'methods: [object Object],[object Object],[object Object],[object Object]',
        'constructors: ',
        'variants: [object Object],[object Object],[object Object],[object Object]',
        'isEnum: false',
        'fields: ',
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
      var className = 'com.redseal.featureset.SomeAbstractClass';
      var runPromise = theWriter.streamLibraryClassFile(className, 'interfaces', streamFn, endFn).then(endFn);
      var expectedData = [
        'Inherited interfaces for class com.redseal.featureset.SomeAbstractClass: ',
        'Java.java.lang.Object,Java.com.redseal.featureset.SomeInterface',
        '',
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });
});
