@https://www.pivotaltracker.com/story/show/90209260 @generate_tp3_typescript
Feature: Auto import
  As a developer
  I want to import a class using its basename
  So that my code can be immune to Java refactoring.

  This feature is enabled via the tsjava section of package.json,
  by adding a property `autoImportPath` which specifies where ts-java
  will write the source file defining the autoImport function.

  Background:
      Given this boilerplate to intialize node-java:
      """
      /// <reference path='../../typings/glob/glob.d.ts' />
      /// <reference path='../../typings/node/node.d.ts' />
      /// <reference path='../../typings/power-assert/power-assert.d.ts' />
      /// <reference path='../../featureset/java.d.ts'/>

      import assert = require('power-assert');
      import glob = require('glob');
      import java = require('java');
      import autoImport = require('./featureset/o/autoImport');

      var filenames = glob.sync('featureset/target/**/*.jar');
      filenames.forEach((name: string) => { java.classpath.push(name); });
      {{{ scenario_snippet }}}

      """

  @todo
  Scenario: Nominal
  Given the above boilerplate with following scenario snippet:
  """
  var Foo: Java.Foo.Static = autoImport('Foo');
  var foo: Java.Foo = new Foo();
  """
  Then it compiles and lints cleanly
  And it runs and produces no output

  @todo
  Scenario: Ambiguous
  Given the above boilerplate with following scenario snippet:
  """
  assert.throws(() => autoImport('Thing'), Error, /something about ambiguous class/);
  """
  Then it compiles and lints cleanly
  And it runs and produces no output
