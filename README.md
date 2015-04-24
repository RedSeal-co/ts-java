# ts-java

*Create TypeScript declaration files for Java packages.*

[Typescript](http://www.typescriptlang.org) provides the ability for Javascript programmers to write typesafe code.

[Java][java] is a typesafe language that provides a [Reflection](http://docs.oracle.com/javase/7/docs/api/java/lang/reflect/package-summary.html) API allowing introspection
of Java classes to determine type information for classes and methods.

[Node-java](https://github.com/joeferner/node-java) is a node.js package that provides a Bridge API for node.js applications
to connect to Java APIs.

**ts-java** is a tool that generates Typescript declaration files for Java classes,
allowing Typescript programmers to use Java classes in their node.js applications
with type safety comparable to using Java directly.

## Status

**ts-java** is still evolving but is already proving useful in active projects. One major feature not yet included in ts-java is support for Java Generics. We expect Java Generics will map cleanly to Typescript Generics.

## Installation

If you are able to, it's convenient to install ts-java globally:

```bash
$ npm install -g ts-java
```

But you can also install ts-java as a dev dependency and run it from ./node_modules/.bin/ts-java:

```bash
$ npm install ts-java --save-dev
```

## Usage

ts-java is configured by adding a `tsjava` property to the package.json file:

```json
{
 "name": "my-application",
 "version": "0.0.1",
 ...
 "tsjava": {
   "classpath": [
     "target/dependency/**/*.jar"
   ],
   "classes": [
     "org.apache.tinkerpop.gremlin.structure.Graph",
     "org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph",
     "org.apache.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory",
     "java.util.ArrayList"
   ],
   "packages": [
     "java.util.",
     "java.math.",
     "org.apache.tinkerpop.gremlin."
   ]
 }
}
```

We'll explain what the properties `classpath`, `classes`, and `packages` mean below. Assuming they are properly specified, `ts-java` can be run in the project's root directory to generate a `java.d.ts` file:

```bash
$ ts-java
ts-java version 1.0.3
Generated ./java.d.ts with 13 classes.
Excluded 20 classes referenced as method parameters.
Excluded 6 classes referenced as *interfaces*.
Excluded 1 classes referenced as *superclasses*.
$
```

The `tsjava` property in the `package.json` must define three nested properties:

* `classpath`: an array of glob expressions for the files to be added to the java classpath. It should be the same classpath that you will use to initialize node-java to run your application. In addition to the classes specified in `classpath`, `ts-java` automatically includes the Java runtime library classes.
* `packages`: an array of partial class paths, typically package paths. All classes in the classpath that match any string in this list will be included in the generated output.
* `classes`: an array of full class paths for classes that ts-java will generate interfaces for. If you want some but not all classes in a package, specify those classes here.

### Command Line Options

```
$ ts-java --help

  Usage: ts-java [options]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
    -q, --quiet    Run silently with no output
    -d, --details  Output diagnostic details

  All configuration options must be specified in a node.js package.json file,
  in a property tsjava.

  See the README.md file for more information.
```

By default, ts-java outputs the short summary shown above. The `--details` option expands the output to show all of the class names for each of the categories. For example:

```
$ ts-java --details
ts-java version 1.0.3
Generated classes:
   java.lang.Boolean
   java.lang.Class
   java.lang.ClassLoader
   java.lang.Integer
   java.lang.Object
   java.lang.String
   java.lang.reflect.AccessibleObject
   java.lang.reflect.Constructor
   java.lang.reflect.Executable
   java.lang.reflect.Field
   java.lang.reflect.Method
   java.lang.reflect.Parameter
   java.lang.reflect.Type
Classes that were referenced, but excluded by the current configuration:
   java.io.InputStream
   java.lang.CharSequence
   java.lang.Double
   java.lang.Float
   java.lang.Iterable
   java.lang.Long
   java.lang.Package
   java.lang.Short
   java.lang.StringBuffer
   java.lang.StringBuilder
   java.lang.annotation.Annotation
   java.lang.reflect.AnnotatedType
   java.lang.reflect.TypeVariable
   java.net.URL
   java.nio.charset.Charset
   java.security.ProtectionDomain
   java.util.Comparator
   java.util.Enumeration
   java.util.Locale
   java.util.stream.IntStream
Classes that were referenced as *interfaces*, but excluded by the current configuration:
   java.io.Serializable
   java.lang.CharSequence
   java.lang.Comparable
   java.lang.reflect.AnnotatedElement
   java.lang.reflect.GenericDeclaration
   java.lang.reflect.Member
Classes that were referenced as *superclasses*, but excluded by the current configuration:
   java.lang.Number
```

These details are useful while refining the configuration to select the exact set of classes your application needs available. The classes listed in both of the 'referenced but excluded' categories may include classes your application needs, in which case you should add those classes to the `classes` list.

#### Why not simply include all classes?

You certainly can. But we expect that most node applications that use Java libraries will only use a subset of the classes implemented in the libraries. Including all classes results in a larger `java.d.ts` file, which can slow down Typescript compilation, and also make it more cumbersome to use a `java.d.ts` file as documentation for the Java library's API.

#### What happens with excluded classes?

If an excluded class is referenced as a method parameter, `ts-java` replaces the type with the Typescript type `any`. A future release may provide an option to instead omit methods that use excluded types.

If the excluded class is referenced as an interface or superclass, the Typescript declaration won't include that relationship, though the implemented methods of the excluded interface *will* be accessible. So, the only real limitation is that you won't be able to use the excluded type to declare polymorphic variables.

## Class name aliases and AutoImport

All Java classes are declared to exist in the Typescript module `Java`. Each Java package is mapped to a Typescript module. For example, a class such as `java.lang.String` is declared in nested Typescript modules as:

```typescript
declare module Java {
	...
   export module java.lang {
    	export interface String extends Java.java.lang.Object {
   		}
   }
   ...
}
```
In your Typescript application, you can refer to Java classes using fully qualified type paths such as `Java.java.lang.String`. Clearly this is too verbose. `ts-java` addresses this by declaring type aliases for all classes that have a unique class names. The `java.d.ts` file includes a section like this:

```typescript
declare module Java {
	...
	export import Object = java.lang.Object;
	export import String = java.lang.String;
	...
}
```

This allows you to write just `Java.String` instead of `Java.java.lang.String`.

To get access to a class via node-java, you typically use java.import(), such as:

```
	import java = require('java');
	...
	var String = java.import('java.lang.String');
```

`ts-java` provides a feature to make this simpler, which is enabled by adding an `autoImportPath` property to the `tsjava` property of your package.json file, specifing the path to which `tsjava` should write a Typescript source file. For example:

```json
 "tsjava": {
   "classpath": [
     "target/dependency/**/*.jar"
   ],
   "autoImportPath": "lib/autoImport.ts",
   ...
   },
 ...
```

Your application can then do this:

```typescript
import autoImport = require('lib/autoImport');
...
var String = autoImport('String');
```

See `featureset/features/auto_import.feature` for more information.

## Examples

The directories `hellojava`, `featureset`, `reflection` and `tinkerpop` contain working examples of using `ts-java`.

Three of these examples include [Cucumber](https://github.com/cucumber/cucumber-js) tests. The `.feature` files document various aspects of how to use `ts-java` and what to expect from the generated Typescript declarations.

#### hellojava

This is a tiny test built from one trivial Java class `HelloJava` implementing one static method. See `hellojava/features/hellojava.feature` for *Hello World* style examples of using ts-java.

#### featureset

This directory contains Cucumber `.feature` files that are intended to provide good coverage of the `ts-java` feature set. The files in `featureset/features/*.feature` provide examples and documentation for most of the `ts-java` feature set. If you find some aspect of `ts-java` is not adequately covered in these `.feature` files, we encourage you to submit an issue.

#### reflection

`ts-java` is written in Typescript and uses Java [Reflection](http://docs.oracle.com/javase/8/docs/api/java/lang/reflect/package-summary.html), so it needs a `java.d.ts` file (in `lib/java.d.ts`). The `reflection/` directory uses `ts-java` to generate this `java.d.ts` file. We did this by bootstrapping from a hand-coded `java.d.ts` file, and then switching to the generated `java.d.ts` file once `ts-java` was able to generate a valid file. The project `Makefile` contains rules to declare the build broken if the `java.d.ts` generated in `reflection/` differs from `lib/java.d.ts` used by `ts-java` sources, forcing us to keep the file up to date.

#### tinkerpop

[Tinkerpop3](http://www.tinkerpop.com/) is an An Open Source Graph Computing Framework and is the primary use case that motivated us to create ts-java. If you are also a Tinkerpop user, check out [ts-tinkerop](https://github.com/RedSeal-co/ts-tinkerpop), a small library with utilties built on top of the Tinkerpop interfaces exposed by the `java.d.ts` declaration file.

[java]: http://en.wikipedia.org/wiki/Java_(programming_language)
