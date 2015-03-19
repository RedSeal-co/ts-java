'use strict';

// ### AsyncOptions
// ts-java must be informed of the asyncOptions that the application will use to initialize java.
// For simplicity, we use the same property names as used by java.asyncOptions, though we omit
// the `promisify` property, which is irrelevent to ts-java.


interface AsyncOptions {
  // `syncSuffix`: if defined, the suffix used by node-java to export methods using sync API
  // if undefined, the ts-java will not declare sync API methods.
  syncSuffix?: string;

  // `asyncSuffix`: if defined, the suffix used by node-java to export methods using async API
  // if undefined, the ts-java will not declare async API methods.
  asyncSuffix?: string;

  // `promiseSuffix`: if defined, the suffix used by node-java to export methods using Promises/A+ API.
  // if undefined, the ts-java will not declare Promises/A+ API methods.
  promiseSuffix?: string;
}

export = AsyncOptions;
