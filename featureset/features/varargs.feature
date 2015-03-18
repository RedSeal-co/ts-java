Feature: Varargs

As a Node.js + TypeScript + node-java developer
I want to understand how node-java + typescript handle java varags.

To a large degree, the Typescript API produced for Java classes is a
direct mapping from Java to Typescript, with one significant exception.
While both Java and Typescript have similar syntax for function variadic arguments,
node-java currently transforms methods using varargs to a method signature
where the variable arguments are expressed as an array argument of the specified type.
This prevents Typescript from use 'rest' arguments, and forces developers
to explicitly gather the variable arguments into a Java array using newArray.
The first example below illustrates how to do this.
The second example shows that the Typescript compiler will yield an error
if an invalid type is passed where a varags array parameter is expected.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../featureset/java.d.ts'/>
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import glob = require('glob');
    import java = require('java');

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    var SomeClass = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeInterface = new SomeClass();
    {{{ scenario_snippet }}}

    """

  Scenario: Varargs with no args
    Given the above boilerplate with following scenario snippet:
    """
    something.setListSync();
    assert.strictEqual(something.joinListSync('--'), '');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with one argument
    Given the above boilerplate with following scenario snippet:
    """
    something.setListSync('hello');
    assert.strictEqual(something.joinListSync('--'), 'hello');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with two arguments
    Given the above boilerplate with following scenario snippet:
    """
    something.setListSync('hello', 'world');
    assert.strictEqual(something.joinListSync('--'), 'hello--world');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: Varargs with many arguments
    Given the above boilerplate with following scenario snippet:
    """
    something.setListSync('a', 'b', 'c', 'd', 'e');
    assert.strictEqual(something.joinListSync('--'), 'a--b--c--d--e');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output
