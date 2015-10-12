Feature: Fields

As a Node.js + TypeScript + node-java developer
I want to understand how to use public fields in Typescript.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/lodash/lodash.d.ts' />

    import _ = require('lodash');
    import assert = require('assert');
    import java = require('../tsJavaModule');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      var Thing = Java.importClass('com.redseal.featureset.Thing');
      var thing = new Thing(777);
      {{{ scenario_snippet }}}
    });

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

  Scenario: private static fields are not made visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: number = Thing.mPrivateStaticInt;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'mPrivateStaticInt' does not exist on type 'Static'.
    """

  Scenario: protected static fields are not made visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: number = Thing.mProtectedStaticInt;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'mProtectedStaticInt' does not exist on type 'Static'.
    """

  Scenario: package scope static fields are not made visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: number = Thing.mPackageStaticInt;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'mPackageStaticInt' does not exist on type 'Static'.
    """

  Scenario: private instance fields are not made visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: number = thing.mPrivateInt;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'mPrivateInt' does not exist on type 'Thing'.
    """

  Scenario: protected instance fields are not made visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: number = thing.mProtectedInt;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'mProtectedInt' does not exist on type 'Thing'.
    """

  Scenario: package scope instance fields are not made visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: number = thing.mPackageInt;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'mPackageInt' does not exist on type 'Thing'.
    """

  Scenario: A static field may have the same name as a static field in a superclass
    Given the above boilerplate with following scenario snippet:
    """
    var SomeAbstractClass = Java.importClass('SomeAbstractClass');
    var SomeClass = Java.importClass('SomeClass');
    assert.strictEqual(SomeAbstractClass.mField, 1);
    assert.strictEqual(SomeClass.mField, 2);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

