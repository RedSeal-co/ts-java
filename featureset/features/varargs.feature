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
    /// <reference path='../../featureset/java.d.ts'/>
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import glob = require('glob');
    import java = require('redseal-java');

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    var SomeClass = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeInterface = new SomeClass();
    {{{ scenario_snippet }}}

    """

  Scenario: Varargs with no args
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync();
    assert.strictEqual(something.joinListSync('--'), '');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with one argument
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync('hello');
    assert.strictEqual(something.joinListSync('--'), 'hello');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with two arguments
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync('hello', 'world');
    assert.strictEqual(something.joinListSync('--'), 'hello--world');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with many arguments
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync('a', 'b', 'c', 'd', 'e');
    assert.strictEqual(something.joinListSync('--'), 'a--b--c--d--e');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Explicit empty array passed to varargs parameter requires newArray when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    var empty = java.newArray('java.lang.String', []);
    something.setListVarArgsSync(empty);
    assert.strictEqual(something.joinListSync('--'), '');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Plain empty array passed to varargs parameter yields error when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync([]);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'undefined[]' is not assignable to parameter of type 'array_t<string | String>'.
    """

  Scenario: Explicit non-empty array passed to varargs parameter requires newArray when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    var arr = java.newArray('java.lang.String', ['hello', 'world']);
    something.setListVarArgsSync(arr);
    assert.strictEqual(something.joinListSync('--'), 'hello--world');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Plain non-empty array passed to varargs parameter yields error when array type is not Object
    Given the above boilerplate with following scenario snippet:
    """
    something.setListVarArgsSync(['hello', 'world']);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'string[]' is not assignable to parameter of type 'array_t<string | String>'.
    """
