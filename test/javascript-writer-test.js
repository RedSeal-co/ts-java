// javascript-writer-test.ts
///<reference path='../lib/bluebird.d.ts' />
///<reference path='../node_modules/immutable/dist/Immutable.d.ts'/>
///<reference path='../typings/chai/chai.d.ts'/>
///<reference path='../typings/lodash/lodash.d.ts' />
///<reference path='../typings/mocha/mocha.d.ts'/>
///<reference path='../typings/node/node.d.ts'/>
'use strict';
var BluePromise = require('bluebird');
var chai = require('chai');
var concat = require('concat-stream');
var JavascriptWriter = require('../lib/javascript-writer');
var _ClassesMap = require('../lib/classes-map');
BluePromise.longStackTraces();
describe('JavascriptWriter', function () {
    var expect = chai.expect;
    var ClassesMap = _ClassesMap.ClassesMap;
    var jsWriter;
    before(function () {
        var classesMap = new ClassesMap();
        classesMap.initialize(['com.tinkerpop.gremlin.structure.Graph']);
        jsWriter = new JavascriptWriter(classesMap);
    });
    var streamFn;
    var endFn;
    var resultPromise;
    beforeEach(function () {
        var memstream;
        resultPromise = new BluePromise(function (resolve, reject) {
            memstream = concat({}, resolve);
        });
        streamFn = function (data) {
            return new BluePromise(function (resolve, reject) {
                memstream.write(data, 'utf8', function () {
                    resolve();
                });
            });
        };
        endFn = function () {
            return new BluePromise(function (resolve, reject) {
                memstream.end();
                resolve();
            });
        };
    });
    describe('initialize', function () {
        it('should initialize', function (done) {
            expect(jsWriter).to.be.ok;
            expect(streamFn).to.be.a('function');
            expect(endFn).to.be.a('function');
            done();
        });
        it('should make usable streamFn and endFn', function (done) {
            var expectedData = 'We write this data.';
            var runPromise = streamFn(expectedData).then(endFn);
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
    });
    describe('writeRequiredInterfaces', function () {
        it('should write expected lines for java.util.Iterator', function (done) {
            var className = 'java.util.Iterator';
            var runPromise = jsWriter.writeRequiredInterfaces(streamFn, className).then(endFn);
            var expectedData = [
                'var ObjectWrapper = require(\'./ObjectWrapper.js\');',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
        it('should write expected lines for com.tinkerpop.gremlin.structure.Edge', function (done) {
            var className = 'com.tinkerpop.gremlin.structure.Edge';
            var runPromise = jsWriter.writeRequiredInterfaces(streamFn, className).then(endFn);
            var expectedData = [
                'var ObjectWrapper = require(\'./ObjectWrapper.js\');',
                'var ElementWrapper = require(\'./ElementWrapper.js\');',
                'var ElementTraversalWrapper = require(\'./ElementTraversalWrapper.js\');',
                'var EdgeTraversalWrapper = require(\'./EdgeTraversalWrapper.js\');',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
    });
    describe('writeHeader', function () {
        it('should write expected lines for java.util.Iterator', function (done) {
            var className = 'java.util.Iterator';
            var runPromise = jsWriter.writeJsHeader(streamFn, className).then(endFn);
            var expectedData = [
                '// IteratorWrapper.js',
                '',
                '\'use strict\';',
                '',
                'var ObjectWrapper = require(\'./ObjectWrapper.js\');',
                '',
                'function IteratorWrapper(_jThis) {',
                '  if (!(this instanceof IteratorWrapper)) {',
                '    return new IteratorWrapper(_jThis);',
                '  }',
                '  this.jThis = _jThis;',
                '}',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
        it('should write expected lines for com.tinkerpop.gremlin.structure.Edge', function (done) {
            var className = 'com.tinkerpop.gremlin.structure.Edge';
            var runPromise = jsWriter.writeJsHeader(streamFn, className).then(endFn);
            var expectedData = [
                '// EdgeWrapper.js',
                '',
                '\'use strict\';',
                '',
                'var ObjectWrapper = require(\'./ObjectWrapper.js\');',
                'var ElementWrapper = require(\'./ElementWrapper.js\');',
                'var ElementTraversalWrapper = require(\'./ElementTraversalWrapper.js\');',
                'var EdgeTraversalWrapper = require(\'./EdgeTraversalWrapper.js\');',
                '',
                'function EdgeWrapper(_jThis) {',
                '  if (!(this instanceof EdgeWrapper)) {',
                '    return new EdgeWrapper(_jThis);',
                '  }',
                '  this.jThis = _jThis;',
                '}',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
    });
    describe('writeOneDefinedMethod', function () {
        it('should write expected lines for java.util.Iterator:next', function (done) {
            var className = 'java.util.Iterator';
            var methodName = 'next';
            var methodVariants = jsWriter.getMethodVariants(className, methodName);
            var method = methodVariants[0];
            var runPromise = jsWriter.writeOneDefinedMethod(streamFn, className, method).then(endFn);
            var expectedData = [
                '// next()',
                'IteratorWrapper.prototype.next = function() {',
                '};',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
    });
    describe('writeOneInheritedMethod', function () {
        it('should write expected lines for com.tinkerpop.gremlin.structure.Edge:addBothE', function (done) {
            var className = 'com.tinkerpop.gremlin.structure.Edge';
            var methodName = 'addBothE';
            var methodVariants = jsWriter.getMethodVariants(className, methodName);
            var method = methodVariants[0];
            var runPromise = jsWriter.writeOneInheritedMethod(streamFn, className, method).then(endFn);
            var expectedData = [
                '// addBothE(java.lang.String,java.lang.String,java.lang.Object...)',
                'EdgeWrapper.prototype.addBothE = ElementTraversalWrapper.prototype.addBothE;',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
    });
    describe('writeJsMethods', function () {
        // Skipping this and calling it a TODO because the implementation doesn't yet write
        // definitions for inherited methods. But all of this will be done differently
        // using Typescript, so this test is just a placeholder.
        it.skip('TODO: should write expected lines for java.util.Iterator', function (done) {
            var className = 'java.util.Iterator';
            var runPromise = jsWriter.writeJsMethods(streamFn, className).then(endFn);
            var expectedData = [
                'TODO: should also include methods inherited from Object!',
                '// forEachRemaining(java.util.function.Consumer)',
                'IteratorWrapper.prototype.forEachRemaining = function() {',
                '};',
                '',
                '// hasNext()',
                'IteratorWrapper.prototype.hasNext = function() {',
                '};',
                '',
                '// next()',
                'IteratorWrapper.prototype.next = function() {',
                '};',
                '',
                '// remove()',
                'IteratorWrapper.prototype.remove = function() {',
                '};',
                '',
                ''
            ].join('\n');
            BluePromise.all([runPromise, resultPromise]).spread(function (ignore, data) {
                expect(data).to.equal(expectedData);
                done();
            }).catch(done);
        });
    });
});
//# sourceMappingURL=javascript-writer-test.js.map