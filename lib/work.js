'use strict';

var Immutable = require('immutable');

// ## Work: a simple work/task queue.

function Work(_todo) {

  // *todo* is the set of pending items of work
  var todo = Immutable.Set(_todo || []);

  // *done* is the set of finished items of work
  var done = Immutable.Set();

  // *addTodo(item)* adds item to the todo list, but only if the item is already either done or pending.
  this.addTodo = function (item) {
    if (!done.has(item))
      todo = todo.add(item);    // since todo is a set, adding an existing item is a no-op.
  };

  // *setDone(item)* marks the item as done, but only if the item is a currently pending todo.
  // An Error is thrown if item is unknown.
  this.setDone = function (item) {
    var pending = todo.has(item);
    var finished = done.has(item);
    if (!pending && !finished)
      throw new Error('Unknown item of work');
    else if (pending && finished)
      throw new Error('Work in inconsistent state!');
    else if (pending) {
      done = done.add(item);
      todo = todo.remove(item);
    }
  };

  // *isDone()* returns true if there is no pending work to do.
  this.isDone = function () {
    return todo.size === 0;
  };

  // *alreadyDone(item)* returns true if the item is already marked done.
  this.alreadyDone = function (item) {
    return done.has(item);
  };

  // *next()* returns a pending item, or undefined if no items are pending.
  this.next = function () {
    return todo.first();
  };

  // *getDone()* returns the current set of done items.
  // Note that since the set is immutable, the caller cannot tamper with Work's state.
  this.getDone = function () {
    return Immutable.Set(done);
  };

  // *getTodo()* returns the current set of todo items.
  // Note that since the set is immutable, the caller cannot tamper with Work's state.
  this.getTodo = function () {
    return Immutable.Set(todo);
  };
}

module.exports = Work;
