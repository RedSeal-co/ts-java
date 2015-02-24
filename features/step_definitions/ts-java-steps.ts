// ts-java-steps.ts
/// <reference path='../../typings/bluebird/bluebird.d.ts' />
/// <reference path="../../typings/cucumber/cucumber.d.ts"/>
/// <reference path="../../typings/chai/chai.d.ts"/>
/// <reference path='../../typings/chalk/chalk.d.ts' />
/// <reference path="../../typings/debug/debug.d.ts"/>
/// <reference path="../../typings/handlebars/handlebars.d.ts"/>
/// <reference path="../../typings/node/node.d.ts"/>

'use strict';

import BluePromise = require('bluebird');
import chai = require('chai');
import chalk = require('chalk');
import childProcess = require('child_process');
import debug = require('debug');
import fs = require('fs');
import handlebars = require('handlebars');
import path = require('path');

// Generic Cucumber step callback interface.
import Callback = cucumber.StepCallback;

// ### World
// Interface to the "world" for these steps.
interface World {
  scenarioName: string;
  scenarioUri: string;
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
      if (world.error) {
        dlog('Exec error:', chalk.bold.red(world.error.toString()));
      }
      if (world.stdout) {
        dlog('Exec stdout:', chalk.bold.blue(world.stdout));
      }
      if (world.stderr) {
        dlog('Exec stderr:', chalk.bold.red(world.stderr));
      }
      callback();
    });
  };

  // Set up a test area before each scenario.
  this.Before(function (scenario: cucumber.Scenario, callback: Callback) {
    var world = <World> this;
    world.scenarioName = scenario.getName();
    expect(world.scenarioName).to.be.ok;

    var cwd = process.cwd();
    world.scenarioUri = scenario.getUri();
    expect(world.scenarioUri).to.be.ok;
    expect(world.scenarioUri.substring(0, cwd.length)).to.equal(cwd);
    world.scenarioUri = world.scenarioUri.slice(cwd.length + 1);

    dlog('Scenario Name:', world.scenarioName);
    dlog('Scenario URI:', world.scenarioUri);

    var name: string = world.scenarioName.replace(/\W+/g, '_');
    name = name.replace(/_+$/, '') + '.ts';

    var dirParts: string[] = world.scenarioUri.split(path.sep);

    // We expect dirParts to look something like this:
    // [
    //   'featureset',
    //   'features',   // must have this
    //   'PrimitiveTypeCoercions.feature'
    // ]
    expect(dirParts[dirParts.length - 2]).to.equal('features');
    // Now we only need the initial directory name to construct our path.

    // Create a sample program source file each scenario.
    world.sampleProgramPath = path.join(dirParts[0], 'o', name);
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
    var scriptPath = world.sampleProgramPath.replace(/ts$/, 'js');
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

  this.Then(/^it runs and produces no output$/, function (callback: Callback) {
    // Write code here that turns the phrase above into concrete actions
    var world = <World> this;
    var scriptPath = world.sampleProgramPath.replace(/ts$/, 'js');
    var runCmd: string = 'node ' + scriptPath;
    execChild(world, runCmd, () => {
      expect(world.error).to.equal(null);
      expect(world.stdout).to.equal('');
      expect(world.stderr).to.equal('');
      callback();
    });
  });
}

export = wrapper;
