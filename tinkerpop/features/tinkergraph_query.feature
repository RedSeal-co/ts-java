Feature: Tinkergraph Query

As a Node.js + TypeScript + node-java + TinkerPop developer
I want to see how to construct Gremlin queries
So I can leverage my knowledge of the Java TinkerPop API to write programs in Typescript

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
      promiseSuffix: 'Promise',
      promisify: require('bluebird').promisify
    };

    var filenames = glob.sync('tinkerpop/target/dependency/**/*.jar');
    filenames.forEach((name: string) => { java.classpath.push(name); });

    var tinkerFactoryClassName = 'com.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory';
    var TinkerFactory: Java.TinkerFactory.Static = java.import(tinkerFactoryClassName);

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
        var travP: Promise<Java.GraphTraversal> = g.VPromise();
        travP = travP.then((trav: Java.GraphTraversal) => trav.valuesPromise('name', 'age'));
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
    g.VSync().valuesSync('name', 'age').toListPromise()
      .then((vertList: Java.List) => console.log(vertList.toStringSync()));
    """
    Then it compiles and lints cleanly
    And it runs and produces output:
    """
    [marko, 29, vadas, 27, lop, josh, 32, ripple, peter, 35]

    """


