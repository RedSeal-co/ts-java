Feature: Nested Classes

As a Node.js + TypeScript + node-java developer
I want to understand how to use nested classes in Typescript.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import java = require('../module');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      var Thing = Java.importClass('com.redseal.featureset.ambiguous.Thing');
      var thing = new Thing('whatever');
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Nested Classes are named using a $
    Given the above boilerplate with following scenario snippet:
    """
    var nested: Java.com.redseal.featureset.ambiguous.Thing$Nested = thing.newNested(23);
    assert.strictEqual(nested.toString(), 'Ambiguous Thing.Nested 23');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

