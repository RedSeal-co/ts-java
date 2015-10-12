Feature: Ambigous Class Name

As a Node.js + TypeScript + node-java developer
I need to understand when ts-java declares short aliases for class paths.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/node/node.d.ts' />

    import assert = require('assert');
    import BluePromise = require('bluebird');
    import java = require('../tsJavaModule');

    import Java = java.Java;
    import Thing1 = Java.com.redseal.featureset.Thing;
    import Thing2 = Java.com.redseal.featureset.ambiguous.Thing;

    Java.ensureJvm().then(() => {
      {{{ scenario_snippet }}}
    });

    """

  Scenario: No Java.Thing because of ambiguity
    Given the above boilerplate with following scenario snippet:
    """
    var thing: Java.Thing
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2305: Module '.+' has no exported member 'Thing'.
    """

  Scenario: Must use full class path when class name alone is ambiguous
    Given the above boilerplate with following scenario snippet:
    """
    var thing1: Java.com.redseal.featureset.Thing;
    var thing2: Java.com.redseal.featureset.ambiguous.Thing;
    """
    Then it compiles and lints cleanly

  Scenario: Can use Typescript alias with full class path when class name alone is ambiguous
    Given the above boilerplate with following scenario snippet:
    """
    var thing1: Thing1 = Java.newInstance('com.redseal.featureset.Thing', 42);
    assert.equal(thing1.toString(), 'Thing42');
    assert(Java.instanceOf(thing1, 'com.redseal.featureset.Thing'));

    var thing2: Thing2 = Java.newInstance('com.redseal.featureset.ambiguous.Thing', 'foo');
    assert.equal(thing2.toString(), 'Ambiguous Thing foo');
    assert(Java.instanceOf(thing2, 'com.redseal.featureset.ambiguous.Thing'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Classes with same name with incompatible interfaces cannot be mixed
    Given the above boilerplate with following scenario snippet:
    """
    var thing1: Thing1 = Java.newInstance('com.redseal.featureset.Thing', 42);
    var thing2: Thing2 = Java.newInstance('com.redseal.featureset.ambiguous.Thing', 'foo');
    thing1 = thing2;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2322: Type 'Java.com.redseal.featureset.ambiguous.Thing' is not assignable to type 'Java.com.redseal.featureset.Thing'
    """
