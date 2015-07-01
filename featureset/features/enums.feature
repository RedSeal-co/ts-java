Feature: Enums

As a Node.js + TypeScript + node-java developer
I want to understand how to use Java enum types in Typescript.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />
    /// <reference path='../../typings/lodash/lodash.d.ts' />

    import _ = require('lodash');
    import assert = require('power-assert');
    import java = require('../module');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      var AnEnum = Java.importClass('com.redseal.featureset.AnEnum');
      {{{ scenario_snippet }}}
    });

    """

  Scenario: static members
    Given the above boilerplate with following scenario snippet:
    """
    var miles: Java.AnEnum = AnEnum.miles;
    var monk: Java.AnEnum = AnEnum.monk;
    assert.ok(miles);
    assert.ok(monk);
    assert.ok(Java.instanceOf(miles, 'com.redseal.featureset.AnEnum'));
    assert.ok(Java.instanceOf(miles, 'java.lang.Enum'));
    assert.ok(!miles.equals(monk));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: values()
    Given the above boilerplate with following scenario snippet:
    """
    var enums: Java.AnEnum[] = AnEnum.values();
    assert.ok(_.isArray(enums));
    var ids: string[] = _.map(enums, (e: Java.AnEnum) => e.toString());
    assert.deepEqual(ids, [ 'mingus', 'monk', 'miles' ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: must use java Object.equals to compare enum values
    Given the above boilerplate with following scenario snippet:
    """
    var miles: Java.AnEnum = AnEnum.valueOf('miles');
    var milesAgain: Java.AnEnum = AnEnum.valueOf('miles');

    var sameWithJavaObjectEquals: boolean = miles.equals(milesAgain);
    assert( sameWithJavaObjectEquals );

    var sameWithJavascriptEquals: boolean = miles === milesAgain;
    assert( !sameWithJavascriptEquals );
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: valueOf()
    Given the above boilerplate with following scenario snippet:
    """
    var miles: Java.AnEnum = AnEnum.valueOf('miles');
    var monk: Java.AnEnum = AnEnum.valueOf('monk');
    assert.ok(miles.equals(AnEnum.miles));
    assert.ok(monk.equals(AnEnum.monk));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: static member typo fails
    Given the above boilerplate with following scenario snippet:
    """
    var myles: Java.AnEnum = AnEnum.myles;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2339: Property 'myles' does not exist on type 'Static'.
    """

  Scenario: valueOf() typo throws exception
    Given the above boilerplate with following scenario snippet:
    """
    assert.throws(() => AnEnum.valueOf('myles'), /java.lang.IllegalArgumentException/);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output
