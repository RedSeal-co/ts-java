Feature: newNumber

As a developer learning how to use ts-java
I want to see how to use node-java's newInteger, newLong, newDouble etc. functions.
So I can understand how to primitive types and be aware of some limitations.

See also PrimitiveTypeCoercions.feature.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import java = require('../module');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      {{{ scenario_snippet }}}
    });

    """

  Scenario: newShort
    Given the above boilerplate with following scenario snippet:
    """
    var i: Java.java.lang.Short = Java.newShort(23);

    // Note `i` is not a number:
    assert.strictEqual(typeof i, 'object');

    // It is a java object:
    assert.ok(Java.instanceOf(i, 'java.lang.Short'));
    assert.ok(Java.instanceOf(i, 'java.lang.Number'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: newLong
    Given the above boilerplate with following scenario snippet:
    """
    var i: Java.java.lang.Long = Java.newLong(23);

    // Note `i` is not a number:
    assert.strictEqual(typeof i, 'object');

    // It is a java object:
    assert.ok(Java.instanceOf(i, 'java.lang.Long'));
    assert.ok(Java.instanceOf(i, 'java.lang.Number'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: newFloat
    Given the above boilerplate with following scenario snippet:
    """
    var i: Java.java.lang.Float = Java.newFloat(3.14159);

    // Note `i` is not a number:
    assert.strictEqual(typeof i, 'object');

    // It is a java object:
    assert.ok(Java.instanceOf(i, 'java.lang.Float'));
    assert.ok(Java.instanceOf(i, 'java.lang.Number'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: newDouble
    Given the above boilerplate with following scenario snippet:
    """
    var i: Java.java.lang.Double = Java.newDouble(3.14159);

    // Note `i` is not a number:
    assert.strictEqual(typeof i, 'object');

    // It is a java object:
    assert.ok(Java.instanceOf(i, 'java.lang.Double'));
    assert.ok(Java.instanceOf(i, 'java.lang.Number'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output
