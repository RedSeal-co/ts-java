Feature: Type Saftey

As a Node.js + TypeScript + node-java developer
I want to understand how Typescript offers type saftey.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../featureset/java.d.ts'/>

    import glob = require('glob');
    import java = require('redseal-java');

    java.asyncOptions = {
      syncSuffix: 'Sync',
      asyncSuffix: '',
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    var filenames = glob.sync('featureset/target/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });
    var SomeClass = java.import('com.redseal.featureset.SomeClass');
    var something: Java.SomeInterface = new SomeClass();
    {{{ scenario_snippet }}}

    """

  Scenario: Forget to use Sync suffix -- example 1
    Given the above boilerplate with following scenario snippet:
    """
    // A common mistake is to want to use a Sync method but forget the Sync suffix:
    var str: string = something.getString();
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2346: Supplied parameters do not match any signature of call target
    """

  Scenario: Forget to use Sync suffix -- example 2
    Given the above boilerplate with following scenario snippet:
    """
    // The the error here is forgetting the supply the callback function
    something.getString();
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2346: Supplied parameters do not match any signature of call target
    """

  Scenario: Forget to use Sync suffix -- example 3
    Given the above boilerplate with following scenario snippet:
    """
    // The error here is expecting a function result
    var str: string = something.getString((err: Error, str: string) => console.log(str));
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2322: Type 'void' is not assignable to type 'string'.
    """

  Scenario: Use the Sync suffix when async is desired
    Given the above boilerplate with following scenario snippet:
    """
    // Less common is to want async behavior but specifying the Sync suffix:
    something.getStringSync((err: Error, str: string) => console.log(str));
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2346: Supplied parameters do not match any signature of call target
    """

  Scenario: Forget to use Promise suffix
    Given the above boilerplate with following scenario snippet:
    """
    // Another mistake is to want a promise but forgetting the Promise suffix:
    something.getString().then((str: string) => console.log(str));
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2346: Supplied parameters do not match any signature of call target
    """

  Scenario: Just plain old wrong type
    Given the above boilerplate with following scenario snippet:
    """
    // Another mistake is to want a promise but forgetting the Promise suffix:
    var str: string = something.getIntSync();
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2322: Type 'number' is not assignable to type 'string'.
    """

