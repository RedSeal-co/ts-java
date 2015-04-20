Feature: Ambigous Class Name

As a Node.js + TypeScript + node-java developer
I need to understand when ts-java declares short aliases for class paths.

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

    function before(done: Java.Callback<void>): void {
      glob('featureset/target/**/*.jar', (err: Error, filenames: string[]): void => {
        filenames.forEach((name: string) => { java.classpath.push(name); });
        done();
      });
    }

    java.registerClient(before);

    import Thing1 = Java.com.redseal.featureset.Thing;
    import Thing2 = Java.com.redseal.featureset.ambiguous.Thing;

    java.ensureJvm(() => {
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
    error TS2305: Module 'Java' has no exported member 'Thing'.
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
    var thing1: Thing1 = java.newInstanceSync('com.redseal.featureset.Thing', 42);
    assert.equal(thing1.toStringSync(), 'Thing42');
    assert(java.instanceOf(thing1, 'com.redseal.featureset.Thing'));

    var thing2: Thing2 = java.newInstanceSync('com.redseal.featureset.ambiguous.Thing', 'foo');
    assert.equal(thing2.toStringSync(), 'Ambiguous Thing foo');
    assert(java.instanceOf(thing2, 'com.redseal.featureset.ambiguous.Thing'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Classes with same name with incompatible interfaces cannot be mixed
    Given the above boilerplate with following scenario snippet:
    """
    var thing1: Thing1 = java.newInstanceSync('com.redseal.featureset.Thing', 42);
    var thing2: Thing2 = java.newInstanceSync('com.redseal.featureset.ambiguous.Thing', 'foo');
    thing1 = thing2;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2322: Type 'Thing' is not assignable to type 'Thing'.
      Types of property 'set' are incompatible.
    """
