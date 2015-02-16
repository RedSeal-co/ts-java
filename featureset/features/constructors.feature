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
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../featureset/java.d.ts'/>

    import glob = require('glob');
    import java = require('java');

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    {{{ scenario_snippet }}}

    """

  Scenario: newInstanceSync
    Given the above boilerplate with following scenario snippet:
    """
    var something: Java.SomeClass = java.newInstanceSync('com.redseal.featureset.SomeClass');
    console.log(something.getStringSync());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: newInstance async
    Given the above boilerplate with following scenario snippet:
    """
    java.newInstance('com.redseal.featureset.SomeClass', (err: Error, something: Java.SomeClass) => {
      console.log(something.getStringSync());
    });
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: newInstancePromise
    Given the above boilerplate with following scenario snippet:
    """
    // Note, we can set asyncOptions here only because the boilerplate hand't yet finalized java initilization.
    java.asyncOptions = {
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    // We do this only for its side-effect of forcing node-java to finalize its initialization.
    // See note about initialization in https://github.com/joeferner/node-java#promises
    java.import('java.lang.Object');

    java.newInstancePromise('com.redseal.featureset.SomeClass').then((something: Java.SomeClass) => {
      console.log(something.getStringSync());
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
    var SomeClass: Java.com.redseal.featureset.SomeClass.Static = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeClass = new SomeClass();
    console.log(something.getStringSync());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    Just some class.

    """

  Scenario: Constructor with arguments
    Given the above boilerplate with following scenario snippet:
    """
    var SomeClass: Java.com.redseal.featureset.SomeClass.Static = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeClass = new SomeClass(1, 2, 'hello world', true, 3.14);
    console.log(something.getStringSync());
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    hello world

    """
