Feature: Composability
  As a developer
  I want to be able to uses two or more Java libraries, each with their own ts-java interface,
  So that I can use logical factoring of my application into well-defined components.

  Background:
    Given this boilerplate to intialize node-java:
    """
    /// <reference path='../../typings/power-assert/power-assert.d.ts' />

    import assert = require('power-assert');
    import hellojava = require('../../hellojava/tsJavaModule');
    import reflection = require('../../reflection/tsJavaModule');
    import featureset = require('../../featureset/tsJavaModule');

    // It's not strictly necessary to call ensureJvm for each module -- once is sufficient.
    // However, there is no harm in doing so.
    hellojava.Java.ensureJvm()
      .then(() => reflection.Java.ensureJvm())
      .then(() => featureset.Java.ensureJvm())
      .then(() => {
        {{{ scenario_snippet }}}
      });

    """

  Scenario: Two or more different tsJavaModules may be imported
    Given the above boilerplate with following scenario snippet:
    """
    // intentionally blank
    """
    Then it compiles and lints cleanly

    Scenario: Classes from two different tsJavaModules may be imported
    Given the above boilerplate with following scenario snippet:
    """
      var Object1: hellojava.Java.Object.Static = hellojava.Java.importClass('Object');
      var Object2: reflection.Java.Object.Static = reflection.Java.importClass('Object');
    """
    Then it compiles and lints cleanly

  Scenario: The typescript types may not be compatible
    Given the above boilerplate with following scenario snippet:
    """
      var Object1: hellojava.Java.Object.Static = hellojava.Java.importClass('Object');
      var Object2: reflection.Java.Object.Static = reflection.Java.importClass('Object');

      Object2 = Object1;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2322: Type 'Static' is not assignable to type 'Static'.
    """

  Scenario: The incompatibility might be in one direction only
    Given the above boilerplate with following scenario snippet:
    """
      var Object1: hellojava.Java.Object.Static = hellojava.Java.importClass('Object');
      var Object2: reflection.Java.Object.Static = reflection.Java.importClass('Object');

      Object1 = Object2;
    """
    Then it compiles and lints cleanly

  Scenario: Reflection may be used across modules
    Given the above boilerplate with following scenario snippet:
    """
      var classLoader = reflection.Java.getClassLoader();

      function verify(className: string) {
        assert.strictEqual(className, classLoader.loadClass(className).getName());
      }

      // A class that is declared in both modules
      verify('java.lang.String');

      // A class declared only in reflection
      verify('java.lang.reflect.Parameter');

      // A class declared only in hellojava
      verify('com.redseal.hellojava.HelloJava');
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

  Scenario: A simple cast may be sufficient to workaround typescript type incompatibility
    Given the above boilerplate with following scenario snippet:
    """
      var Object1: hellojava.Java.Object.Static = hellojava.Java.importClass('Object');
      var Object2: reflection.Java.Object.Static = reflection.Java.importClass('Object');

      Object2 = <reflection.Java.Object.Static> Object1;
    """
    Then it compiles and lints cleanly

  Scenario: A simple cast is not always sufficient to workaround typescript type incompatibility
    Given the above boilerplate with following scenario snippet:
    """
      var Class1: featureset.Java.Class.Static = featureset.Java.importClass('Class');
      var Class2: reflection.Java.Class.Static = reflection.Java.importClass('Class');

      Class1 = <featureset.Java.Class.Static> Class2;
    """
    When compiled it produces this error containing this snippet:
    """
    error TS2352: Neither type 'Static' nor type 'Static' is assignable to the other.
    """

  Scenario: A sledgehammer double cast can then be used to workaround typescript type incompatibility
    Given the above boilerplate with following scenario snippet:
    """
      var Class1: featureset.Java.Class.Static = featureset.Java.importClass('Class');
      var Class2: reflection.Java.Class.Static = reflection.Java.importClass('Class');

      Class1 = <featureset.Java.Class.Static> <any> Class2;
    """
    Then it compiles and lints cleanly

  Scenario: After the sledgehammer, methods may be invoked
    Given the above boilerplate with following scenario snippet:
    """
      var Class1: featureset.Java.Class.Static = featureset.Java.importClass('Class');
      var Class2: reflection.Java.Class.Static = reflection.Java.importClass('Class');

      Class1 = <featureset.Java.Class.Static> <any> Class2;
      assert.strictEqual('java.lang.String', Class1.forName('java.lang.String').getName());
    """
    Then it compiles and lints cleanly
    And it runs and produces no output

