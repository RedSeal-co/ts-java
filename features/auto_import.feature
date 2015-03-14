@https://www.pivotaltracker.com/story/show/90209260 @generate_tp3_typescript
Feature: Auto import
  As a developer
  I want to import a class using its basename
  So that my code can be immune to Java refactoring.

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

      var filenames = glob.sync('featureset/target/**/*.jar');
      filenames.forEach((name: string) => { java.classpath.push(name); });
      {{{ scenario_snippet }}}

      """

  Scenario: Nominal
  Given the above boilerplate with following scenario snippet:
  ```
  var Foo: Java.Foo.Static = java.autoImport('Foo');
  var foo: Java.Foo = new Foo();
  ```
  Then it compiles and lints cleanly
  And it runs and produces no output

  Scenario: Ambiguous
  Given the above boilerplate with following scenario snippet:
  ```
  assert.throws(() => java.autoImport('Thing'), Error, /something about ambiguous class/);
  ```
  Then it compiles and lints cleanly
  And it runs and produces no output
