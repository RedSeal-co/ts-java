Feature: Constructors
  As a Node.js + TypeScript + node-java developer
  I want to be able to construct Java objects using various forms of constructors
  There are four ways to construct instances
  1. newInstanceSync         - synchronous
  2. newInstance             - asynchronous using a callback
  3. newInstancePromise      - asynchronous using a promise
  4. new ClassName.Static()  - synchronous

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/node/node.d.ts' />

    import java = require('../module');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      {{{ scenario_snippet }}}
    });

    """

  Scenario: newInstance sync
    Given the above boilerplate with following scenario snippet:
    """
    var something: Java.SomeClass = Java.newInstance('com.redseal.featureset.SomeClass');
    console.log(something.getString());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: newInstance async
    Given the above boilerplate with following scenario snippet:
    """
    Java.newInstanceA('com.redseal.featureset.SomeClass', (err: Error, something: Java.SomeClass) => {
      console.log(something.getString());
    });
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: newInstance promise
    Given the above boilerplate with following scenario snippet:
    """
    Java.newInstanceP('com.redseal.featureset.SomeClass').then((something: Java.SomeClass) => {
      console.log(something.getString());
    });
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: new ClassName.Static
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.com.redseal.featureset.SomeClass.Static = Java.importClass('com.redseal.featureset.SomeClass');
    var something: Java.SomeClass = new SomeClass();
    console.log(something.getString());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: Constructor with arguments
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.com.redseal.featureset.SomeClass.Static = Java.importClass('com.redseal.featureset.SomeClass');
    var something: Java.SomeClass = new SomeClass(1, 2, 'hello world', true, 3.14);
    console.log(something.getString());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    hello world

    """
