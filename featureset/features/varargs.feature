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
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../featureset/java.d.ts'/>

    import glob = require('glob');
    import java = require('java');

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    var SomeClass = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeInterface = new SomeClass();
    {{{ scenario_snippet }}}

    """

  Scenario: Varargs example
    Given the above boilerplate with following scenario snippet:
    """
    // We'd like to be able to do this:
    // something.setListSync('hello', 'world');

    // But for now we have to do this instead:
    var list: Java.array_t<Java.String> = java.newArray<Java.String>('java.lang.String', ['hello', 'world']);
    something.setListSync(list);

    console.log(something.joinListSync('--'));
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    hello--world

    """

  Scenario: Varargs Negative Test -- No args
    Given the above boilerplate with following scenario snippet:
    """
    // We'd like to be able to do this, but unfortunately, node-java doesn't yet properly support varags:
    something.setListSync();
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2346: Supplied parameters do not match any signature of call target
    """

  Scenario: Varargs Negative Test -- One argument, but not an array
    Given the above boilerplate with following scenario snippet:
    """
    // We'd like to be able to do this, but unfortunately, node-java doesn't yet properly support varags:
    something.setListSync('hello');
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'string' is not assignable to parameter of type
    """

  Scenario: Varargs Negative Test -- Two or more arguments, not an array
    Given the above boilerplate with following scenario snippet:
    """
    // We'd like to be able to do this, but unfortunately, node-java doesn't yet properly support varags:
    something.setListSync('hello', 'world');
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2346: Supplied parameters do not match any signature of call target
    """
