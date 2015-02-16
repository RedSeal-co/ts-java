Feature: Nominal unit tests for ts-java
  As a developer contributing to the development of ts-java
  I want nominal unit tests that exercise the ts-java application
  So that I can easily ensure a change hasn't completely borked the app. :)

  Scenario: Package declaration only
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>

    """
    Then it compiles and lints cleanly

  Scenario: Hello World
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
