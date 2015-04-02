Feature: Primitive Type Coercions

As a developer learning how to use ts-java
I want to understand how Typescript maps primitive types between Java and Typescript
So I can understand how to primitive types and be aware of some limitations.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../featureset/java.d.ts'/>

    import assert = require('power-assert');
    import glob = require('glob');
    import java = require('redseal-java');
    import util = require('util');

    function before(done: Java.Callback<void>): void {
      glob('featureset/target/**/*.jar', (err: Error, filenames: string[]): void => {
        filenames.forEach((name: string) => { java.classpath.push(name); });
        done();
      });
    }

    java.registerClient(before);

    java.ensureJvm(() => {
      var SomeClass = java.import('com.redseal.featureset.SomeClass');
      var something: Java.SomeInterface = new SomeClass();
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Java functions returning java.lang.String values return javascript strings.
    Given the above boilerplate with following scenario snippet:
    """
    var str: string = something.getStringSync();
    assert.strictEqual(typeof str, 'string');
    assert.strictEqual(str, 'Just some class.');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Java functions taking java.lang.String values accept javascript strings.
    Given the above boilerplate with following scenario snippet:
    """
    something.setStringSync('foo');
    var str: string = something.getStringSync();
    assert.strictEqual(typeof str, 'string');
    assert.strictEqual(str, 'foo');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Java functions returning int values return javascript numbers.
    Given the above boilerplate with following scenario snippet:
    """
    var num: number = something.getIntSync();
    assert.strictEqual(typeof num, 'number');
    assert.strictEqual(num, 42);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Java functions taking int values accept javascript numbers.
    Given the above boilerplate with following scenario snippet:
    """
    something.setIntSync(999);
    var num: number = something.getIntSync();
    assert.strictEqual(typeof num, 'number');
    assert.strictEqual(num, 999);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Java functions returning long values return javascript objects containing both a number and a string.
    Given the above boilerplate with following scenario snippet:
    """
    var num: Java.longValue_t = something.getLongSync();
    assert.strictEqual(typeof num, 'object');
    assert.strictEqual(num.longValue, '9223372036854775807');
    assert.equal(num, 9223372036854776000);

    var formatted: string = util.inspect(num);
    assert.strictEqual(formatted, '{ [Number: 9223372036854776000] longValue: \'9223372036854775807\' }');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Java functions returning boolean values return javascript booleans.
    Given the above boilerplate with following scenario snippet:
    """
    var val: boolean = something.getBooleanSync();
    assert.strictEqual(typeof val, 'boolean');
    assert.strictEqual(val, true);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Java functions returning double values return javascript numbers.
    Given the above boilerplate with following scenario snippet:
    """
    var val: number = something.getDoubleSync();
    assert.strictEqual(typeof val, 'number');
    assert.strictEqual(val, 3.141592653589793);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Node-java always converts wrapped primitives to javascript primitives.
    Given the above boilerplate with following scenario snippet:
    """
    // Node-java always converts wrapper class instances for primitive types to
    // the corresponding primitive types, even via newInstance().
    var str: string = java.newInstanceSync('java.lang.String', 'hello');
    assert.strictEqual(typeof str, 'string');
    assert.strictEqual(str, 'hello');

    var num: number = java.newInstanceSync('java.lang.Integer', 42);
    assert.strictEqual(typeof num, 'number');
    assert.strictEqual(num, 42);

    java.newInstance('java.lang.Double', 2.71828, (err: Error, num: number) => {
      assert.strictEqual(typeof num, 'number');
      assert.strictEqual(num, 2.71828);
    });
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Object function results will be converted to primitive types when appropriate.
    Given the above boilerplate with following scenario snippet:
    """
    var result: Java.object_t;

    // Each of the getFooObjectSync() methods below is declared to return a java.lang.Object,
    // but actually returns a specific type that can be coerced to a javascript type.
    // The special type Java.object_t makes it easy to work with such results.
    // Note that Java.object_t is declared as:
    // type object_t = java.lang.Object | string | number | longValue_t;

    result = something.getStringObjectSync();
    assert.strictEqual(typeof result, 'string');
    assert.strictEqual(result, 'A String');

    result = something.getShortObjectSync();
    assert.strictEqual(typeof result, 'number');
    assert.strictEqual(result, 42);

    result = something.getDoubleObjectSync();
    assert.strictEqual(typeof result, 'number');
    assert.strictEqual(result, 3.141592653589793);

    result = something.getLongObjectSync();
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual((<Java.longValue_t>result).longValue, '9223372036854775807');
    assert.equal(result, 9223372036854776000);

    var formatted: string = util.inspect(result);
    assert.strictEqual(formatted, '{ [Number: 9223372036854776000] longValue: \'9223372036854775807\' }');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: newArray returns java object wrapper for the array.
    Given the above boilerplate with following scenario snippet:
    """
    var arr: Java.array_t<Java.java.lang.String> = java.newArray('java.lang.String', ['hello', 'world']);
    console.log(typeof arr, arr);

    // TODO: ts-java needs generics to support something like the following:
    // var Arrays = java.import('java.util.Arrays');
    // var list: Java.java.util.List = Arrays.asList(arr);
    // console.log(list.toStringSync());

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    object {}

    """

