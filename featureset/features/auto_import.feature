@https://www.pivotaltracker.com/story/show/90209260 @generate_tp3_typescript
Feature: Auto import
  As a developer
  I want to import a class using its basename
  So that my code can be immune to Java refactoring.

  A generated tsJavaModule.ts file exposes the function importClass(),
  which can import a class by its full class path, or by just its class name,
  when the class name unambiguously determines the full class path.

  Background:
    Given that ts-java has been run and tsJavaModule.ts has compiled and linted cleanly.
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import java = require('../tsJavaModule');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      var Arrays = Java.importClass('java.util.Arrays');
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Nominal
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.SomeClass.Static = Java.importClass('SomeClass');
    var something: Java.SomeClass = new SomeClass();
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Ambiguous
    Given the above boilerplate with following scenario snippet:
    """
    assert.throws(() => Java.importClass('Thing'), /java.lang.NoClassDefFoundError: Thing/);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Reserved word in package namespace
    # The package namespace java.util.function requires special handling since function is a reserved word
    # in Typescript. The typescript module name is mapped to `function_` to avoid the conflict.
    Given the above boilerplate with following scenario snippet:
    """
    var Function: Java.Function.Static = Java.importClass('Function');
    var func: Java.java.util.function_.Function = Function.identity();
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: import via full class path
    Given the above boilerplate with following scenario snippet:
    """
    var Function: Java.Function.Static = Java.importClass('java.util.function.Function');
    var func: Java.java.util.function_.Function = Function.identity();
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Fully qualified name for a valid short name
    Given the above boilerplate with following scenario snippet:
    """
    assert.strictEqual('java.lang.Object', Java.fullyQualifiedName('Object'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Fully qualified name for a nonexistent name
    Given the above boilerplate with following scenario snippet:
    """
    assert.strictEqual(undefined, Java.fullyQualifiedName('NonExistingClassName'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Fully qualified name for an ambiguous name
    Given the above boilerplate with following scenario snippet:
    """
    assert.strictEqual(undefined, Java.fullyQualifiedName('Thing'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: instanceOf for a valid short name
    Given the above boilerplate with following scenario snippet:
    """
    var something: Java.SomeClass = Java.newInstance('com.redseal.featureset.SomeClass');

    assert.strictEqual(true, Java.instanceOf(something, 'com.redseal.featureset.SomeClass'));
    assert.strictEqual(true, Java.instanceOf(something, 'SomeClass'));

    assert.strictEqual(true, Java.instanceOf(something, 'java.lang.Object'));
    assert.strictEqual(true, Java.instanceOf(something, 'Object'));

    assert.strictEqual(false, Java.instanceOf(something, 'java.lang.Long'));
    assert.strictEqual(false, Java.instanceOf(something, 'Long'));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: instanceOf for a nonexistent name throws an exception
    Given the above boilerplate with following scenario snippet:
    """
    var something: Java.SomeClass = Java.newInstance('com.redseal.featureset.SomeClass');
    assert.throws(() => Java.instanceOf(something, 'xxx.yyy.NonExistingClassName'), /java.lang.NoClassDefFoundError/);
    assert.throws(() => Java.instanceOf(something, 'NonExistingClassName'), /java.lang.NoClassDefFoundError/);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: instanceOf for an ambiguous name throws an exception
    Given the above boilerplate with following scenario snippet:
    """
    var something: Java.SomeClass = Java.newInstance('com.redseal.featureset.SomeClass');
    assert.throws(() => Java.instanceOf(something, 'Thing'), /java.lang.NoClassDefFoundError/);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: the Static interface exposes the Java Class object
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.SomeClass.Static = Java.importClass('SomeClass');
    var clazz: Java.Class = SomeClass.class;
    assert.strictEqual(clazz.getClass().getName(), 'java.lang.Class');
    assert.strictEqual(clazz.getName(), 'com.redseal.featureset.SomeClass');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: asInstanceOf with valid short class name
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.SomeClass.Static = Java.importClass('SomeClass');
    var obj: any = new SomeClass();   // intentionally drop type information

    var some1: Java.Object = Java.asInstanceOf(obj, 'Object');
    assert.strictEqual(some1.getClass().getName(), 'com.redseal.featureset.SomeClass');

    var some2: Java.SomeInterface = Java.asInstanceOf(obj, 'SomeInterface');
    assert.strictEqual(some2.getClass().getName(), 'com.redseal.featureset.SomeClass');

    var some3: Java.SomeAbstractClass = Java.asInstanceOf(obj, 'SomeAbstractClass');
    assert.strictEqual(some3.getClass().getName(), 'com.redseal.featureset.SomeClass');

    var some4: Java.SomeClass = Java.asInstanceOf(obj, 'SomeClass');
    assert.strictEqual(some4.getClass().getName(), 'com.redseal.featureset.SomeClass');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: asInstanceOf with fully qualified class name
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.SomeClass.Static = Java.importClass('SomeClass');
    var obj: any = new SomeClass();   // intentionally drop type information

    var some1: Java.Object = Java.asInstanceOf(obj, 'java.lang.Object');
    assert.strictEqual(some1.getClass().getName(), 'com.redseal.featureset.SomeClass');

    var some2: Java.SomeInterface = Java.asInstanceOf(obj, 'com.redseal.featureset.SomeInterface');
    assert.strictEqual(some2.getClass().getName(), 'com.redseal.featureset.SomeClass');

    var some3: Java.SomeAbstractClass = Java.asInstanceOf(obj, 'com.redseal.featureset.SomeAbstractClass');
    assert.strictEqual(some3.getClass().getName(), 'com.redseal.featureset.SomeClass');

    var some4: Java.SomeClass = Java.asInstanceOf(obj, 'com.redseal.featureset.SomeClass');
    assert.strictEqual(some4.getClass().getName(), 'com.redseal.featureset.SomeClass');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output


