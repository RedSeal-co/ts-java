Feature: TypeScript generator for node-java

As a Node.js + TypeScript + node-java developer
I want to have TypeScript declaration (.d.ts) files java packages I use
so that I can use javascript with type safety comparable to java type safety.

  Scenario: The TinkerPop.d.ts compiles without error
    Given the default TinkerPop packages
    And the following sample program:
    """
    ///<reference path='../o/TinkerPop.d.ts'/>
    """
    Then it compiles and lints cleanly

  Scenario: A Hello World application compiles without error
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../o/TinkerPop.d.ts'/>
    /// <reference path='typings/lodash/lodash.d.ts' />

    import java = require('java');

    var filenames = glob.sync('test/**/*.jar');
    _.forEach(filenames, (name: string) => { java.classpath.push(name); });

    var newArray = java.newArray('java.lang.String', ['hello', 'world']);
    console.log(newArray.toStringSync());
    """
    Then it compiles and lints cleanly
    And it runs and produces output: '[hello, world]'
