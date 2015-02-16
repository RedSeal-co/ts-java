Feature: Hello Java

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
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../hellojava/java.d.ts'/>

    import glob = require('glob');
    import java = require('java');
    java.asyncOptions = {
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    var filenames = glob.sync('hellojava/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    var HelloJava = java.import('com.redseal.hellojava.HelloJava');
    {{{ scenario_snippet }}}
    """

  Scenario: Hello Java with sync calls
    Given the above boilerplate with following scenario snippet:
    """
    console.log(HelloJava.sayHelloSync());
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    Hello, Java!

    """

  Scenario: Hello Java with async calls using callbacks
    Given the above boilerplate with following scenario snippet:
    """
    HelloJava.sayHello((err: Error, result: string) => console.log(result));
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    Hello, Java!

    """

  Scenario: Hello Java with async calls using promises
    Given the above boilerplate with following scenario snippet:
    """
    HelloJava.sayHelloPromise().then((result: string) => console.log(result));
    """
    Then it compiles cleanly
    And it runs and produces output:
    """
    Hello, Java!

    """
