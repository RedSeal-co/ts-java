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

    import hellojava = require('../module');

    hellojava.ensureJvm().then((): void => {
      var HelloJava = hellojava.importClass('com.redseal.hellojava.HelloJava');
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Hello Java with sync calls
    Given the above boilerplate with following scenario snippet:
    """
    console.log(HelloJava.sayHello());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Hello, Java!

    """

  Scenario: Hello Java with async calls using callbacks
    Given the above boilerplate with following scenario snippet:
    """
    HelloJava.sayHelloA((err: Error, result: string) => console.log(result));
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Hello, Java!

    """

  Scenario: Hello Java with async calls using promises
    Given the above boilerplate with following scenario snippet:
    """
    HelloJava.sayHelloP().then((result: string) => console.log(result));
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Hello, Java!

    """
