// generics-test.ts
///<reference path='../lib/find-java-home.d.ts' />
///<reference path='../node_modules/immutable/dist/immutable.d.ts'/>
///<reference path='../typings/chai/chai.d.ts'/>
///<reference path='../typings/glob/glob.d.ts' />
///<reference path='../typings/lodash/lodash.d.ts' />
///<reference path='../typings/mocha/mocha.d.ts'/>
///<reference path='../typings/node/node.d.ts'/>

'use strict';

declare function require(name: string): any;
require('source-map-support').install();

import _ = require('lodash');
import BluePromise = require('bluebird');
import { ClassesMap, ParamContext } from '../lib/classes-map';
import chai = require('chai');
import debug = require('debug');
import findJavaHome = require('find-java-home');
import glob = require('glob');
import Immutable = require('immutable');
import path = require('path');
import TsJavaOptions = require('../lib/TsJavaOptions');
import TsJavaMain = require('../lib/ts-java-main');
import Work = require('../lib/work');

import reflection = require('../lib/reflection');

var dlog = debug('ts-java:classes-map-test');
var findJavaHomePromise = BluePromise.promisify(findJavaHome);
var globPromise = BluePromise.promisify(glob);

/* tslint:disable:max-line-length */


describe('ClassesMap - Generics', () => {
  var expect = chai.expect;

  var tsJavaMain: TsJavaMain;
  var classesMap: ClassesMap = undefined;

  before((): BluePromise<void> => {
    process.chdir('generics');
    expect(classesMap).to.not.exist;
    tsJavaMain = new TsJavaMain(path.join('package.json'));
    return tsJavaMain.load().then((_classesMap: ClassesMap) => {
      classesMap = _classesMap;
      process.chdir('..');
      return BluePromise.resolve();
    });
  });

  describe('initialize', () => {
    it('should initialize', () => {
      expect(classesMap).to.be.ok;
    });
  });

  describe('fixGenericNestedTypeName', () => {
    it('nominal', () => {
      expect(classesMap.fixGenericNestedTypeName('a.b.c.a.b.c$d')).to.be.equal('a.b.c$d');
      expect(classesMap.fixGenericNestedTypeName('java.util.Map.java.util.Map$Entry<K, V>')).to.be.equal('java.util.Map$Entry<K, V>');
      expect(classesMap.fixGenericNestedTypeName('java.util.stream.Stream.java.util.stream.Stream$Builder<T>')).to.be.equal('java.util.stream.Stream$Builder<T>');
    });
  });

  describe('translateGenericProto', () => {
    it('simple case', () => {
      var p = 'public T java.lang.Class.cast(java.lang.Object)';
      var expected = {
        methodName: 'cast',
        gentypes: '',
        returns: 'T',
        params: [
          'java.lang.Object'
        ]
      };
      expect(classesMap.translateGenericProto(p)).to.deep.equal(expected);
    });
    it('complex case', () => {
      var p = 'public static <T,A,R,RR> java.util.stream.Collector<T, A, RR> java.util.stream.Collectors.collectingAndThen(java.util.stream.Collector<T, A, R>,java.util.function.Function<R, RR>)';
      var expected = {
        methodName: 'collectingAndThen',
        gentypes: '<T,A,R,RR>',
        returns: 'java.util.stream.Collector<T, A, RR>',
        params: [
          'java.util.stream.Collector<T, A, R>',
          'java.util.function.Function<R, RR>'
        ]
      };
      expect(classesMap.translateGenericProto(p)).to.deep.equal(expected);
    });
  });

});
