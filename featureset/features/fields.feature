Feature: Fields

As a Node.js + TypeScript + node-java developer
I want to understand how to use public fields in Typescript.

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
    import java = require('java');
    import assert = require('power-assert');

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });

    var Thing = java.import('com.redseal.featureset.Thing');
    var thing = new Thing(777);
    {{{ scenario_snippet }}}

    """

  Scenario: instance fields
    Given the above boilerplate with following scenario snippet:
    """
    assert.strictEqual(thing.theInstanceField, 'instance thingy');
    thing.theInstanceField = 'something else';
    assert.strictEqual(thing.theInstanceField, 'something else');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: static fields
    Given the above boilerplate with following scenario snippet:
    """
    assert.strictEqual(Thing.theStaticField, 'static thingy');
    Thing.theStaticField = 'something else';
    assert.strictEqual(Thing.theStaticField, 'something else');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

