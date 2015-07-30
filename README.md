# ts-java

[![Build Status](https://travis-ci.org/RedSeal-co/ts-java.svg?branch=master)](https://travis-ci.org/RedSeal-co/ts-java)

*Create TypeScript declaration files for Java packages.*

[Typescript](http://www.typescriptlang.org) provides the ability for Javascript programmers to write typesafe code.

[Java][java] is a typesafe language that provides a [Reflection](http://docs.oracle.com/javase/7/docs/api/java/lang/reflect/package-summary.html) API allowing introspection
of Java classes to determine type information for classes and methods.

[Node-java](https://github.com/joeferner/node-java) is a node.js package that provides a Bridge API for node.js applications
to connect to Java APIs.

**ts-java** is a tool that generates Typescript declaration files for Java classes,
allowing Typescript programmers to use Java classes in their node.js applications
with type safety comparable to using Java directly.

## Discusion Forum

Please use the [node-java discussion forum](https://groups.google.com/forum/#!forum/node-java) for discussion of ts-java.

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
     "target/**/*.jar"
   ],
   "packages": [
     "java.util.*",
     "java.util.function.*",
     "java.math.*",
     "org.apache.tinkerpop.gremlin.**"
   ],
   "classes": [
      "java.lang.Boolean",
      "java.lang.Long",
   ],
 }
}
```

We'll explain what the properties `classpath`, `classes`, and `packages` mean below. Assuming they are properly specified, `ts-java` can be run in the project's root directory to generate a `tsJavaModule.ts` file (the name `tsJavaModule.ts` is customizable, see below):

```bash
$ ts-java
ts-java version 1.0.3
Generated tsJavaModule.ts with 13 classes.
Excluded 20 classes referenced as method parameters.
Excluded 6 classes referenced as *interfaces*.
Excluded 1 classes referenced as *superclasses*.
$
```

The `tsjava` property in the `package.json` must define four nested properties:

* `tsJavaModulePath`: The file path for the output file. In this README we assume the file is named `tsJavaModule.ts`, but you're free to give it any name you choose, and to specify that it be written to a directory, e.g. `./lib/myJavaModule.ts`.

* `classpath`: an array of glob expressions for the files to be added to the java classpath. It should be the same classpath that you will use to initialize node-java to run your application. In addition to the classes specified in `classpath`, `ts-java` automatically includes the Java runtime library classes.

* `packages`: an array of package expression strings. Each string is interpreted as matching a package or a family of nested packages. Expressions should be of one of these two forms:
    1. `path.to.some.package.*`
    2. `path.to.some.package.**`

    The first form matches all classes directly in `path.to.some.package` but does not match any nested packages. The second form matches all classes in all packages rooted at `path.to.some.package`.
    
* `classes`: an array of full class paths for classes that ts-java will generate interfaces for. If you want some but not all classes in a package, specify those classes here.

The `tsjava` property may also define these optional nested properties:

* `asyncOptions`: An object specifying the suffixes to use for the three variants of java methods created by [node-java](https://github.com/joeferner/node-java). See the [AsyncOptions](https://github.com/joeferner/node-java#asyncoptions-control-over-the-generation-of-sync-async--promise-method-variants) section of the node-java README. However, `ts-java` imposes constraints on the values that may be specified, due to the fact that generated `tsJavaModule.ts` must be compatible with the core node-java API defined in `DefinitelyTyped/java/java.d.ts`. The asyncOptions assumed by `java/java.d.ts` are:

```
    "asyncOptions": {
      "syncSuffix": "",
      "asyncSuffix": "A",
      "promiseSuffix": "P"
    }
```

If you don't need all three types of method variants (sync, async, promise) you may omit the corresponding suffix. In that case, `ts-java` will not generate declarations for methods of that variant. If you want to change the suffix type, you will need to create your own `java/java.d.ts` to use instead of the version maintained in DefinitelyTyped.

* `javaTypingsPath`: The relative path to the `java.d.ts`. This defaults to `typings/java/java.d.ts`, as installed by `tsd` from DefinitelyTyped.

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

You certainly can. But we expect that most node applications that use Java libraries will only use a subset of the classes implemented in the libraries. Including all classes results in a larger `tsJavaModule.ts` file, which can slow down Typescript compilation, and also make it more cumbersome to use a `tsJavaModule.ts` file as documentation for the Java library's API.

#### What happens with excluded classes?

If an excluded class is referenced as a method parameter, `ts-java` replaces the type with the Typescript type `any`. A future release may provide an option to instead omit methods that use excluded types.

If the excluded class is referenced as an interface or superclass, the Typescript declaration won't include that relationship, though the implemented methods of the excluded interface *will* be accessible. So, the only real limitation is that you won't be able to use the excluded type to declare polymorphic variables.

#### What about Java Runtime classes?

`ts-java` always includes `java.lang.Object` and `java.lang.String`, but any other Java Runtime classes you need must be specified in either the `packages` or `classes` sections of the `tsjava` configuration.


## The structure of the generated tsJavaModule.ts file

`ts-java` generates a Typescript source file which you must arrange to compile with the rest of your Typescript sources. The file declares interfaces for all of the Java classes specified in your package.json tsjava configuration, along with a few helper functions that you can use to import Java classes.

All Java classes are declared to exist in the Typescript module `Java`. Each Java package is mapped to a Typescript module. For example, a class such as `java.lang.String` is declared in nested Typescript modules as:

```typescript
declare module Java {
  ...
  export module java.lang {
    export interface String extends Java.java.lang.Object {
      ...
    }
  }
  ...
}
```
In your Typescript application, you can refer to Java classes using fully qualified type paths such as `Java.java.lang.String`. Clearly this is too verbose. `ts-java` addresses this by declaring type aliases for all classes that have unique class names. The `tsJavaModule.ts` file includes a section like this:

```typescript
declare module Java {
  ...
  export import Object = java.lang.Object;
  export import String = java.lang.String;
  ...
}
```

This allows you to write just `Java.String` instead of `Java.java.lang.String`.

To get access to a class via node-java, you typically use `java.import()`, such as:

```
  import java = require('java');
  ...
  var String = java.import('java.lang.String');
```

`ts-java` provides wrapper function `importClass()` that you must use instead to import Java classes. This function may be called with either the full class path, or with just the class name, whenever that class name uniquely determines one class from the set of classes you configured.

You application will typically use the `tsJavaModule.ts` file as follows:

```typescript
    import hellojava = require('../tsJavaModule');
    import Java = hellojava.Java;

    Java.ensureJvm().then((): void => {
        var HelloJava = Java.importClass('HelloJava');
	    ...
    });
```

See `featureset/features/auto_import.feature` for more information about using `importClass()` with short class names.

## Functions exported in the tsJavaModule.ts

The generated tsJavaModule.ts file will re-export most of the function exported by the node-java module, as specified in [java.d.ts](https://github.com/RedSeal-co/DefinitelyTyped/blob/prod/java/java.d.ts). In addition, the tsJavaModule.ts file includes:

#### `getJava(): NodeJavaAPI`
Returns the underlying java module.

#### `ensureJvm(): Promise<void>` 
Ensures that the JVM has been created. Idempotent, i.e 2nd and subsequent calls are no-ops.

#### `fullyQualifiedName(className: string): string`
Given a short class name (or a fully qualified class name) return the fully qualified classname. If the class name string is unrecognized, return `undefined`.

#### `importClass(className: string): <javaclasstype>`
Given a short or fully qualified classname, import the class and return its Static interface. Throws an exception for unrecognized class names. For example, either `importClass('java.lang.Object')` or `importClass('Object')` will import the class and return the proxy object whose type is `Java.java.lang.Object.Static`. See `featureset/features/autoImport.feature` for more information.

#### `asInstanceOf(obj: any, className: string): <javainstancetype>`
Given an object and a short or fully qualified classname, return the object casted to the given class type, or throw an exception if the cast is not valid.

#### `L(n: number): Java.longValue_t`
Given a number, return a value of type `longValue_t`, capable of representing a 64-bit integer.
*Defined only when java.lang.Long is included in the configuration.*

#### `isLongValue(obj: any): boolean`
Returns true if `obj` is a `longValue_t`.
*Defined only when java.lang.Long is included in the configuration.*

#### `isJavaObject(obj: any): boolean`
Returns true if `obj` is a Java object instance.

#### `instanceOf(obj: any, className: string): boolean`
Returns true if `obj` is a Java object instance of the specified class.

#### `forEach(javaIterator: Java.Iterator, consumer: ConsumeObject)`
Like `array.forEach()`. Applies the `consumer` function to each element returned by the iterator. See the documentation in the generated tsJavaModule.ts file for the definition of the ConsumeObject interface. See also `featureset/features/utilityFunctions.feature` for an example of use.
*Defined only when java.util.Iterator is included in the configuration.*

## Composing two or more Java libraries

If you are developing a large node application using multiple Java libraries you have a choice on how you use `ts-java`. You may generate a single `tsJavaModule.ts` file with all Java classes you use, or you may generate multiple modules reflecting the logical separation of the Java libraries you use. Each generated `tsJavaModule.ts` file is self-contained and can peacefully coexist with other `tsJavaModule.ts` files in one node process. The only subtlety we want to point out here has to to with passing objects between Java modules. Two independently generated `tsJavaModule.ts` files will contain some Java classes in common. At the very least they will each include `java.lang.Object` and `java.lang.String`, but they will likely include other classes. All such overlapping classes will generate interfaces that are largely compatible, but it is possible that there will be minor differences that will cause Typescript to think the classes are not compatible. 

For example, suppose in one library you include `java.lang.Class`, and in the other library you do not. This will cause `ts-java` to generate different signatures for the `getClass()` method of `java.lang.Object`.  Because of this, if code in your application needs to pass a Java object obtained from one ts-java module to another ts-java module you may need to use type casts/assertions. See `integration/features/composability.feature` for more information.

## Examples

The directories `hellojava`, `featureset`, `reflection` and `tinkerpop` contain working examples of using `ts-java`.

Three of these examples include [Cucumber](https://github.com/cucumber/cucumber-js) tests. The `.feature` files document various aspects of how to use `ts-java` and what to expect from the generated Typescript declarations.

#### hellojava

This is a tiny test built from one trivial Java class `HelloJava` implementing one static method. See `hellojava/features/hellojava.feature` for *Hello World* style examples of using ts-java.

#### featureset

This directory contains Cucumber `.feature` files that are intended to provide good coverage of the `ts-java` feature set. The files in `featureset/features/*.feature` provide examples and documentation for most of the `ts-java` feature set. If you find some aspect of `ts-java` is not adequately covered in these `.feature` files, we encourage you to submit an issue.

#### reflection

`ts-java` is written in Typescript and uses Java [Reflection](http://docs.oracle.com/javase/8/docs/api/java/lang/reflect/package-summary.html), so it needs a `tsJavaModule.ts` file (in `lib/reflection.ts`). The `reflection/` directory uses `ts-java` to generate this `reflection/tsJavaModule.ts` file. The project `Makefile` contains rules to declare the build broken if the `reflection/tsJavaModule.ts` differs from `lib/reflection.ts`, forcing us to keep the file up to date.

#### tinkerpop

[Tinkerpop3](http://www.tinkerpop.com/) is an An Open Source Graph Computing Framework and is the primary use case that motivated us to create ts-java. If you are also a Tinkerpop user, check out [ts-tinkerpop](https://github.com/RedSeal-co/ts-tinkerpop), a small library with utilities built on top of the Tinkerpop interfaces exposed by the `java.d.ts` declaration file.

#### integration

The directory `integration/` contains a cucumber feature file that illustrates the integration of multiple independently generated ts-java modules, by using the ts-java modules created for `hellojava`, `featureset`, and `reflection`.

[java]: http://en.wikipedia.org/wiki/Java_(programming_language)
