Feature: Arrays

As a Node.js + TypeScript + node-java developer
I want to understand how to use Java array types in Typescript.

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

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });

    var Arrays = java.import('java.util.Arrays');

    var SomeClass = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeInterface = new SomeClass();
    {{{ scenario_snippet }}}

    """

  Scenario: Getting 1d array of primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var arr: string[] = something.getListSync();
    assert.ok(_.isArray(arr));
    assert.deepEqual(arr, [ 'a', 'b', 'c' ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Getting 2d array of primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var arr: number[][] = something.getArraySync();
    assert.deepEqual(arr, [ [ 1, 2, 3 ], [ 4, 5, 6 ] ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Getting 1d array of non-primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var clazz: Java.java.lang.Class = something.getClassSync();
    var methods: Java.java.lang.reflect.Method[] = clazz.getDeclaredMethodsSync();
    assert.ok(_.isArray(methods));
    assert.ok(methods.length > 0);
    _.forEach(methods, (method: Java.Method) => assert.ok(java.instanceOf(method, 'java.lang.reflect.Method')));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Getting 2d array of non-primitive type
    Given the above boilerplate with following scenario snippet:
    """
    // We intentionally have two different classes named Thing, so it is necessary to refer
    // to the specific class we want with the full class path. But Typescript makes it easy
    // to declare a type alias, which shortens the code below.
    import Thing = Java.com.redseal.featureset.Thing;

    var things: Thing[][] = something.getThingsSync();
    assert.ok(_.isArray(things));
    assert.strictEqual(things.length, 2);
    var thing1d: Thing[] = things[1];
    assert.ok(_.isArray(thing1d));
    assert.strictEqual(thing1d.length, 3);

    var thingStrs: string[][] = _.map(things,
      (thing1d: Thing[]): string[] => _.map(thing1d,
        (thing: Thing): string => thing.toStringSync()
      )
    );
    assert.deepEqual(thingStrs, [ [ 'Thing0', 'Thing1', 'Thing2' ], [ 'Thing3', 'Thing4', 'Thing5' ] ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Special case passing an array as rest arguments to a java varargs methods
    # see also varargs.feature
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync('foo', 'bar');
    var arr: string[] = something.getListSync();
    assert.deepEqual(arr, ['foo', 'bar']);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: A javascript array can be passed to a Java method taking an Object[] array.
    Given the above boilerplate with following scenario snippet:
    """
    var result: string = something.setObjectsSync(['foo', 'bar']);
    assert.strictEqual(result, 'Ack from setObjects(Object[] args)');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: It is an error to pass a Javascript array to a Java array if the base type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    something.setListSync(['foo', 'bar']);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'string[]' is not assignable to parameter of type 'array_t<string | String>'.
    """

  Scenario: Setting a 1d array of any other type requires newArray
    Given the above boilerplate with following scenario snippet:
    """
    something.setListSync(java.newArray('java.lang.String', ['foo', 'bar']));
    var arr: string[] = something.getListSync();
    assert.deepEqual(arr, ['foo', 'bar']);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Setting 2d array is unsupported.
    # The node-java API `newArray()` only works with 1d arrays.
    # In the example below, `setArraySync()` expects an int[][] object.
    # Node-java doesn't provide a means to create an object of that type.
    # It is probably possible to enhance node-java's `newArray()` to support
    # multidimensional arrays, but until then ts-java uses the type `void`
    # for any argument whose type is a multidimensional array type,
    # so that the error is detected at compile time instead of runtime.
    Given the above boilerplate with following scenario snippet:
    """
    var x: number[][] = [ [4, 5, 6], [7, 8, 9] ];
    something.setArraySync(x);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'number[][]' is not assignable to parameter of type 'void'.
    """
