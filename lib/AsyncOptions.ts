'use strict';

// ### AsyncOptions

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

  // `promisfy`: if defined, the promisification function used by node-java.
  // ts-java ignores this property.
  promisify?: Function;
}

export = AsyncOptions;
