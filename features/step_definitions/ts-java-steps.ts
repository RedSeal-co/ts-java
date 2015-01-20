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

  this.Given(/^nothing$/, function (callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback();
  });

  this.Then(/^nothing happens$/, function (callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback();
  });
}

export = wrapper;
