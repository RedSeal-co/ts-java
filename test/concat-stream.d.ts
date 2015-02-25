declare module 'concat-stream' {
  import stream = require('stream');
  function concat(opts: Object, resolve: () => void): stream.Writable;
  export = concat;
}
