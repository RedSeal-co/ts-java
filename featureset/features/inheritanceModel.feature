Feature: Inheritance Model

  As a Node.js + TypeScript + node-java developer
  I need to understand how ts-java resolves subtle differences between Java and Typescript's inheritance model
  So that I can use ts-java effectively.

  There are two subtle differences that ts-java must account for.

  1) In Java, any runtime object must inherit from java.lang.Object.
  The methods of java.lang.Object are always accessible, even for variables
  whose compile-time type is a pure interface. To support this in Typescript,
  ts-java must arrange such for every Typescript interface representing a Java object type
  to include Java.java.lang.Object in ancestry.

  For example, java.util.Iterator is a pure interface that does not extend any other interface.
  A method like the following, which calls a method of Object on a variable of type Iterator will
  compile and run correctly.

    static String getClassOfSomeInterator(Iterator it) {
      return it.getClass().getName();
    }

  2) In Java, a method may overload a method declared by an ancestor, without redeclaring
  all variants of that method. In Typescript, it is necessary to redeclare all of the variants,
  or they will be hidden, changing the shape of the interface, making the subtype interface
  non-assignable to variables of the parent interface.
  To support this difference, ts-java always redeclares all inherited variants of a method whenever
  an interface or class declares any variant of a method.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import java = require('../module');
    import Java = java.Java;

    Java.ensureJvm().then(() => {
      {{{ scenario_snippet }}}
    });

    """

  Scenario: Pure java interfaces have access to methods of java.lang.Object
    Given the above boilerplate with following scenario snippet:
    """
    function getClassOfSomeInterator(it: Java.Iterator): string {
      return it.getClass().getName();
    }

    var ArrayList = Java.importClass('ArrayList');
    var list = new ArrayList();
    var itName: string = getClassOfSomeInterator(list.iterator());
    assert.strictEqual(itName, 'java.util.ArrayList$Itr');

    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: An interface extending Iterator can add a variant of Object.equals
    Given the above boilerplate with following scenario snippet:
    """
    // The Step class is a snippet that reproduced a problem exposed in Tinkerpop 3.0.0M9.
    // It resulted in a java.d.ts file that could not be compiled.
    var Step: Java.Step.Static = Java.importClass('com.redseal.featureset.overloading.Step');
    """
    Then it compiles and lints cleanly

  Scenario: Java classes that override one overloaded method variant have access to all inherited method variants.
    Given the above boilerplate with following scenario snippet:
    """
    var Overloading$Foo = Java.importClass('Overloading$Foo');
    var foo = new Overloading$Foo();

    // These two calls are for variants from java.lang.Object, not explicitly overridden in Overloading$Foo
    foo.waitA(Java.newLong(1), (err: Error): void => { /* empty */ }); // wait for 1 millisecond
    foo.waitA(Java.newLong(1), 1, (err: Error): void => { /* empty */ }); // wait for 1001 nanoseconds

    // This call is for a variant of wait() declared in Overloading$Foo
    foo.waitA(Java.newDouble(0.000001), (err: Error): void => { /* empty */ }); // wait for 1 milliscond
    """
    Then it compiles and lints cleanly
    And it runs and produces no output


