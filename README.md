# ts-java

*Create TypeScript declaration files for Java packages.*

[Typescript](http://www.typescriptlang.org) provides the ability for Javascript programmers to write typesafe code.

[Java][java] is a typesafe language that provides a Reflection API allowing introspection
of Java classes to determine type information for classes and methods.

[Node-java](https://github.com/joeferner/node-java) is a node.js package that provides a Bridge API for node.js applications
to connect to Java APIs.

**ts-java** is a tool that generates Typescript declaration files for Java classes,
allowing Typescript programmers to use Java classes in their node.js applications
with type safety comparable to using Java directly.

## Status

ts-java is still being developed, but may be useful as is for some projects. Note that Java Generics type information
should map well to Typescript but is not yet implemented.

## Installation

If you are able to, it's convenient to install ts-java globally:

```bash
$ npm install -g ts-java
```

But you can also intall ts-java as a dev dependency and run it from ./node_modules/.bin/ts-java:

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
    "seedClasses": [
      "com.tinkerpop.gremlin.structure.Graph",
      "com.tinkerpop.gremlin.tinkergraph.structure.TinkerGraph",
      "com.tinkerpop.gremlin.tinkergraph.structure.TinkerFactory",
      "java.util.ArrayList"
    ],
    "whiteList": [
      "java.util.",
      "java.math.",
      "com.tinkerpop.gremlin."
    ]
  }
}
```

We'll explain what the properties classpath, seedClasses, and whiteList mean below. Assuming they are properly
specified, ts-java can be run in the project's root directory to generate a java.d.ts file:

```bash
$ ts-java
ts-java version 0.0.1
Generated java.d.ts file with 123 classes.
Omitted 43 classes.
$
```

The tsjava property in the package.json must define three nested properties:
* `classpath`: an array of glob expressions for the files to be added to the java classpath. It should be the same classpath
that you will use to initialize node-java to run your application.
* `seedClasses`: an array of class paths to seed the set of classes that ts-java will analyze and generate interfaces for.
You don't need to explicitly specify all classes you want to generate Typescript interfaces for. ts-java will 'crawl' your
Java classes starting from the seed classes. Whenever a new class is referenced ts-java checks to see if it
is allowed by the `whiteList` (see below), and if it is, then ts-java will analyze that class and transitively
all white-listed classes it references.
* `whiteList`: an array of regular expressions that classes much match in order to be included in the output.
Any referenced class *not* included in the white list will be omitted from the generated `java.d.ts` declaration
file. All references to such omitted classes will be translated as the `any` type.

[java]: http://en.wikipedia.org/wiki/Java_(programming_language)
