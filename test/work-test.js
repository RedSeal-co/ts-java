// work-test.js

'use strict';

var Work = require('../lib/work.js');
var chai = require('chai');
var expect = chai.expect;
var Immutable = require('immutable');

describe('Work', function() {

  var work;

  beforeEach(function() {
    work = new Work();
  })

  describe('initialize', function() {
    it('should initialize', function(done) {
      expect(work).to.be.ok;
      done();
    });
  });

  describe('isDone', function() {
    it('isDone should be true if no work', function(done) {
      expect(work.isDone()).to.equal(true);
      done();
    });

    it('isDone should be true if has pending work', function(done) {
      work.addTodo('a');
      expect(work.isDone()).to.equal(false);
      done();
    });
  });

  describe('setDone', function() {
    it('throws an error when setDone on an unknown item', function(done) {
      expect(function () { work.setDone('a'); }).to.throw(Error);
      done();
    });
    it('setDone on last pending item sets work all done', function(done) {
      expect(work.isDone()).to.equal(true);
      work.addTodo('a');
      expect(work.isDone()).to.equal(false);
      work.setDone('a');
      expect(work.isDone()).to.equal(true);
      done();
    });
    it('setDone with other item pending leaves work not all done', function(done) {
      expect(work.isDone()).to.equal(true);
      work.addTodo('a');
      work.addTodo('b');
      expect(work.isDone()).to.equal(false);
      work.setDone('a');
      expect(work.isDone()).to.equal(false);
      done();
    });
  });

  describe('addTodo', function() {
    it('is a no-op to add a done item', function(done) {
      work.addTodo('a');
      work.setDone('a');
      expect(work.isDone()).to.be.ok;
      work.addTodo('a');
      expect(work.isDone()).to.be.ok;
      done();
    });
  })

  describe('alreadyDone', function() {
    it('alreadyDone should be false for an unknown item', function(done) {
      expect(work.alreadyDone('a')).to.be.not.ok;
      done();
    });

    it('alreadyDone should be false for pending item', function(done) {
      work.addTodo('a');
      expect(work.alreadyDone('a')).to.be.not.ok;
      done();
    });

    it('alreadyDone should be true for a done item', function(done) {
      work.addTodo('a');
      work.setDone('a');
      expect(work.alreadyDone('a')).to.be.ok;
      done();
    });
  });

  describe('next', function() {
    it('next should return undefined when no work pending', function(done) {
      expect(work.isDone()).to.be.ok;
      expect(work.next()).to.be.undefined;
      done();
    });

    it('next should return the one item when one item pending', function(done) {
      expect(work.isDone()).to.be.ok;
      work.addTodo('a');
      expect(work.next()).to.equal('a');
      done();
    });

    it('while next setDone should deplete work queue', function(done) {
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
