Feature: Varargs

As a Node.js + TypeScript + node-java developer
I want to understand how node-java + typescript handle java varags.

Java varargs map to Typescript 'rest' parameters in a natural way. There is no need to
create an explicit array parameter. However, it may sometimes be convenient to pass an
explict array parameter for the varargs arguments. In that case, it is typically necessary
to use the java API function newArray(className: string, elements: T[]) to create the array.
However, there is a special case for vararg parameters of type Object..., since node-java
will automatically create a Java Object[] array from a Javascript array.

See also arrays.feature.

  Background:
    Given this boilerplate to intialize node-java:
    """

    import assert = require('assert');
    import java = require('../tsJavaModule');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      var SomeClass = Java.importClass('com.redseal.featureset.SomeClass');
      var something: Java.SomeInterface = new SomeClass();
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Varargs with no args
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgs();
    assert.strictEqual(something.joinList('--'), '');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with one argument
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgs('hello');
    assert.strictEqual(something.joinList('--'), 'hello');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with two arguments
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgs('hello', 'world');
    assert.strictEqual(something.joinList('--'), 'hello--world');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with many arguments
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgs('a', 'b', 'c', 'd', 'e');
    assert.strictEqual(something.joinList('--'), 'a--b--c--d--e');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Explicit empty array passed to varargs parameter requires newArray when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    var empty = Java.newArray('java.lang.String', []);
    something.setListVarArgs(empty);
    assert.strictEqual(something.joinList('--'), '');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Plain empty array passed to varargs parameter yields error when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgs([]);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'undefined[]' is not assignable to parameter of type 'array_t<string | String>'.
    """

  Scenario: Explicit non-empty array passed to varargs parameter requires newArray when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    var arr = Java.newArray('java.lang.String', ['hello', 'world']);
    something.setListVarArgs(arr);
    assert.strictEqual(something.joinList('--'), 'hello--world');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Plain non-empty array passed to varargs parameter yields error when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgs(['hello', 'world']);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'string[]' is not assignable to parameter of type 'array_t<string | String>'.
    """

  Scenario: Bug 91797958
    Given the above boilerplate with following scenario snippet:
    """
    something.setObjectsVarArgsP(['hello', 'world']).then((result: string) => {
      assert.strictEqual(result, 'Ack from setObjectsVarArgs(Object... args)');
    });
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

