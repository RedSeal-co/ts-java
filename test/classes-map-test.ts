// classes-map-test.ts
///<reference path='../lib/java.d.ts' />
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
import ClassesMap = require('../lib/classes-map');
import chai = require('chai');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import ParamContext = require('../lib/paramcontext');
import TsJavaOptions = require('../lib/TsJavaOptions');
import Work = require('../lib/work');

describe('ClassesMap', () => {
  var expect = chai.expect;

  var classesMap: ClassesMap;

  before(() => {
    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    _.forEach(filenames, (name: string) => { java.classpath.push(name); });
  });

  var options: TsJavaOptions = {
    'promisesPath': '../typings/bluebird/bluebird.d.ts',
    'outputPath': './java.d.ts',
    'classpath': [
      'tinkerpop/target/dependency/**/*.jar'
    ],
    'seedClasses': [
      'java.lang.Boolean',
      'java.lang.Double',
      'java.lang.Float',
      'java.lang.Integer',
      'java.lang.Long',
      'java.lang.Short',
      'java.util.Iterator',
      'java.lang.Number',
      'java.lang.Enum'
    ],
    'whiteList': [
      'com.tinkerpop.gremlin.',
      'java.util.function.',
    ]
  };

  beforeEach(() => {
    classesMap = new ClassesMap(java, options);
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
      expect(classesMap.inWhiteList('com.tinkerpop.gremlin.')).to.equal(true);
      expect(classesMap.inWhiteList('com.tinkerpop.gremlin.Foo')).to.equal(true);
    });
    it('should return false for invalid class names', () => {
      expect(classesMap.inWhiteList('')).to.equal(false);
      expect(classesMap.inWhiteList('com')).to.equal(false);
      expect(classesMap.inWhiteList('java.util.Iterators')).to.equal(false);
      expect(classesMap.inWhiteList('com.tinkerpop.gremlin')).to.equal(false);
      expect(classesMap.inWhiteList('com.tinkerpop.Gremlin.Foo')).to.equal(false);
    });
  });

  describe('shortClassName', () => {
    it('should give expected results for valid class names', () => {
      expect(classesMap.shortClassName('java.lang.Object')).to.equal('Object');
      expect(classesMap.shortClassName('java.util.Iterator')).to.equal('Iterator');
      expect(classesMap.shortClassName('com.tinkerpop.gremlin.Foo')).to.equal('Foo');
    });
  });

  describe('loadClass', () => {
    it('should return a valid Class object for a loadable class', () => {
      var clazz = classesMap.loadClass('java.lang.Object');
      expect(clazz).to.be.ok;
      expect(clazz.getNameSync()).to.equal('java.lang.Object');
    });
    it('should fail for an invalid class name', () => {
      expect(function () { classesMap.loadClass('net.lang.Object'); }).to.throw(/java.lang.ClassNotFoundException/);
    });
  });

  describe('mapClassInterfaces', () => {
    it('should find no interfaces for java.lang.Object', () => {
      var className = 'java.lang.Object';
      var work = new Work();
      work.addTodo(className);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      expect(interfaces).to.deep.equal([]);
    });
    it('should find one interface for java.util.Iterator', () => {
      var className = 'java.util.Iterator';
      var work = new Work();
      work.addTodo(className);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      var expected = ['java.lang.Object'];
      expect(interfaces).to.deep.equal(expected);
      work.setDone(className);
      expect(work.getTodo().toArray()).to.deep.equal(expected);
    });
    it('should find the interfaces of com.tinkerpop.gremlin.structure.Edge', () => {
      var className = 'com.tinkerpop.gremlin.structure.Edge';
      var work = new Work();
      work.addTodo(className);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      var expected = [
        'com.tinkerpop.gremlin.structure.Element',
        'com.tinkerpop.gremlin.process.graph.EdgeTraversal'
      ];
      expect(interfaces).to.deep.equal(expected);
      work.setDone(className);
      expect(work.getTodo().toArray().sort()).to.deep.equal(expected.sort());
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
      expect(classesMap.tsTypeName('Ljava.util.function.Function;')).to.equal('Function');
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

  describe('mapMethod', () => {
    it('should map java.lang.Object:hashCode', () => {
      var className = 'java.lang.Object';
      var work = new Work();
      work.addTodo(className);
      var clazz = classesMap.loadClass(className);
      expect(clazz).to.be.ok;
      var methods = clazz.getDeclaredMethodsSync();
      var method = _.find(methods, (method: Java.Method) => { return method.getNameSync() === 'hashCode'; });
      expect(method).to.be.ok;
      var methodMap = classesMap.mapMethod(method, work);
      expect(methodMap).to.be.ok;
      var expected = { name: 'hashCode',
        declared: 'java.lang.Object',
        returns: 'int',
        paramTypes: new Array<string>(),
        paramNames: new Array<string>(),
        isVarArgs: false,
        isStatic: false,
        generic_proto: 'public native int java.lang.Object.hashCode()',
        plain_proto: 'public native int java.lang.Object.hashCode()',
        signature: 'hashCode()I',
        tsParamTypes: new Array<string>(),
        tsReturns: 'number'
      };
      expect(methodMap).to.deep.equal(expected);
    });
  });

  describe('mapClassMethods', () => {
    it('should load all methods of java.lang.Object', () => {
      var className = 'java.lang.Object';
      var work = new Work();
      work.addTodo(className);
      var clazz = classesMap.loadClass(className);
      var methods = classesMap.mapClassMethods(className, clazz, work);
      expect(methods).to.be.an('array');
      expect(methods).to.have.length(9);
      var names = _.pluck(methods, 'name').sort();
      var expectedNames = ['equals', 'getClass', 'hashCode', 'notify', 'notifyAll', 'toString', 'wait', 'wait', 'wait'];
      expect(names).to.deep.equal(expectedNames);
      var signatures = _.pluck(methods, 'signature').sort();
      var expectedSignatures = [
        'equals(Ljava/lang/Object;)Z',
        'getClass()Ljava/lang/Class;',
        'hashCode()I',
        'notify()V',
        'notifyAll()V',
        'toString()Ljava/lang/String;',
        'wait()V',
        'wait(J)V',
        'wait(JI)V'
      ];
      expect(signatures).to.deep.equal(expectedSignatures);
    });
  });

  describe('mapClass', () => {
    it('should map the properties of java.util.Iterator', () => {
      var className = 'java.util.Iterator';
      var work = new Work();
      work.addTodo(className);
      var classMap = classesMap.mapClass(className, work);
      expect(classMap).to.be.ok;
      expect(classMap).to.have.keys([
        'alias',
        'constructors',
        'fields',
        'fullName',
        'interfaces',
        'isEnum',
        'isInterface',
        'isPrimitive',
        'methods',
        'packageName',
        'quotedPkgName',
        'shortName',
        'superclass',
        'tsInterfaces',
        'tsType',
        'useAlias',
        'variants'
      ]);
      expect(classMap.fullName).to.equal(className);
      expect(classMap.shortName).to.equal('Iterator');
      expect(classMap.interfaces).to.deep.equal(['java.lang.Object']);
      var methodSignatures = _.pluck(classMap.methods, 'signature').sort();
      var expectedSignatures = [
        'forEachRemaining(Ljava/util/function/Consumer;)V',
        'hasNext()Z',
        'next()Ljava/lang/Object;',
        'remove()V'
      ];
      expect(methodSignatures).to.deep.equal(expectedSignatures);
    });
  });

  describe('loadAllClasses', () => {
    it('should load all classes reachable from java.util.Iterator', () => {
      classesMap.loadAllClasses(['java.util.Iterator']);
      var classes = classesMap.getClasses();
      expect(classes).to.be.an('object');
      var classNames = _.keys(classes).sort();
      expect(classNames).to.deep.equal([
        'java.lang.Object',
        'java.lang.String',
        'java.util.Iterator',
        'java.util.function.Consumer'
      ]);
    });
    it('should load all classes reachable from com.tinkerpop.gremlin.structure.Graph', () => {
      var work = classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      expect(classes).to.be.an('object');
      var someExpectedClasses = [
        'com.tinkerpop.gremlin.process.graph.EdgeTraversal',
        'com.tinkerpop.gremlin.process.graph.ElementTraversal',
        'com.tinkerpop.gremlin.process.graph.GraphTraversal',
        'com.tinkerpop.gremlin.process.graph.VertexPropertyTraversal',
        'com.tinkerpop.gremlin.process.graph.VertexTraversal',
        'com.tinkerpop.gremlin.process.Path',
        'com.tinkerpop.gremlin.process.Step',
        'com.tinkerpop.gremlin.process.T',
        'com.tinkerpop.gremlin.process.Traversal',
        'com.tinkerpop.gremlin.process.TraversalEngine',
        'com.tinkerpop.gremlin.process.Traverser',
        'com.tinkerpop.gremlin.process.Traverser$Admin',
        'com.tinkerpop.gremlin.structure.Direction',
        'com.tinkerpop.gremlin.structure.Edge',
        'com.tinkerpop.gremlin.structure.Edge$Iterators',
        'com.tinkerpop.gremlin.structure.Element',
        'com.tinkerpop.gremlin.structure.Element$Iterators',
        'com.tinkerpop.gremlin.structure.Graph',
        'com.tinkerpop.gremlin.structure.Property',
        'com.tinkerpop.gremlin.structure.Transaction',
        'com.tinkerpop.gremlin.structure.Vertex',
        'java.lang.Enum',
        'java.lang.Object',
        'java.util.function.BiConsumer',
        'java.util.function.BiFunction',
        'java.util.function.BinaryOperator',
        'java.util.function.BiPredicate',
        'java.util.function.Consumer',
        'java.util.function.Function',
        'java.util.function.Predicate',
        'java.util.function.Supplier',
        'java.util.function.UnaryOperator',
        'java.util.Iterator'
      ];
      expect(classes).to.include.keys(someExpectedClasses);
    });
  });

});
