Feature: Generics

As a Node.js + TypeScript + node-java developer
I want to understand how to use Java generic types in Typescript.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />
    /// <reference path='../../typings/lodash/lodash.d.ts' />

    import _ = require('lodash');
    import assert = require('power-assert');
    import generics = require('../../generics/tsJavaModule');
    import Java = generics.Java;

    Java.ensureJvm().then(() => {
      {{{ scenario_snippet }}}
    });

    """

  @wip @todo
  Scenario: nominal
    Given the above boilerplate with following scenario snippet:
    """
    // TODO: use generics
    var Stream: Java.Stream.Static = Java.importClass('Stream');
    var Collectors: Java.Collectors.Static = Java.importClass('Collectors');
    var stream: Java.Stream<Java.String> = Stream.of('foo', 'bar');
    var collector: Java.Collector<Java.String, any, Java.List<Java.String>> = Collectors.toList();

    // TODO: when generics are fully working, remove the intermediate cast to <any>
    var list: Java.List<Java.String> = <Java.List<Java.String>> <any> stream.collect(collector);
    """
    Then it compiles and lints cleanly
    And it runs and produces no output
