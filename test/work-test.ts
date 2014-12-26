// work-test.ts
///<reference path='../node_modules/immutable/dist/immutable.d.ts'/>
///<reference path="../typings/chai/chai.d.ts"/>
///<reference path="../typings/mocha/mocha.d.ts"/>
///<reference path="../typings/node/node.d.ts"/>

'use strict';

import Work = require('../lib/work');
import chai = require('chai');
import Immutable = require('immutable');

describe('Work', () => {
  var expect = chai.expect;

  var work;

  beforeEach(function() {
    work = new Work();
  });

  describe('initialize', () => {
    it('should initialize', () => {
      expect(work).to.be.ok;
    });
  });

  describe('isDone', () => {
    it('should return true when no work pending', () => {
      expect(work.isDone()).to.equal(true);
    });

    it('should return false when work is pending', () => {
      work.addTodo('a');
      expect(work.isDone()).to.equal(false);
    });
  });

  describe('setDone', () => {
    it('should throw an error when called with an unknown item', () => {
      expect(function () { work.setDone('a'); }).to.throw(Error);
    });
    it('should change state to all done when called on last pending item', () => {
      expect(work.isDone()).to.equal(true);
      work.addTodo('a');
      expect(work.isDone()).to.equal(false);
      work.setDone('a');
      expect(work.isDone()).to.equal(true);
    });
    it('should remain !isDone when called with other items still pending', () => {
      expect(work.isDone()).to.equal(true);
      work.addTodo('a');
      work.addTodo('b');
      expect(work.isDone()).to.equal(false);
      work.setDone('a');
      expect(work.isDone()).to.equal(false);
    });
  });

  describe('addTodo', () => {
    it('should do nothing when adding a done item', () => {
      work.addTodo('a');
      work.setDone('a');
      expect(work.isDone()).to.be.ok;
      work.addTodo('a');
      expect(work.isDone()).to.be.ok;
    });
  });

  describe('alreadyDone', () => {
    it('should return false for an unknown item', () => {
      expect(work.alreadyDone('a')).to.be.not.ok;
    });

    it('should return false for pending item', () => {
      work.addTodo('a');
      expect(work.alreadyDone('a')).to.be.not.ok;
    });

    it('should return true for a done item', () => {
      work.addTodo('a');
      work.setDone('a');
      expect(work.alreadyDone('a')).to.be.ok;
    });
  });

  describe('next', () => {
    it('should return undefined when no work pending', () => {
      expect(work.isDone()).to.be.ok;
      expect(work.next()).to.be.undefined;
    });

    it('should return the item when one item pending', () => {
      expect(work.isDone()).to.be.ok;
      work.addTodo('a');
      expect(work.next()).to.equal('a');
    });

    it('should deplete the work queue when called repeatedly in a next/setDone loop', () => {
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
    });
  });

});
