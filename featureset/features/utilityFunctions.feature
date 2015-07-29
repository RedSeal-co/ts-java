Feature: Utility Functions
  As a developer
  I should be aware of some useful utility functions provided in tsJavaModules
  So that I can take advantage of them when they are applicable.

  A generated tsJavaModule.ts file exposes a variety of useful Functions
  which are demonstrated below. See also auto_import.feature.

  Background:
    Given that ts-java has been run and tsJavaModule.ts has compiled and linted cleanly.
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import java = require('../tsJavaModule');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      {{{ scenario_snippet }}}
    });

    """

  Scenario: isJavaObject
    # isJavaObject is useful in contexts where the runtime type of variable might be either
    # some Java object, or some Javascript type such as `object`, `string`, `number`, or `array`.
    Given the above boilerplate with following scenario snippet:
    """
    assert.strictEqual(false, Java.isJavaObject({}));
    assert.strictEqual(false, Java.isJavaObject({a: 1}));
    assert.strictEqual(false, Java.isJavaObject('a string'));
    assert.strictEqual(false, Java.isJavaObject(23));
    assert.strictEqual(false, Java.isJavaObject(23.7));
    assert.strictEqual(false, Java.isJavaObject([1, 2, 3]));
    assert.strictEqual(false, Java.isJavaObject(Java.L(23)));

    var SomeClass: Java.SomeClass.Static = Java.importClass('SomeClass');
    assert.strictEqual(false, Java.isJavaObject(SomeClass));
    assert.strictEqual(true, Java.isJavaObject(SomeClass.class));

    var obj: Java.SomeClass = new SomeClass();
    assert.strictEqual(true, Java.isJavaObject(obj));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: isLongValue
    # Node-java creates a introduces a special type to represent long (64-bit) integers in javascript,
    # which is represented in typescript with the interface `Java.longValue_t`:
    # export interface longValue_t extends Number {
    #   longValue: string;
    # }
    # isLongValue tests whether a variable is a valid Java.longValue_t.
    Given the above boilerplate with following scenario snippet:
    """
    var aLongValue: Java.longValue_t = Java.L(23);
    assert.strictEqual(true, Java.isLongValue(aLongValue));

    assert.strictEqual(false, Java.isLongValue({}));
    assert.strictEqual(false, Java.isLongValue({a: 1}));
    assert.strictEqual(false, Java.isLongValue('a string'));
    assert.strictEqual(false, Java.isLongValue(23));
    assert.strictEqual(false, Java.isLongValue(23.7));
    assert.strictEqual(false, Java.isLongValue([1, 2, 3]));

    var SomeClass: Java.SomeClass.Static = Java.importClass('SomeClass');
    assert.strictEqual(false, Java.isLongValue(SomeClass));
    assert.strictEqual(false, Java.isLongValue(SomeClass.class));

    var obj: Java.SomeClass = new SomeClass();
    assert.strictEqual(false, Java.isLongValue(obj));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: L
    # As described in the scenario `isLongValue` above, there is a special type Java.longValue_t
    # for representing 64-bit integers.
    # The function Java.L() can be used to create instances of this type from regular Javascript numbers.
    Given the above boilerplate with following scenario snippet:
    """
    var aLongValue: Java.longValue_t = Java.L(23);
    assert.strictEqual(true, Java.isLongValue(aLongValue));
    assert.strictEqual(aLongValue.longValue, '23');
    assert.equal(aLongValue, 23);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

