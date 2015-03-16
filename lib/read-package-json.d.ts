declare module 'read-package-json' {

  interface Callback {
    (err: any, obj: any): void;
  }

  function readFile(path: string, logFunction: any, strict: boolean, cb: Callback): void;

  export = readFile;
}
