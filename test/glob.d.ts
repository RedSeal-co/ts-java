declare module 'glob' {
  interface Glob {
    sync(pattern: string): Array<string>;
  }
  var glob: Glob;
  export = glob;
}
