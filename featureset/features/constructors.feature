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

    function before(done: Java.Callback<void>): void {
      java.asyncOptions = {
        syncSuffix: 'Sync',
        asyncSuffix: '',
        promiseSuffix: 'Promise',
        promisify: require('bluebird').promisify
      };

      glob('featureset/target/**/*.jar', (err: Error, filenames: string[]): void => {
        filenames.forEach((name: string) => { java.classpath.push(name); });
        done();
      });
    }

    java.registerClient(before);

    java.ensureJvm(() => {
      {{{ scenario_snippet }}}
    });

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
