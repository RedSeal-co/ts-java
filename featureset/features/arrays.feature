Feature: Arrays

As a Node.js + TypeScript + node-java developer
I want to understand how to use Java array types in Typescript.

For Java methods that return arrays, the result will be a Javascript array.
If the array elements map to Javascript primitive types, the array will be a pure Javascript array.
If the array elements do not map to Javascript primitives, the array will be an array of Java objects.

For Java methods that accept 1d array arguments, there are different uses cases depending on the
declared type of the array parameter. Whenever a Javascript array is passed to a method,
node-java creates a Java array of type Object[].
If the method parameter is declared to be of type Object[], the method call should succeed.
If the method parameter is declared to be of a more specific type, then it is necessary to
create a Java array using the node-java API function newArray(className: string, elements: T[]).

It is currently not possible to pass a 2d (or higher dimension) array from Javascript to Java.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/lodash/lodash.d.ts' />

    import _ = require('lodash');
    import assert = require('assert');
    import java = require('../tsJavaModule');
    import Java = java.Java;

    // We intentionally have two different classes named Thing, so it is necessary to refer
    // to the specific class we want with the full class path. But Typescript makes it easy
    // to declare a type alias, which shortens some code in the scenarios code below.
    // Unfortunately, Typescript does not allow import aliases in function scope.
    import Thing = Java.com.redseal.featureset.Thing;

    Java.ensureJvm().then(() => {
      var Arrays = Java.importClass('java.util.Arrays');

      var SomeClass = Java.importClass('com.redseal.featureset.SomeClass');
      var something: Java.SomeInterface = new SomeClass();
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Getting 1d array of primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var arr: string[] = something.getList();
    assert.ok(_.isArray(arr));
    assert.deepEqual(arr, [ 'a', 'b', 'c' ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Getting 2d array of primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var arr: number[][] = something.getArray();
    assert.deepEqual(arr, [ [ 1, 2, 3 ], [ 4, 5, 6 ] ]);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Getting 1d array of non-primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var clazz: Java.java.lang.Class = something.getClass();
    var methods: Java.java.lang.reflect.Method[] = clazz.getDeclaredMethods();
    assert.ok(_.isArray(methods));
    assert.ok(methods.length > 0);
    _.forEach(methods, (method: Java.Method) => assert.ok(Java.instanceOf(method, 'java.lang.reflect.Method')));
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Getting 2d array of non-primitive type
    Given the above boilerplate with following scenario snippet:
    """
    var things: Thing[][] = something.getThings();
    assert.ok(_.isArray(things));
    assert.strictEqual(things.length, 2);
    var thing1d: Thing[] = things[1];
    assert.ok(_.isArray(thing1d));
    assert.strictEqual(thing1d.length, 3);

    var thingStrs: string[][] = _.map(things,
      (thing1d: Thing[]): string[] => _.map(thing1d,
        (thing: Thing): string => thing.toString()
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
    something.setListVarArgs('foo', 'bar');
    var arr: string[] = something.getList();
    assert.deepEqual(arr, ['foo', 'bar']);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: A javascript array can be passed to a Java method taking an Object[] array.
    Given the above boilerplate with following scenario snippet:
    """
    var result: string = something.setObjects(['foo', 'bar']);
    assert.strictEqual(result, 'Ack from setObjects(Object[] args)');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: It is an error to pass a Javascript array to a Java array if the base type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    something.setList(['foo', 'bar']);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'string[]' is not assignable to parameter of type 'array_t<string | String>'.
    """

  Scenario: Setting a 1d array of any other type requires newArray
    Given the above boilerplate with following scenario snippet:
    """
    something.setList(Java.newArray('java.lang.String', ['foo', 'bar']));
    var arr: string[] = something.getList();
    assert.deepEqual(arr, ['foo', 'bar']);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: newArray can be used with short class names
    Given the above boilerplate with following scenario snippet:
    """
    something.setList(Java.newArray('String', ['foo', 'bar']));
    var arr: string[] = something.getList();
    assert.deepEqual(arr, ['foo', 'bar']);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Setting 2d array is unsupported.
    # The node-java API `newArray()` only works with 1d arrays.
    # In the example below, `setArray()` expects an int[][] object.
    # Node-java doesn't provide a means to create an object of that type.
    # It is probably possible to enhance node-java's `newArray()` to support
    # multidimensional arrays, but until then ts-java uses the type `void`
    # for any argument whose type is a multidimensional array type,
    # so that the error is detected at compile time instead of runtime.
    Given the above boilerplate with following scenario snippet:
    """
    var x: number[][] = [ [4, 5, 6], [7, 8, 9] ];
    something.setArray(x);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'number\[\]\[\]' is not assignable to parameter of type 'void'.
    """
