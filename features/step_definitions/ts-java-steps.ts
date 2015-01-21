// ts-java-steps.ts
/// <reference path="../../lib/bluebird.d.ts"/>
/// <reference path="../../typings/chai/chai.d.ts"/>
/// <reference path="../../typings/debug/debug.d.ts"/>
/// <reference path="../../typings/node/node.d.ts"/>

import BluePromise = require('bluebird');
import chai = require('chai');
import childProcess = require('child_process');
import debug = require('debug');
import fs = require('fs');
import path = require('path');

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
  sampleProgramPath: string;

  child: childProcess.ChildProcess;
  error: Error;
  stdout: string;
  stderr: string;
}

interface IExecCallback {
  (): void;
}

function wrapper() {
  var dlog = debug('ts-java:steps');
  var expect = chai.expect;

  // Function which runs a child process and captures the relevant data in the world object.
  var execChild = function (world: IWorld, cmd: string, callback: IExecCallback) {
    world.child = childProcess.exec(cmd, function (error: Error, stdout: Buffer, stderr: Buffer) {
      world.error = error;
      world.stdout = stdout.toString();
      world.stderr = stderr.toString();
      dlog('Exec cmd:', cmd);
      dlog('Exec error:', world.error);
      dlog('Exec stdout:', world.stdout);
      dlog('Exec stderr:', world.stderr);
      callback();
    });
  };

  // Set up a test area before each scenario.
  this.Before(function (scenario: IScenario, callback: ICallback) {
    var world = <IWorld> this;
    world.scenarioName = scenario.getName();
    expect(world.scenarioName).to.be.ok;

    // Create a sample program source file each scenario.
    world.sampleProgramPath = path.join('o', world.scenarioName.replace(/\s+/g, '_') + '.ts');
    dlog('Sample program path:', world.sampleProgramPath);
    callback();
  });

  this.Given(/^the default TinkerPop packages$/, function (callback: ICallback) {
    callback();
  });

  this.Given(/^the following sample program:$/, function (program: string, callback: ICallback) {
    var world = <IWorld> this;
    expect(world.sampleProgramPath).to.be.ok;
    fs.writeFileSync(world.sampleProgramPath, program);
    callback();
  });

  this.Then(/^it compiles and lints cleanly$/, function (callback: ICallback) {
    var world = <IWorld> this;
    var compileCmd: string = './node_modules/.bin/tsc --module commonjs --target ES5 --noImplicitAny --sourceMap '
                           + world.sampleProgramPath;
    execChild(world, compileCmd, () => {
      expect(world.error).to.equal(null);
      var lintCmd: string = './node_modules/.bin/tslint --config tslint.json --file ' + world.sampleProgramPath;
      execChild(world, lintCmd, () => {
        expect(world.error).to.equal(null);
        callback();
      });
    });
  });

  this.Then(/^it runs and produces output: '\[hello, world\]'$/, function (callback: ICallback) {
    // Write code here that turns the phrase above into concrete actions
    callback.pending();
  });

}

export = wrapper;
