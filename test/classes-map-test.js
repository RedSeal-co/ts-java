// classes-map-test.js

'use strict';

var chai = require('chai');
var expect = chai.expect;
var Immutable = require('immutable');
var _ = require('lodash');

describe('ClassesMap', function() {

  var ClassesMap = require('../lib/classes-map.js').ClassesMap;
  var Work = require('../lib/work.js');

  var classesMap;

  beforeEach(function() {
    classesMap = new ClassesMap();
  })

  describe('initialize', function() {
    it('should initialize', function(done) {
      expect(classesMap).to.be.ok;
      done();
    });
  });

  describe('inWhiteList', function() {
    it('should return true for valid class names', function(done) {
      expect(classesMap.inWhiteList('java.lang.Object')).to.equal(true);
      expect(classesMap.inWhiteList('java.util.Iterator')).to.equal(true);
      expect(classesMap.inWhiteList('com.tinkerpop.gremlin.')).to.equal(true);
      expect(classesMap.inWhiteList('com.tinkerpop.gremlin.Foo')).to.equal(true);
      done();
    });
    it('should return false for invalid class names', function(done) {
      expect(classesMap.inWhiteList('')).to.equal(false);
      expect(classesMap.inWhiteList('com')).to.equal(false);
//       expect(classesMap.inWhiteList('java.lang.Foo')).to.equal(false);
//       expect(classesMap.inWhiteList('java.util.Iterators')).to.equal(false);
      expect(classesMap.inWhiteList('com.tinkerpop.gremlin')).to.equal(false);
      expect(classesMap.inWhiteList('com.tinkerpop.Gremlin.Foo')).to.equal(false);
      done();
    });
  });

  describe('shortClassName', function() {
    it('should give expected results for valid class names', function(done) {
      expect(classesMap.shortClassName('java.lang.Object')).to.equal('Object');
      expect(classesMap.shortClassName('java.util.Iterator')).to.equal('Iterator');
      expect(classesMap.shortClassName('com.tinkerpop.gremlin.Foo')).to.equal('Foo');
      done();
    });
    it('should throw exception for invalid class names', function(done) {
      expect(function () { classesMap.shortClassName(''); }).to.throw(Error);
      expect(function () { classesMap.shortClassName('com'); }).to.throw(Error);
//       expect(function () { classesMap.shortClassName('java.lang.Foo'); }).to.throw(Error);
      done();
    });
  });

  describe('loadClass', function() {
    it('should return a valid Class object for a loadable class', function(done) {
      var clazz = classesMap.loadClass('java.lang.Object');
      expect(clazz).to.be.ok;
      expect(clazz.getNameSync()).to.equal('java.lang.Object');
      done();
    });
    it('should fail for an invalid class name', function(done) {
      expect(function () { classesMap.loadClass('net.lang.Object'); }).to.throw(/java.lang.ClassNotFoundException/);
      done();
    });
  });

  describe('mapClassInterfaces', function() {
    it('should find no interfaces for java.lang.Object', function(done) {
      var className = 'java.lang.Object';
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      expect(interfaces).to.deep.equal([]);
      done();
    });
    it('should find one interface for java.util.Iterator', function(done) {
      var className = 'java.util.Iterator';
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      var expected = ['java.lang.Object'];
      expect(interfaces).to.deep.equal(expected);
      work.setDone(className);
      expect(work.getTodo().toArray()).to.deep.equal(expected);
      done();
    });
    it('should find the interfaces of com.tinkerpop.gremlin.structure.Edge', function(done) {
      var className = 'com.tinkerpop.gremlin.structure.Edge';
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      var interfaces = classesMap.mapClassInterfaces(className, clazz, work);
      var expected = [
        "com.tinkerpop.gremlin.structure.Element",
        "com.tinkerpop.gremlin.process.graph.EdgeTraversal"
      ];
      expect(interfaces).to.deep.equal(expected);
      work.setDone(className);
      expect(work.getTodo().toArray().sort()).to.deep.equal(expected.sort());
      done();
    });
  });

  describe('mapMethod', function() {
    it('should map java.lang.Object:hashCode', function(done) {
      var className = 'java.lang.Object';
      var work = new Work([className]);
      var clazz = classesMap.loadClass(className);
      expect(clazz).to.be.ok;
      var methods = clazz.getDeclaredMethodsSync();
      var method = _.find(methods, function(method) { return method.getNameSync() === 'hashCode'; });
      expect(method).to.be.ok;
      var methodMap = classesMap.mapMethod(method, work);
      expect(methodMap).to.be.ok;
      var expected = { name: 'hashCode',
        declared: 'java.lang.Object',
        returns: 'int',
        params: [],
        isVarArgs: false,
        generic: 'public native int java.lang.Object.hashCode()',
        string: 'public native int java.lang.Object.hashCode()',
        signature: 'hashCode()'
      };
      expect(methodMap).to.deep.equal(expected);
      done();
    });
  });

  describe('mapClassMethods', function() {
    it('should load all methods of java.lang.Object', function(done) {
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
      done();
    });
  });

  describe('mapClass', function() {
    it('should map the properties of java.util.Iterator', function(done) {
      var className = 'java.util.Iterator';
      var work = new Work([className]);
      var classMap = classesMap.mapClass(className, work);
      expect(classMap).to.be.ok;
      expect(classMap).to.have.keys(['fullName', 'shortName', 'interfaces', 'methods']);
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
      done();
    });
  });

  describe('loadAllClasses', function() {
    it('should load all classes reachable from java.util.Iterator', function(done) {
      var work = classesMap.loadAllClasses(['java.util.Iterator']);
      expect(work.getDone().size).to.equal(4);
      var classes = classesMap.getClasses();
      expect(classes).to.be.an('object');
      var classNames = _.keys(classes).sort();
      expect(classNames).to.have.length(4);
      expect(classNames).to.deep.equal(['java.lang.CharSequence', 'java.lang.Object', 'java.lang.String', 'java.util.Iterator']);
      done();
    });
    it('should load all classes reachable from com.tinkerpop.gremlin.structure.Graph', function(done) {
      var work = classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      expect(classes).to.be.an('object');
      var classNames = _.keys(classes).sort();
      var expectedClasses = [
        'com.tinkerpop.gremlin.process.Traversal',
        'com.tinkerpop.gremlin.process.Traversal$SideEffects',
        'com.tinkerpop.gremlin.process.computer.GraphComputer',
        'com.tinkerpop.gremlin.process.computer.GraphComputer$Features',
        'com.tinkerpop.gremlin.process.graph.EdgeTraversal',
        'com.tinkerpop.gremlin.process.graph.ElementTraversal',
        'com.tinkerpop.gremlin.process.graph.GraphTraversal',
        'com.tinkerpop.gremlin.process.graph.VertexPropertyTraversal',
        'com.tinkerpop.gremlin.process.graph.VertexTraversal',
        'com.tinkerpop.gremlin.process.marker.CapTraversal',
        'com.tinkerpop.gremlin.process.marker.CountTraversal',
        'com.tinkerpop.gremlin.structure.Edge',
        'com.tinkerpop.gremlin.structure.Edge$Iterators',
        'com.tinkerpop.gremlin.structure.Element',
        'com.tinkerpop.gremlin.structure.Element$Iterators',
        'com.tinkerpop.gremlin.structure.Graph',
        'com.tinkerpop.gremlin.structure.Graph$Features',
        'com.tinkerpop.gremlin.structure.Graph$Features$DataTypeFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$EdgeFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$EdgePropertyFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$ElementFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$FeatureSet',
        'com.tinkerpop.gremlin.structure.Graph$Features$GraphFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$PropertyFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$VariableFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$VertexFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Features$VertexPropertyFeatures',
        'com.tinkerpop.gremlin.structure.Graph$Variables',
        'com.tinkerpop.gremlin.structure.Property',
        'com.tinkerpop.gremlin.structure.Transaction',
        'com.tinkerpop.gremlin.structure.Transaction$Workload',
        'com.tinkerpop.gremlin.structure.Vertex',
        'com.tinkerpop.gremlin.structure.Vertex$Iterators',
        'com.tinkerpop.gremlin.structure.VertexProperty',
        'com.tinkerpop.gremlin.structure.VertexProperty$Iterators',
        'java.lang.CharSequence',
        'java.lang.Object',
        'java.lang.String',
        'java.util.Iterator'
      ];
      expect(classNames).to.deep.equal(expectedClasses);
      expect(work.getDone().toArray().sort()).to.deep.equal(expectedClasses);
      done();
    });
  });

  describe('_interfacesClosure', function() {
    it('should compute the _interfacesClosure of java.util.Iterator', function(done) {
      // Set up the test
      var work = classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
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
      done();
    });
    it('should compute the _interfacesClosure of com.tinkerpop.gremlin.structure.Edge', function(done) {
      // Set up the test
      var work = classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
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
      done();
    });
  });

  describe('transitiveClosureInterfaces', function() {
    it('should compute the _interfacesClosure for all classes', function(done) {
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();
      var allInterfacesBefore = _.pluck(classes, 'interfaces');
      var beforeCounts = _.map(allInterfacesBefore, function (a) { return a.length; });
      var expBef = [ 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 2, 1, 3, 1, 1, 1, 1,
      1, 1, 1, 1 ];
      expect(beforeCounts).to.deep.equal(expBef);
      classesMap.transitiveClosureInterfaces();
      var allInterfacesAfter = _.pluck(classes, 'interfaces');
      var afterCounts = _.map(allInterfacesAfter, function (a) { return a.length; });
      var expAft = [ 1, 2, 1, 5, 3, 1, 3, 1, 1, 2, 1, 1, 1, 1, 2, 1, 4, 1, 1, 1, 2, 2, 1, 0, 3, 3, 4, 3, 4, 2, 5, 2, 2,
      2, 1, 2, 3, 4, 2 ];
      expect(afterCounts).to.deep.equal(expAft);
      expect(beforeCounts.length).to.equal(afterCounts.length);
      for (var i=0; i<beforeCounts.length; ++i) {
        expect(beforeCounts[i]).to.be.at.most(afterCounts[i]);
      }
      done();
    });
  });

  describe('_locateMethodOriginations', function() {
    it('should locate all method originations of java.util.Iterator', function(done) {
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
      var methodOriginations = classesMap.getMethodOriginations();
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
      done();
    });
  });

  describe('mapMethodOriginations', function() {
    it('should map all method originations', function(done) {
      // setup
      classesMap.loadAllClasses(['com.tinkerpop.gremlin.structure.Graph']);
      var classes = classesMap.getClasses();

      // execute method under test
      var methodOriginations = classesMap.mapMethodOriginations();

      // validate results

      // expect a lot of unique method signatures
      var uniqueSigatures = Immutable.Set(_.keys(methodOriginations));
      expect(uniqueSigatures.size).to.equal(365);

      // expect a smaller number defining class locations
      var uniqueLocations = Immutable.Set(_.values(methodOriginations));
      expect(uniqueLocations.size).to.equal(29);

      // even less that the total number of classes, because a few only override methods.
      expect(uniqueLocations.size).to.be.below(_.keys(classes).length);
      done();
    });
  });


});
