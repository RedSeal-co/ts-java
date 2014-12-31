// classes-map-test.ts
///<reference path='../lib/glob.d.ts' />
///<reference path='../lib/java.d.ts' />
///<reference path='../node_modules/immutable/dist/immutable.d.ts'/>
///<reference path='../typings/chai/chai.d.ts'/>
///<reference path='../typings/lodash/lodash.d.ts' />
///<reference path='../typings/mocha/mocha.d.ts'/>
///<reference path='../typings/node/node.d.ts'/>

'use strict';

import _ = require('lodash');
import _ClassesMap = require('../lib/classes-map');
import chai = require('chai');
import glob = require('glob');
import Immutable = require('immutable');
import java = require('java');
import Work = require('../lib/work');

describe('ClassesMap', () => {
  var expect = chai.expect;
  var ClassesMap = _ClassesMap.ClassesMap;

  var classesMap;

  before(() => {
    var filenames = glob.sync('test/**/*.jar');
    _.forEach(filenames, (name: string) => { java.classpath.push(name); });
  });

  beforeEach(() => {
    classesMap = new ClassesMap(java, Immutable.Set([
      /^java\.util\.Iterator$/,
      /^java\.util\.function\./,
      /^com\.tinkerpop\.gremlin\./
    ]));
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
      expect(classesMap.inWhiteList('java.lang.Foo')).to.equal(false);
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
    it('should throw exception for invalid class names', () => {
      expect(function () { classesMap.shortClassName(''); }).to.throw(Error);
      expect(function () { classesMap.shortClassName('com'); }).to.throw(Error);
      expect(function () { classesMap.shortClassName('java.lang.Foo'); }).to.throw(Error);
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
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      expect(interfaces).to.deep.equal([]);
    });
    it('should find one interface for java.util.Iterator', () => {
      var className = 'java.util.Iterator';
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      var expected = ['java.lang.Object'];
      expect(interfaces).to.deep.equal(expected);
      work.setDone(className);
      expect(work.getTodo().toArray()).to.deep.equal(expected);
    });
    it('should find the interfaces of com.tinkerpop.gremlin.structure.Edge', () => {
      var className = 'com.tinkerpop.gremlin.structure.Edge';
      var work = new Work([className]);
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

  describe('mapMethod', () => {
    it('should map java.lang.Object:hashCode', () => {
      var className = 'java.lang.Object';
      var work = new Work([className]);
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
        params: [],
        paramNames: [],
        isVarArgs: false,
        generic_proto: 'public native int java.lang.Object.hashCode()',
        plain_proto: 'public native int java.lang.Object.hashCode()',
        signature: 'hashCode()'
      };
      expect(methodMap).to.deep.equal(expected);
    });
  });

  describe('mapClassMethods', () => {
    it('should load all methods of java.lang.Object', () => {
      var className = 'java.lang.Object';
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      var methods = classesMap.mapClassMethods(className, clazz, work);
      expect(methods).to.be.an('array');
      expect(methods).to.have.length(9);
      var names = _.pluck(methods, 'name').sort();
      var expectedNames = ['equals', 'getClass', 'hashCode', 'notify', 'notifyAll', 'toString', 'wait', 'wait', 'wait'];
      expect(names).to.deep.equal(expectedNames);
      var signatures = _.pluck(methods, 'signature').sort();
      var expectedSignatures = [
        'equals(java.lang.Object)',
        'getClass()',
        'hashCode()',
        'notify()',
        'notifyAll()',
        'toString()',
        'wait()',
        'wait(long)',
        'wait(long,int)'
      ];
      expect(signatures).to.deep.equal(expectedSignatures);
    });
  });

  describe('mapClass', () => {
    it('should map the properties of java.util.Iterator', () => {
      var className = 'java.util.Iterator';
      var work = new Work([className]);
      var classMap = classesMap.mapClass(className, work);
      expect(classMap).to.be.ok;
      expect(classMap).to.have.keys([
        'fullName',
        'interfaces',
        'isInterface',
        'isPrimitive',
        'methods',
        'shortName',
        'superclass',
        'variants'
      ]);
      expect(classMap.fullName).to.equal(className);
      expect(classMap.shortName).to.equal('Iterator');
      expect(classMap.interfaces).to.deep.equal(['java.lang.Object']);
      var methodSignatures = _.pluck(classMap.methods, 'signature').sort();
      var expectedSignatures = [
        'forEachRemaining(java.util.function.Consumer)',
        'hasNext()',
        'next()',
        'remove()'
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
        'java.lang.CharSequence',
        'java.lang.Long',
        'java.lang.Number',
        'java.lang.Object',
        'java.lang.String',
        'java.util.Iterator'
      ]);
    });
    it('should load all classes reachable from com.tinkerpop.gremlin.structure.Graph', () => {
      var work = classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      expect(classes).to.be.an('object');
      var someExpectedClasses = [
        'com.tinkerpop.gremlin.process.Traversal',
        'com.tinkerpop.gremlin.process.graph.EdgeTraversal',
        'com.tinkerpop.gremlin.process.graph.ElementTraversal',
        'com.tinkerpop.gremlin.process.graph.GraphTraversal',
        'com.tinkerpop.gremlin.process.graph.VertexTraversal',
        'com.tinkerpop.gremlin.structure.Edge',
        'com.tinkerpop.gremlin.structure.Edge$Iterators',
        'com.tinkerpop.gremlin.structure.Element',
        'com.tinkerpop.gremlin.structure.Element$Iterators',
        'com.tinkerpop.gremlin.structure.Graph',
        'com.tinkerpop.gremlin.structure.Property',
        'com.tinkerpop.gremlin.structure.Transaction',
        'com.tinkerpop.gremlin.structure.Vertex',
        'java.lang.CharSequence',
        'java.lang.Long',
        'java.lang.Object',
        'java.lang.String',
        'java.util.Iterator'
      ];
      expect(classes).to.include.keys(someExpectedClasses);
    });
  });

  describe('_interfacesClosure', () => {
    it('should compute the _interfacesClosure of java.util.Iterator', () => {
      // Set up the test
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      var work = new Work(_.keys(classes));
      var className = 'java.util.Iterator';
      var beforeInterfaces = classes[className].interfaces;
      var expectedBefore = [
        'java.lang.Object',
      ];
      expect(beforeInterfaces).to.deep.equal(expectedBefore);

      // Now finally execute the method under test.
      classesMap._interfacesClosure(className, work);

      // Verify the resutlts
      var afterInterfaces = classes[className].interfaces;
      var expectedAfter = expectedBefore;
      expect(afterInterfaces).to.deep.equal(expectedAfter);
    });
    it('should compute the _interfacesClosure of com.tinkerpop.gremlin.structure.Edge', () => {
      // Set up the test
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      var work = new Work(_.keys(classes));
      var className = 'com.tinkerpop.gremlin.structure.Edge';
      var beforeInterfaces = classes[className].interfaces;
      var expectedBefore = [
        'com.tinkerpop.gremlin.structure.Element',
        'com.tinkerpop.gremlin.process.graph.EdgeTraversal'
      ];
      expect(beforeInterfaces).to.deep.equal(expectedBefore);

      // Now finally execute the method under test.
      classesMap._interfacesClosure(className, work);

      // Verify the resutlts
      var afterInterfaces = classes[className].interfaces;
      var expectedAfter = [
        'java.lang.Object',
        'com.tinkerpop.gremlin.structure.Element',
        'com.tinkerpop.gremlin.process.graph.ElementTraversal',
        'com.tinkerpop.gremlin.process.graph.EdgeTraversal'
      ];
      expect(afterInterfaces).to.deep.equal(expectedAfter);
    });
  });

  describe('transitiveClosureInterfaces', () => {
    it('should compute the _interfacesClosure for all classes', () => {
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      var allInterfacesBefore = _.pluck(classes, 'interfaces');
      var beforeCounts = _.map(allInterfacesBefore, (a: string[]) => { return a.length; });
      classesMap.transitiveClosureInterfaces();
      var allInterfacesAfter = _.pluck(classes, 'interfaces');
      var afterCounts = _.map(allInterfacesAfter, (a: string[]) => { return a.length; });
      expect(beforeCounts.length).to.equal(afterCounts.length);
      var extendedCount = 0;
      for (var i = 0; i < beforeCounts.length; ++i) {
        expect(beforeCounts[i]).to.be.at.most(afterCounts[i]);
        if (afterCounts[i] > beforeCounts[i]) {
          ++extendedCount;
        }
      }
      expect(extendedCount).to.be.above(5);
    });
  });

  describe('_locateMethodOriginations', () => {
    it('should locate all method originations of java.util.Iterator', () => {
      // setup
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      var work = new Work(_.keys(classes));
      expect(work.getDone().toArray().sort()).to.deep.equal([]);
      var className = 'java.util.Iterator';

      // execute method under test
      classesMap._locateMethodOriginations(className, work);

      // validate results
      expect(work.getDone().toArray().sort()).to.deep.equal(['java.lang.Object', 'java.util.Iterator']);
      var methodOriginations = classesMap.getMethodOriginations().toObject();
      var expectedOriginations = {
        'equals(java.lang.Object)': 'java.lang.Object',
        'forEachRemaining(java.util.function.Consumer)': 'java.util.Iterator',
        'getClass()': 'java.lang.Object',
        'hashCode()': 'java.lang.Object',
        'hasNext()': 'java.util.Iterator',
        'next()': 'java.util.Iterator',
        'notify()': 'java.lang.Object',
        'notifyAll()': 'java.lang.Object',
        'remove()': 'java.util.Iterator',
        'toString()': 'java.lang.Object',
        'wait()': 'java.lang.Object',
        'wait(long,int)': 'java.lang.Object',
        'wait(long)': 'java.lang.Object'
      };
      expect(methodOriginations).to.deep.equal(expectedOriginations);
    });
  });

  describe('mapMethodOriginations', () => {
    it('should map all method originations', () => {
      // setup
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();

      // execute method under test
      var methodOriginations = classesMap.mapMethodOriginations();

      // validate results

      // expect a lot of unique method signatures
      var uniqueSigatures = methodOriginations.keySeq();
      expect(uniqueSigatures.size).to.be.above(300);

      // expect a smaller number defining class locations
      var uniqueLocations = methodOriginations.toSet();
      expect(uniqueLocations.size).to.equal(30);

      // even less that the total number of classes, because a few only override methods.
      expect(uniqueLocations.size).to.be.below(_.keys(classes).length);
    });
  });


});
