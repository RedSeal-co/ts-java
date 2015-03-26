@https://www.pivotaltracker.com/story/show/90209260 @generate_tp3_typescript
Feature: Auto import
  As a developer
  I want to import a class using its basename
  So that my code can be immune to Java refactoring.

  This feature is enabled via the tsjava section of package.json,
  by adding a property `autoImportPath` which specifies where ts-java
  will write the source file defining the autoImport function.

  Background:
      Given that ts-java has been run and autoImport.ts has compiled cleanly.
      Given this boilerplate to intialize node-java:
      """
      /// <reference path='../../typings/glob/glob.d.ts' />
      /// <reference path='../../typings/node/node.d.ts' />
      /// <reference path='../../typings/power-assert/power-assert.d.ts' />
      /// <reference path='../java.d.ts' />

      import assert = require('power-assert');
      import glob = require('glob');
      import java = require('redseal-java');
      import autoImport = require('../../featureset/o/autoImport');

      var filenames = glob.sync('featureset/target/**/*.jar');
      filenames.forEach((name: string) => { java.classpath.push(name); });
      {{{ scenario_snippet }}}

      """

  Scenario: Nominal
  Given the above boilerplate with following scenario snippet:
  """
  var SomeClass: Java.SomeClass.Static = autoImport('SomeClass');
  var something: Java.SomeClass = new SomeClass();
  """
  Then it compiles and lints cleanly
  And it runs and produces no output

  Scenario: Ambiguous
  Given the above boilerplate with following scenario snippet:
  """
  assert.throws(() => autoImport('Thing'), /autoImport unable to import short name/);
  """
  Then it compiles and lints cleanly
  And it runs and produces no output
