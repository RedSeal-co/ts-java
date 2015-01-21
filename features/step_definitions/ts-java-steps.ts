// ts-java-steps.ts
/// <reference path="../../lib/bluebird.d.ts"/>
/// <reference path="../../typings/chai/chai.d.ts"/>
/// <reference path="../../typings/debug/debug.d.ts"/>
/// <reference path="../../typings/node/node.d.ts"/>

import BluePromise = require('bluebird');
import chai = require('chai');
import debug = require('debug');

// ### ICallback
// Interface of the callback from Cucumber.js
interface ICallback {
  (error?: string): void;
  (error?: Error): void;
  pending(): void;
}

// ### IScenario
// Interface of the scenario object from Cucumber.js
interface IScenario {
  getName(): string;
}

// ### IWorld
// Interface to the "world" for these steps.
interface IWorld {
  scenarioName: string;
}

function wrapper() {
  var dlog = debug('ts-java:steps');
  var expect = chai.expect;

  this.Given(/^the default TinkerPop packages$/, function (callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback.pending();
  });

  this.Given(/^the following sample program:$/, function (program: string, callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback.pending();
  });

  this.Then(/^it compiles and lints cleanly$/, function (callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback.pending();
  });

  this.Then(/^it runs and produces output: '\[hello, world\]'$/, function (callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback.pending();
  });

}

export = wrapper;
