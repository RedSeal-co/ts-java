'use strict';

// TsJavaOptions is the json structure we expect to find in package.json under the key 'tsjava'
interface TsJavaOptions {
  classpath: Array<string>;
    // The java class path, i.e. an array paths to .jars or .class files.

  seedClasses: Array<string>;
    // The set of java classes from which to start crawling, bringing in all java classes
    // reachable from the seeds that match the whiteList expressions below.

  whiteList: Array<string>;
    // A set of partial class paths for the classes of interest.
    // Any classes seen during crawl that are not matched by a member of this white list
    // are ignored. References to those classes (in say method argument lists) are turned to typescript 'any' type.

  granularity?: string;
    // 'package' or 'class'. Defaults to 'package'. 'class' is currently an undocumented/unsupported option.

  outputPath?: string;
    // The path to write the output java.d.ts file to. Defaults to 'java.d.ts'.

  promisesPath?: string;
    // The path for the .d.ts file for the promises library.
    // Defaults to '../bluebird/bluebird.d.ts'.
    // Promises libraries other than bluebird are currently not supported, though might work.
}

export = TsJavaOptions;
