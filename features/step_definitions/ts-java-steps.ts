// ts-java-steps.ts
/// <reference path='../../typings/bluebird/bluebird.d.ts' />
/// <reference path="../../typings/chai/chai.d.ts"/>
/// <reference path="../../typings/debug/debug.d.ts"/>
/// <reference path="../../typings/handlebars/handlebars.d.ts"/>
/// <reference path="../../typings/node/node.d.ts"/>

import BluePromise = require('bluebird');
import chai = require('chai');
import childProcess = require('child_process');
import debug = require('debug');
import fs = require('fs');
import handlebars = require('handlebars');
import path = require('path');

// ### Callback
// Interface of the callback from Cucumber.js
interface Callback {
  (error?: string): void;
  (error?: Error): void;
  pending(): void;
}

// ### Scenario
// Interface of the scenario object from Cucumber.js
interface Scenario {
  getName(): string;
}

// ### World
// Interface to the "world" for these steps.
interface World {
  scenarioName: string;
  sampleProgramPath: string;

  child: childProcess.ChildProcess;
  error: Error;
  stdout: string;
  stderr: string;

  // Boilerplate template and its parameters
  boilerplate: HandlebarsTemplateDelegate;
  scenario_snippet: string;
}

// ### ExecCallback
// A generalized map of properties
interface ExecCallback {
  (): void;
}

function wrapper() {
  var dlog = debug('ts-java:steps');
  var expect = chai.expect;

  // Function which runs a child process and captures the relevant data in the world object.
  var execChild = function (world: World, cmd: string, callback: ExecCallback) {
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
  this.Before(function (scenario: Scenario, callback: Callback) {
    var world = <World> this;
    world.scenarioName = scenario.getName();
    expect(world.scenarioName).to.be.ok;

    // Create a sample program source file each scenario.
    world.sampleProgramPath = path.join('o', world.scenarioName.replace(/\s+/g, '_') + '.ts');
    dlog('Sample program path:', world.sampleProgramPath);
    callback();
  });

  this.Given(/^the default TinkerPop packages$/, function (callback: Callback) {
    callback();
  });

  this.Given(/^the following sample program:$/, function (program: string, callback: Callback) {
    var world = <World> this;
    expect(world.sampleProgramPath).to.be.ok;
    fs.writeFileSync(world.sampleProgramPath, program);
    callback();
  });

  this.Then(/^it compiles and lints cleanly$/, function (callback: Callback) {
    var world = <World> this;
    var compileCmd: string = './node_modules/.bin/tsc --module commonjs --target ES5 --noImplicitAny --sourceMap '
                           + world.sampleProgramPath;
    execChild(world, compileCmd, () => {
      expect(world.error).to.equal(null);
      expect(world.stdout).to.equal('');
      expect(world.stderr).to.equal('');
      var lintCmd: string = './node_modules/.bin/tslint --config tslint.json --file ' + world.sampleProgramPath;
      execChild(world, lintCmd, () => {
        expect(world.error).to.equal(null);
        expect(world.stdout).to.equal('');
        expect(world.stderr).to.equal('');
        callback();
      });
    });
  });

  this.Then(/^it runs and produces output:$/, function (output: string, callback: Callback) {
    var world = <World> this;
    var scriptPath = path.join('o', world.scenarioName.replace(/\s+/g, '_') + '.js');
    var runCmd: string = 'node ' + scriptPath;
    execChild(world, runCmd, () => {
      expect(world.stdout).to.equal(output);
      callback();
    });
  });

  this.When(/^compiled it produces this error containing this snippet:$/, function (expected: string, callback: Callback) {
    var world = <World> this;
    var compileCmd: string = './node_modules/.bin/tsc --module commonjs --target ES5 --noImplicitAny --sourceMap '
                           + world.sampleProgramPath;
    execChild(world, compileCmd, () => {
      expect(world.stdout).to.contain(expected);
      callback();
    });
  });

  this.Given(/^this boilerplate to intialize node\-java:$/, function (boilerplate: string, callback: Callback) {
    var world = <World> this;
    world.boilerplate = handlebars.compile(boilerplate);
    callback();
  });

  this.Given(/^the above boilerplate with following scenario snippet:$/, function (snippet: string, callback: Callback) {
    // Save the scenario_snippet parameter.
    var world = <World> this;
    var program = world.boilerplate({scenario_snippet: snippet});
    expect(world.sampleProgramPath).to.be.ok;
    fs.writeFileSync(world.sampleProgramPath, program);
    callback();
  });

  this.Then(/^it compiles cleanly$/, function (callback: Callback) {
    var world = <World> this;
    var compileCmd: string = './node_modules/.bin/tsc --module commonjs --target ES5 --noImplicitAny --sourceMap '
                           + world.sampleProgramPath;
    execChild(world, compileCmd, () => {
      expect(world.error).to.equal(null);
      expect(world.stdout).to.equal('');
      expect(world.stderr).to.equal('');
      callback();
    });
  });
}



export = wrapper;
