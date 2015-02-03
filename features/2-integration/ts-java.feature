Feature: TypeScript generator for node-java

As a Node.js + TypeScript + node-java developer
I want to have TypeScript declaration (.d.ts) files java packages I use
so that I can use javascript with type safety comparable to java type safety.

  Scenario: TinkerGraph Query
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../tinkerpop/java.d.ts'/>
    /// <reference path='../typings/node/node.d.ts' />
    /// <reference path='../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    var tinkerFactoryClassName = 'com.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory';
    var TinkerFactory: Java.TinkerFactory.Static = nodejava.import(tinkerFactoryClassName);
    var g: Java.TinkerGraph = TinkerFactory.createClassicSync();

    // These two definitions illustrate how to use newArray() to create a parameter for a varargs argument.
    // This is awkward due to a limitation in node-java's ability to map a function call to the correct
    // method variant for methods with varargs. We may be able to fix this in node-java, though most likely
    // this will be something we address in 'wrapper' classes.
    var noargs: Java.Array<Java.Object> = nodejava.newArray<Java.Object>('java.lang.Object', []);
    var props: Java.Array<Java.String> = nodejava.newArray<Java.String>('java.lang.String', ['name', 'age']);

    var vertList: Java.List = g.VSync(noargs).valuesSync(props).toListSync();
    console.log(vertList.toStringSync());

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [marko, 29, vadas, 27, lop, josh, 32, ripple, peter, 35]

    """

  Scenario: Varargs Negative Test
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../tinkerpop/java.d.ts'/>
    /// <reference path='../typings/node/node.d.ts' />
    var g: Java.TinkerGraph;
    var s: Java.String;
    g.VSync(s);
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2345: Argument of type 'String' is not assignable to parameter of type
    """

  Scenario: TinkerGraph Query With Promises
    Given the default TinkerPop packages
    And the following sample program:
    """
    /// <reference path='../tinkerpop/java.d.ts'/>
    /// <reference path='../typings/node/node.d.ts' />
    /// <reference path='../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import nodejava = require('java');
    nodejava.asyncOptions = {
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { nodejava.classpath.push(name); });

    var noargs: Java.Array<Java.Object> = nodejava.newArray<Java.Object>('java.lang.Object', []);
    var props: Java.Array<Java.String> = nodejava.newArray<Java.String>('java.lang.String', ['name', 'age']);

    var tinkerFactoryClassName = 'com.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory';
    var TinkerFactory: Java.TinkerFactory.Static = nodejava.import(tinkerFactoryClassName);

    // The following uses promises at every step, where normally we'd use sync methods to
    // build up the traversal, and then a promise only for the final step to execute the traversal.
    // Furthermore we declare a variable travP for a GraphTraversal promise, to demonstrate
    // Typescript types that will normally be implicit;
    TinkerFactory.createClassicPromise()
      .then((g: Java.TinkerGraph) => {
        var travP: Promise<Java.GraphTraversal> = g.VPromise(noargs);
        travP = travP.then((trav: Java.GraphTraversal) => trav.valuesPromise(props));
        travP.then((trav: Java.GraphTraversal) => trav.toListPromise())
          .then((vertList: Java.List) => console.log(vertList.toStringSync()));
      })
      .then(() => {
        // This is the same query, rewritten using the more typical idioms.
        var g: Java.TinkerGraph = TinkerFactory.createClassicSync();
        g.VSync(noargs).valuesSync(props).toListPromise()
          .then((vertList: Java.List) => console.log(vertList.toStringSync()));
      });

    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [marko, 29, vadas, 27, lop, josh, 32, ripple, peter, 35]
    [marko, 29, vadas, 27, lop, josh, 32, ripple, peter, 35]

    """


