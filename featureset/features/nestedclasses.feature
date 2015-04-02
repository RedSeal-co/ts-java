Feature: Nested Classes

As a Node.js + TypeScript + node-java developer
I want to understand how to use nested classes in Typescript.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />
    /// <reference path='../../typings/lodash/lodash.d.ts' />
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../featureset/java.d.ts'/>

    import _ = require('lodash');
    import glob = require('glob');
    import java = require('redseal-java');
    import assert = require('power-assert');

    function before(done: Java.Callback<void>): void {
      glob('featureset/target/**/*.jar', (err: Error, filenames: string[]): void => {
        filenames.forEach((name: string) => { java.classpath.push(name); });
        done();
      });
    }

    java.registerClient(before);

    java.ensureJvm(() => {
      var Thing = java.import('com.redseal.featureset.ambiguous.Thing');
      var thing = new Thing('whatever');
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Nested Classes are named using a $
    Given the above boilerplate with following scenario snippet:
    """
    var nested: Java.com.redseal.featureset.ambiguous.Thing$Nested = thing.newNestedSync(23);
    assert.strictEqual(nested.toStringSync(), 'Ambiguous Thing.Nested 23');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

