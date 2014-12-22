///<reference path='../node_modules/immutable/dist/Immutable.d.ts'/>

'use strict';

import Immutable = require('immutable');

// ## Work: a simple work/task queue.

class Work {

  // *todo* is the set of pending items of work
  private todo: Immutable.Set<string>;

  // *done* is the set of finished items of work
  private done: Immutable.Set<string>;

  constructor(_todo: Array<string> = []) {
    this.todo = Immutable.Set<string>(_todo);
    this.done = Immutable.Set<string>();
  }

  // *addTodo(item)* adds item to the todo list, but only if the item is neither done nor pending.
  addTodo(item: string): void {
    if (!this.alreadyDone(item)) {
      this.todo = this.todo.add(item);    // since todo is a set, adding an existing item is a no-op.
    }
  }

  // *setDone(item)* marks the item as done, but only if the item is a currently pending todo.
  // An Error is thrown if item is unknown.
  setDone(item: string): void {
    var pending = this.todo.has(item);
    var finished = this.done.has(item);
    if (!pending && !finished) {
      throw new Error('Unknown item of work');
    } else if (pending && finished) {
      throw new Error('Work in inconsistent state!');
    } else if (pending) {
      this.done = this.done.add(item);
      this.todo = this.todo.remove(item);
    }
  }

  // *isDone()* returns true if there is no pending work to do.
  isDone(): boolean {
    return this.todo.size === 0;
  }

  // *alreadyDone(item)* returns true if the item is already marked done.
  alreadyDone(item: string): boolean {
    return this.done.has(item);
  }

  // *alreadyAdded(item)* returns true if the item is already in either the todo or done list .
  alreadyAdded(item: string): boolean {
    return this.done.has(item) || this.todo.has(item);
  }

  // *next()* returns a pending item, or undefined if no items are pending.
  next(): string {
    return this.todo.first();
  }

  // *getDone()* returns the current set of done items.
  // Note that since the set is immutable, the caller cannot tamper with Work's state.
  getDone(): Immutable.Set<string> {
    return this.done;
  }

  // *getTodo()* returns the current set of todo items.
  // Note that since the set is immutable, the caller cannot tamper with Work's state.
  getTodo(): Immutable.Set<string> {
    return this.todo;
  }
}

export = Work;
