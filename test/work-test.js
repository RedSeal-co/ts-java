// work-test.ts
///<reference path='../node_modules/immutable/dist/Immutable.d.ts'/>
///<reference path="../typings/chai/chai.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../typings/node/node.d.ts"/>
'use strict';
var Work = require('../lib/work');
var chai = require('chai');
var Immutable = require('immutable');
describe('Work', function () {
    var expect = chai.expect;
    var work;
    beforeEach(function () {
        work = new Work();
    });
    describe('initialize', function () {
        it('should initialize', function (done) {
            expect(work).to.be.ok;
            done();
        });
    });
    describe('isDone', function () {
        it('should return true when no work pending', function (done) {
            expect(work.isDone()).to.equal(true);
            done();
        });
        it('should return false when work is pending', function (done) {
            work.addTodo('a');
            expect(work.isDone()).to.equal(false);
            done();
        });
    });
    describe('setDone', function () {
        it('should throw an error when called with an unknown item', function (done) {
            expect(function () {
                work.setDone('a');
            }).to.throw(Error);
            done();
        });
        it('should change state to all done when called on last pending item', function (done) {
            expect(work.isDone()).to.equal(true);
            work.addTodo('a');
            expect(work.isDone()).to.equal(false);
            work.setDone('a');
            expect(work.isDone()).to.equal(true);
            done();
        });
        it('should remain !isDone when called with other items still pending', function (done) {
            expect(work.isDone()).to.equal(true);
            work.addTodo('a');
            work.addTodo('b');
            expect(work.isDone()).to.equal(false);
            work.setDone('a');
            expect(work.isDone()).to.equal(false);
            done();
        });
    });
    describe('addTodo', function () {
        it('should do nothing when adding a done item', function (done) {
            work.addTodo('a');
            work.setDone('a');
            expect(work.isDone()).to.be.ok;
            work.addTodo('a');
            expect(work.isDone()).to.be.ok;
            done();
        });
    });
    describe('alreadyDone', function () {
        it('should return false for an unknown item', function (done) {
            expect(work.alreadyDone('a')).to.be.not.ok;
            done();
        });
        it('should return false for pending item', function (done) {
            work.addTodo('a');
            expect(work.alreadyDone('a')).to.be.not.ok;
            done();
        });
        it('should return true for a done item', function (done) {
            work.addTodo('a');
            work.setDone('a');
            expect(work.alreadyDone('a')).to.be.ok;
            done();
        });
    });
    describe('next', function () {
        it('should return undefined when no work pending', function (done) {
            expect(work.isDone()).to.be.ok;
            expect(work.next()).to.be.undefined;
            done();
        });
        it('should return the item when one item pending', function (done) {
            expect(work.isDone()).to.be.ok;
            work.addTodo('a');
            expect(work.next()).to.equal('a');
            done();
        });
        it('should deplete the work queue when called repeatedly in a next/setDone loop', function (done) {
            var todo = ['x', 'a', 'z', 'b'];
            var original = Immutable.Set(todo);
            work = new Work(todo);
            var count = 0;
            while (!work.isDone()) {
                var item = work.next();
                work.setDone(item);
                ++count;
            }
            expect(work.isDone()).to.be.ok;
            expect(count).to.equal(todo.length);
            expect(work.getDone().size).to.equal(todo.length);
            expect(work.getDone().subtract(original).size).to.equal(0);
            done();
        });
    });
});
//# sourceMappingURL=work-test.js.map