Feature: Primitive Type Coercions

As a developer learning how to use ts-java
I want to understand how Typescript maps primitive types between Java and Typescript
So I can understand how to primitive types and be aware of some limitations.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../typings/node/node.d.ts' />
    /// <reference path='../typings/glob/glob.d.ts' />
    /// <reference path='../featureset/java.d.ts'/>

    import glob = require('glob');
    import java = require('java');

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    var SomeClass = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeInterface = new SomeClass();
    {{{ scenario_snippet }}}
    """

  Scenario: Java functions returning java.lang.String values return javascript strings.
    Given the above boilerplate with following scenario snippet:
    """
    var str: string = something.getStringSync();
    console.log(typeof str, str);
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    string Just some class.

    """

  Scenario: Java functions returning int values return javascript numbers.
    Given the above boilerplate with following scenario snippet:
    """
    var num: number = something.getIntSync();
    console.log(typeof num, num);
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    number 42

    """

  Scenario: Java functions returning long values return javascript objects containing both a number and a string.
    Given the above boilerplate with following scenario snippet:
    """
    var num: longValue_t = something.getLongSync();
    console.log(typeof num, num);
    console.log(typeof num.longValue, num.longValue); // longValue is a string showing the full 64-bit long integer
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    object { [Number: 9223372036854776000] longValue: '9223372036854775807' }
    string 9223372036854775807

    """

  Scenario: Java functions returning boolean values return javascript booleans.
    Given the above boilerplate with following scenario snippet:
    """
    var val: boolean = something.getBooleanSync();
    console.log(typeof val, val);
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    boolean true

    """

  Scenario: Java functions returning double values return javascript numbers.
    Given the above boilerplate with following scenario snippet:
    """
    var val: number = something.getDoubleSync();
    console.log(typeof val, val);
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    number 3.141592653589793

    """

  Scenario: Node-java always converts wrapped primitives to javascript primitives.
    Given the above boilerplate with following scenario snippet:
    """
    // Node-java always converts wrapper class instances for primitive types to
    // the corresponding primitive types, even via newInstance().
    var str: string = java.newInstanceSync('java.lang.String', 'hello');
    console.log(typeof str, str);

    var num: number = java.newInstanceSync('java.lang.Integer', 42);
    console.log(typeof num, num);

    java.newInstance('java.lang.Double', 2.71828, (err: Error, num: number) => console.log(typeof num, num));
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    string hello
    number 42
    number 2.71828

    """
