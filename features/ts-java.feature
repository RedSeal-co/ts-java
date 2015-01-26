Feature: TypeScript generator for node-java

As a Node.js + TypeScript + node-java developer
I want to have TypeScript declaration (.d.ts) files java packages I use
so that I can use javascript with type safety comparable to java type safety.

  Scenario: Package declaration only
    Given the default TinkerPop packages
    And the following sample program:
    """
    ///<reference path='./java.d.ts'/>

    """
    Then it compiles and lints cleanly

  Scenario: Hello World
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../o/java.d.ts'/>
    /// <reference path='../typings/node/node.d.ts' />
    /// <reference path='../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');

    var filenames = glob.sync('test/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    // TODO: this test is still awkward. Make it better.
    var newArray: Java.java.util.ArrayList = nodejava.newInstanceSync('java.util.ArrayList');
    var obj: Java.java.lang.Object = nodejava.newInstanceSync('java.lang.String', 'hello');
    newArray.addSync(obj);
    newArray.addSync(nodejava.newInstanceSync('java.lang.String', 'world'));
    console.log(newArray.toStringSync());

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [hello, world]

    """
