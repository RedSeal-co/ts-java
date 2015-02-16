Feature: node-java promises

As a Node.js + TypeScript + node-java developer
I want to to use the promises support availble in node-java
So that I can use promises in my application.

  Scenario: TinkerGraph Query With Promises
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


