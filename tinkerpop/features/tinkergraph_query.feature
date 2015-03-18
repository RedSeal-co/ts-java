Feature: Tinkergraph Query

As a Node.js + TypeScript + node-java developer
I want to to use the promises support availble in node-java
So that I can use promises in my application.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../tinkerpop/java.d.ts'/>
    /// <reference path='../../typings/node/node.d.ts' />
    /// <reference path='../../typings/glob/glob.d.ts' />

    import glob = require('glob');
    import java = require('java');

    java.asyncOptions = {
      syncSuffix: 'Sync',
      asyncSuffix: '',
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });

    var tinkerFactoryClassName = 'com.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory';
    var TinkerFactory: Java.TinkerFactory.Static = java.import(tinkerFactoryClassName);

    // noargs is a convenience to work around limitation with node-java's handling of varargs.
    // Methods that take a varags final parameter must be passed an array, even in the case of
    // an empty varargs list.
    var noargs: Java.array_t<Java.Object> = java.newArray<Java.Object>('java.lang.Object', []);

    // All queries below use this array of vertex property names
    var props: Java.array_t<Java.String> = java.newArray<Java.String>('java.lang.String', ['name', 'age']);

    {{{ scenario_snippet }}}

    """

  Scenario: TinkerGraph Query With Promises (verbose)
    Given the above boilerplate with following scenario snippet:
    """
    // The following uses promises at every step, where normally we'd use sync methods to
    // build up the traversal, and then a promise only for the final step to execute the traversal.
    // Furthermore we declare a variable travP for a GraphTraversal promise, to demonstrate
    // Typescript types that will normally be implicit.
    TinkerFactory.createClassicPromise()
      .then((g: Java.TinkerGraph) => {
        var travP: Promise<Java.GraphTraversal> = g.VPromise(noargs);
        travP = travP.then((trav: Java.GraphTraversal) => trav.valuesPromise(props));
        travP.then((trav: Java.GraphTraversal) => trav.toListPromise())
          .then((vertList: Java.List) => console.log(vertList.toStringSync()));
      });
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [marko, 29, vadas, 27, lop, josh, 32, ripple, peter, 35]

    """

  Scenario: TinkerGraph Query With Promises (idiomatic)
    Given the above boilerplate with following scenario snippet:
    """
    // This is the same query, rewritten using the more typical idioms.
    var g: Java.TinkerGraph = TinkerFactory.createClassicSync();
    g.VSync(noargs).valuesSync(props).toListPromise()
      .then((vertList: Java.List) => console.log(vertList.toStringSync()));
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [marko, 29, vadas, 27, lop, josh, 32, ripple, peter, 35]

    """


