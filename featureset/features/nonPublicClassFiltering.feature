Feature: Non-public class filtering

As a developer using ts-java
I need to understand that non-public classes are automatically excluded
Since we can't use them anyway

Ts-java only exposes public classes. Non-public classes include
1) package scope classes
2) private inner classes
3) anonynmous classes

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

    java.ensureJvm(() => {
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Anonymous classes are not visible
    Given the above boilerplate with following scenario snippet:
    """
    // The AnonClassTest$1 exists in the .jar, but we don't prove that here.
    var anon: Java.com.redseal.featureset.AnonClassTest$1;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2305: Module 'Java.com.redseal.featureset' has no exported member 'AnonClassTest$1'
    """

  Scenario: Package scope classes are not visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: Java.com.redseal.featureset.SomePackageScopeClass;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2305: Module 'Java.com.redseal.featureset' has no exported member 'SomePackageScopeClass'
    """

  Scenario: Private inner classes are not visible
    Given the above boilerplate with following scenario snippet:
    """
    var x: Java.com.redseal.featureset.SomeClass$SomePrivateInnerClass;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2305: Module 'Java.com.redseal.featureset' has no exported member 'SomeClass$SomePrivateInnerClass'
    """




