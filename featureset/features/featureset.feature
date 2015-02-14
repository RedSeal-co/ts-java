Feature: Feature Set

As a developer learning how to use ts-java
I want an example of using typescript on some trivial java code
So I can learn the basics with minimal complications

All examples here use the java code in hellojava/src/main/java/com/redseal/hellojava/HelloJava.java.
This file is build using maven and packaged into target/hellojava-1.0.0.jar.
When make is run in the root ts-java directory, it runs the ts-java in the hellojava directory,
which reads from package.json, writes the file hellojava/java.d.ts.

The following shows several variation of simple Typscript code that executes the HelloJava class.
The programs all require common initialization code, which is extracted into the boilerplate shown
in the Background section.

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
    var str: string = something.getStringSync()
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
    console.log(typeof num.longValue, num.longValue);
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    object { [Number: 9223372036854776000] longValue: '9223372036854775807' }
    string 9223372036854775807

    """

