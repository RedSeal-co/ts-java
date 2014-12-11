'use strict';

var Immutable = require('immutable');
var assert = require('assert-plus');

function Work(_todo) {
  var done = Immutable.Set();
  var todo = Immutable.Set(_todo || []);

  this.addTodo = function (item) {
    if (!done.has(item))
      todo = todo.add(item);
  };

  this.setDone = function (item) {
    if (!todo.has(item) && !done.has(item))
      throw new Error('Unknown item of work');
    done = done.add(item);
    todo = todo.remove(item);
  };

  this.isDone = function () {
    return todo.size === 0;
  };

  this.alreadyDone = function (item) {
    return done.has(item);
  };

  this.next = function () {
    return todo.first();
  };

  this.getDone = function () {
    return Immutable.Set(done);
  }
}

module.exports = Work;
