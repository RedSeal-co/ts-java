// code-writer-test.ts
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
import path = require('path');
import stream = require('stream');
import TsJavaOptions = require('../lib/TsJavaOptions');
import TsJavaMain = require('../lib/ts-java-main');

BluePromise.longStackTraces();

interface StreamFunction {
  (data: string): Promise<void>;
}

interface EndFunction {
  (): Promise<void>;
}

describe('CodeWriter', () => {
  var expect = chai.expect;

  var tsJavaMain: TsJavaMain;
  var classesMap: ClassesMap;
  var theWriter: CodeWriter;

  before(() => {
    process.chdir('featureset');
    tsJavaMain = new TsJavaMain(path.join('package.json'));
    return tsJavaMain.load().then((_classesMap: ClassesMap) => {
      classesMap = _classesMap;
      process.chdir('..');
      var templatesDirPath = path.resolve(__dirname, 'templates');
      theWriter = new CodeWriter(classesMap, templatesDirPath);
      return BluePromise.resolve();
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
        'genericName: public abstract interface java.util.function.Function<T,R>',
        'fullName: java.util.function.Function',
        'shortName: Function',
        'typeParms: T,R',
        'alias: Function',
        'useAlias: true',
        'tsType: Java.Function',
        'isInterface: true',
        'isPrimitive: false',
        'superclass: ',
        'interfaces: java.lang.Object',
        'tsInterfaces: Java.java.lang.Object',
        'genericInterfaces: ',
        'methods: [object Object],[object Object],[object Object],[object Object]',
        'constructors: ',
        'variantsDict: [object Object]',
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

  describe('streamPackageFile header', () => {
    it('should write a java.d.ts stream with the expected reference paths', () => {
      var className = 'com.redseal.featureset.SomeAbstractClass';
      var options = tsJavaMain.getOptions();
      // We are close to removing ts-java feature to generate java.d.ts files, and have already
      // removed the option in featureset/package.json. For now, we set the outputPath to arbitrary
      // string for this unit test.
      // TODO: remove this unit test entirely when we remove support for java.d.ts files.
      options.outputPath = 'placeholder output path';
      var runPromise = theWriter.streamPackageFile(tsJavaMain.getOptions(), streamFn, endFn).then(endFn);
      var expectedData = [
        '// placeholder output path',
        '// This file was generated by ts-java.',
        '/// <reference path="typings/bluebird/bluebird.d.ts" />',
        '',
        '// This template intentionally blank',
        ''
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });

  describe('streamTsJavaModule header', () => {
    it('should write a java.d.ts stream with the expected reference paths', () => {
      var className = 'com.redseal.featureset.SomeAbstractClass';
      var runPromise = theWriter.streamTsJavaModule(tsJavaMain.getOptions(), streamFn, endFn).then(endFn);
      var expectedData = [
        '// tsJavaModule.ts',
        '// This file was generated by ts-java.',
        '/// <reference path=\"../typings/java/java.d.ts\" />',
        '/// <reference path=\"../typings/lodash/lodash.d.ts\" />',
        '/// <reference path=\"../typings/debug/debug.d.ts\" />',
        '',
        'import java = require(\'java\');',
        '// This template intentionally mostly blank',
        ''
      ].join('\n');
      return BluePromise.all([runPromise, resultPromise])
        .spread(function (ignore: any, data: string) {
          expect(data).to.equal(expectedData);
        });
    });
  });
});
