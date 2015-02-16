Feature: Constructors
  As a Node.js + TypeScript + node-java developer
  I want to be able to construct Java objects using various forms of constructors
  There are four ways to construct instances
  1. newInstanceSync         - synchronous
  2. newInstance             - asynchronous using a callback
  3. newInstancePromise      - asynchronous using a promise
  4. new ClassName.Static()  - synchronous

  Scenario: newInstanceSync
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    var newArray: Java.java.util.ArrayList = nodejava.newInstanceSync('java.util.ArrayList');
    newArray.addSync('hello');
    newArray.addSync('world');
    console.log(newArray.toStringSync());

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [hello, world]

    """

  Scenario: newInstance
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    nodejava.newInstance('java.util.ArrayList', (err: Error, newArray: Java.java.util.ArrayList) => {
      newArray.addSync('hello');
      newArray.addSync('world');
      console.log(newArray.toStringSync());
    });

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [hello, world]

    """

  Scenario: newInstancePromise
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');
    nodejava.asyncOptions = {
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    // we do this only for its side-effect of forcing node-java to finalize its initialization.
    // See note about initialization in https://github.com/joeferner/node-java#promises
    nodejava.import('java.lang.Object');

    nodejava.newInstancePromise('java.util.ArrayList').then((newArray: Java.java.util.ArrayList) => {
      newArray.addSync('hello');
      newArray.addSync('world');
      console.log(newArray.toStringSync());
    });

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [hello, world]

    """

  Scenario: new ClassName.Static
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    var ArrayList: Java.java.util.ArrayList.Static = nodejava.import('java.util.ArrayList');
    var newArray: Java.java.util.ArrayList = new ArrayList();
    newArray.addSync('hello');
    newArray.addSync('world');
    console.log(newArray.toStringSync());

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [hello, world]

    """

  Scenario: Constructor with an argument
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />
    /// <reference path='../../typings/lodash/lodash.d.ts' />

    import _ = require('lodash');
    import glob = require('glob');
    import nodejava = require('java');

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    var Long: Java.java.lang.Long.Static = nodejava.import('java.lang.Long');
    var num: Java.java.lang.Long = new Long(1234567);
    console.log(num);

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    { [Number: 1234567] longValue: '1234567' }

    """
