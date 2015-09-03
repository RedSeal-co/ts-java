// classes-map-test.ts
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

describe('ClassesMap', () => {
  var expect = chai.expect;

  var tsJavaMain: TsJavaMain;
  var classesMap: ClassesMap = undefined;

  before((): BluePromise<void> => {
    process.chdir('featureset');
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

  describe('inWhiteList', () => {
    it('should return true for valid class names', () => {
      expect(classesMap.inWhiteList('java.lang.Object')).to.equal(true);
      expect(classesMap.inWhiteList('java.util.Iterator')).to.equal(true);
      expect(classesMap.inWhiteList('com.redseal.featureset.Foo')).to.equal(true);
    });
    it('should return false for invalid class names', () => {
      expect(classesMap.inWhiteList('')).to.equal(false);
      expect(classesMap.inWhiteList('com')).to.equal(false);
      expect(classesMap.inWhiteList('com.redseal.featureset')).to.equal(false);
    });
  });

  describe('shortClassName', () => {
    it('should give expected results for valid class names', () => {
      expect(classesMap.shortClassName('java.lang.Object')).to.equal('Object');
      expect(classesMap.shortClassName('java.util.Iterator')).to.equal('Iterator');
      expect(classesMap.shortClassName('com.redseal.featureset.SomeClass')).to.equal('SomeClass');
    });
  });

  describe('getClass', () => {
    it('should return a valid Class object for java.lang.Object', () => {
      var clazz = classesMap.getClass('java.lang.Object');
      expect(clazz).to.be.ok;
      expect(clazz.getName()).to.equal('java.lang.Object');
    });
    it('should fail for an invalid class name', () => {
      expect(function () { classesMap.getClass('net.lang.Object'); }).to.throw(/java.lang.ClassNotFoundException/);
    });
    it('should return a valid Class object for com.redseal.featureset.SomeClass', () => {
      var clazz = classesMap.getClass('com.redseal.featureset.SomeClass');
      expect(clazz).to.be.ok;
      expect(clazz.getName()).to.equal('com.redseal.featureset.SomeClass');
    });
  });

  describe('mapClassInterfaces', () => {
    it('should find no interfaces for java.lang.Object', () => {
      var className = 'java.lang.Object';
      var clazz = classesMap.getClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz);
      expect(interfaces).to.deep.equal([]);
    });
    it('should find the interfaces of com.redseal.featureset.SomeAbstractClass', () => {
      var className = 'com.redseal.featureset.SomeAbstractClass';
      var clazz = classesMap.getClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz);
      var expected: string[] = [ 'com.redseal.featureset.SomeInterface' ];
      expect(interfaces).to.deep.equal(expected);
    });
  });

  describe('fixClassPath', () => {
    it('it should escape components of class paths that are reserved words', () => {
      expect(classesMap.fixClassPath('java.lang.String')).to.equal('java.lang.String');
      expect(classesMap.fixClassPath('java.util.function.Function')).to.equal('java.util.function_.Function');
      expect(classesMap.fixClassPath('foo.bar.package.baloney')).to.equal('foo.bar.package_.baloney');
    });
  });

  describe('tsTypeName', () => {
    it('it should translate Java primitive types to TypeScript types for function input parameters', () => {
      expect(classesMap.tsTypeName('boolean')).to.equal('boolean_t');
      expect(classesMap.tsTypeName('double')).to.equal('double_t');
      expect(classesMap.tsTypeName('float')).to.equal('float_t');
      expect(classesMap.tsTypeName('int')).to.equal('integer_t');
      expect(classesMap.tsTypeName('long')).to.equal('long_t');
      expect(classesMap.tsTypeName('short')).to.equal('short_t');
      expect(classesMap.tsTypeName('void')).to.equal('void');
    });
    it('it should translate Java primitive types to TypeScript types for function return results', () => {
      expect(classesMap.tsTypeName('boolean', ParamContext.eReturn)).to.equal('boolean');
      expect(classesMap.tsTypeName('double', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('float', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('int', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('long', ParamContext.eReturn)).to.equal('longValue_t');
      expect(classesMap.tsTypeName('short', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('void', ParamContext.eReturn)).to.equal('void');
    });
    it('it should translate Java primitive classes to TypeScript types for function input parameters', () => {
      expect(classesMap.tsTypeName('java.lang.Boolean')).to.equal('boolean_t');
      expect(classesMap.tsTypeName('java.lang.Double')).to.equal('double_t');
      expect(classesMap.tsTypeName('java.lang.Float')).to.equal('float_t');
      expect(classesMap.tsTypeName('java.lang.Integer')).to.equal('integer_t');
      expect(classesMap.tsTypeName('java.lang.Long')).to.equal('long_t');
      expect(classesMap.tsTypeName('java.lang.Number')).to.equal('number_t');
      expect(classesMap.tsTypeName('java.lang.Short')).to.equal('short_t');
      expect(classesMap.tsTypeName('java.lang.String')).to.equal('string_t');
      expect(classesMap.tsTypeName('Ljava.lang.Object;')).to.equal('object_t');
      expect(classesMap.tsTypeName('Ljava.util.function.Function;')).to.equal('Java.Function');
    });
    it('it should translate Java primitive classes to TypeScript types for function return results', () => {
      expect(classesMap.tsTypeName('java.lang.Boolean', ParamContext.eReturn)).to.equal('boolean');
      expect(classesMap.tsTypeName('java.lang.Double', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('java.lang.Float', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('java.lang.Integer', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('java.lang.Long', ParamContext.eReturn)).to.equal('longValue_t');
      expect(classesMap.tsTypeName('java.lang.Number', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('java.lang.Short', ParamContext.eReturn)).to.equal('number');
      expect(classesMap.tsTypeName('java.lang.String', ParamContext.eReturn)).to.equal('string');
    });
    it('it should translate Java array types to TypeScript array types for function input parameters', () => {
      expect(classesMap.tsTypeName('java.lang.Object')).to.equal('object_t');
      expect(classesMap.tsTypeName('Ljava.lang.Object;')).to.equal('object_t');
      expect(classesMap.tsTypeName('[Ljava.lang.Object;')).to.equal('array_t<object_t>');
      expect(classesMap.tsTypeName('[[Ljava.lang.Object;')).to.equal('void');
      expect(classesMap.tsTypeName('[[[Ljava.lang.Object;')).to.equal('void');
      expect(classesMap.tsTypeName('[I')).to.equal('array_t<integer_t>');
      expect(classesMap.tsTypeName('[[I')).to.equal('void');
      expect(classesMap.tsTypeName('[[[I')).to.equal('void');
    });
    it('it should translate Java array types to TypeScript array types for function return results', () => {
      expect(classesMap.tsTypeName('java.lang.Object', ParamContext.eReturn)).to.equal('object_t');
      expect(classesMap.tsTypeName('Ljava.lang.Object;', ParamContext.eReturn)).to.equal('object_t');
      expect(classesMap.tsTypeName('[Ljava.lang.Object;', ParamContext.eReturn)).to.equal('object_t[]');
      expect(classesMap.tsTypeName('[[Ljava.lang.Object;', ParamContext.eReturn)).to.equal('object_t[][]');
      expect(classesMap.tsTypeName('[[[Ljava.lang.Object;', ParamContext.eReturn)).to.equal('object_t[][][]');
      expect(classesMap.tsTypeName('[I', ParamContext.eReturn)).to.equal('number[]');
      expect(classesMap.tsTypeName('[[I', ParamContext.eReturn)).to.equal('number[][]');
      expect(classesMap.tsTypeName('[[[I', ParamContext.eReturn)).to.equal('number[][][]');
    });
  });

});
