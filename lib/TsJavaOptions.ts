'use strict';

import AsyncOptions = require('./AsyncOptions');

// ### TsJavaOptions

// TsJavaOptions is the json structure we expect to find in package.json under the key 'tsjava'
interface TsJavaOptions {
  classpath: Array<string>;
    // The java class path, i.e. an array paths to .jars or .class files.
    // Note: ts-java allows glob expressions here, e.g. 'target/**/*.jar'.
    // However ClassesMap expects this to be an expanded array of file paths.

  classes?: Array<string>;
    // The set of java classes the application requires, for finer-grained control than packages.

  seedClasses?: Array<string>;
    // A deprecated alias for classes.

  packages: Array<string>;
    // A set of packages class paths for packages to include.
    // All classes in each of these packages will be included.

  whiteList?: Array<string>;
    // A deprecated alias for packages.

  granularity?: string;
    // 'package' or 'class'. Defaults to 'package'. 'class' is currently an undocumented/unsupported option.

  outputPath?: string;
    // The path to write the output java.d.ts file to. Defaults to 'java.d.ts'.

  promisesPath?: string;
    // The path for the .d.ts file for the promises library.
    // Defaults to '../bluebird/bluebird.d.ts'.
    // Promises libraries other than bluebird are currently not supported, though might work.

  autoImportPath?: string;
    // The path where ts-java will write a source file defining the autoImport function.

  asyncOptions?: AsyncOptions;
    // The asyncOptions which will be used to initalize Java.
    // Note, currently it is up to the developer to ensure the options specified here match
    // the options used to initalize the java module.
}

export = TsJavaOptions;
