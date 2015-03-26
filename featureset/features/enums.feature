Feature: Enums

As a Node.js + TypeScript + node-java developer
I want to understand how to use Java enum types in Typescript.

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

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });

    var AnEnum = java.import('com.redseal.featureset.AnEnum');
    {{{ scenario_snippet }}}

    """

  Scenario: static members
    Given the above boilerplate with following scenario snippet:
    """
    var miles: Java.AnEnum = AnEnum.miles;
    var monk: Java.AnEnum = AnEnum.monk;
    assert.ok(miles);
    assert.ok(monk);
    assert.ok(java.instanceOf(miles, 'com.redseal.featureset.AnEnum'));
    assert.ok(java.instanceOf(miles, 'java.lang.Enum'));
    assert.ok(!miles.equalsSync(monk));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: values()
    Given the above boilerplate with following scenario snippet:
    """
    var enums: Java.AnEnum[] = AnEnum.valuesSync();
    assert.ok(_.isArray(enums));
    var ids: string[] = _.map(enums, (e: Java.AnEnum) => e.toStringSync());
    assert.deepEqual(ids, [ 'mingus', 'monk', 'miles' ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: must use java Object.equals to compare enum values
    Given the above boilerplate with following scenario snippet:
    """
    var miles: Java.AnEnum = AnEnum.valueOfSync('miles');
    var milesAgain: Java.AnEnum = AnEnum.valueOfSync('miles');

    var sameWithJavaObjectEquals: boolean = miles.equalsSync(milesAgain);
    assert( sameWithJavaObjectEquals );

    var sameWithJavascriptEquals: boolean = miles === milesAgain;
    assert( !sameWithJavascriptEquals );
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: valueOf()
    Given the above boilerplate with following scenario snippet:
    """
    var miles: Java.AnEnum = AnEnum.valueOfSync('miles');
    var monk: Java.AnEnum = AnEnum.valueOfSync('monk');
    assert.ok(miles.equalsSync(AnEnum.miles));
    assert.ok(monk.equalsSync(AnEnum.monk));
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
    assert.throws(() => AnEnum.valueOfSync('myles'), /java.lang.IllegalArgumentException/);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output
