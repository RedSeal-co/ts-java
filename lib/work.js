///<reference path='../node_modules/immutable/dist/Immutable.d.ts'/>
'use strict';
var Immutable = require('immutable');
// ## Work: a simple work/task queue.
var Work = (function () {
    function Work(_todo) {
        if (_todo === void 0) { _todo = []; }
        this.todo = Immutable.Set(_todo);
        this.done = Immutable.Set();
    }
    // *addTodo(item)* adds item to the todo list, but only if the item is neither done nor pending.
    Work.prototype.addTodo = function (item) {
        if (!this.alreadyDone(item))
            this.todo = this.todo.add(item); // since todo is a set, adding an existing item is a no-op.
    };
    // *setDone(item)* marks the item as done, but only if the item is a currently pending todo.
    // An Error is thrown if item is unknown.
    Work.prototype.setDone = function (item) {
        var pending = this.todo.has(item);
        var finished = this.done.has(item);
        if (!pending && !finished)
            throw new Error('Unknown item of work');
        else if (pending && finished)
            throw new Error('Work in inconsistent state!');
        else if (pending) {
            this.done = this.done.add(item);
            this.todo = this.todo.remove(item);
        }
    };
    // *isDone()* returns true if there is no pending work to do.
    Work.prototype.isDone = function () {
        return this.todo.size === 0;
    };
    // *alreadyDone(item)* returns true if the item is already marked done.
    Work.prototype.alreadyDone = function (item) {
        return this.done.has(item);
    };
    // *alreadyAdded(item)* returns true if the item is already in either the todo or done list .
    Work.prototype.alreadyAdded = function (item) {
        return this.done.has(item) || this.todo.has(item);
    };
    // *next()* returns a pending item, or undefined if no items are pending.
    Work.prototype.next = function () {
        return this.todo.first();
    };
    // *getDone()* returns the current set of done items.
    // Note that since the set is immutable, the caller cannot tamper with Work's state.
    Work.prototype.getDone = function () {
        return this.done;
    };
    // *getTodo()* returns the current set of todo items.
    // Note that since the set is immutable, the caller cannot tamper with Work's state.
    Work.prototype.getTodo = function () {
        return this.todo;
    };
    return Work;
})();
module.exports = Work;
//# sourceMappingURL=work.js.map