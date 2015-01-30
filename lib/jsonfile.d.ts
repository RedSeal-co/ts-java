declare module 'jsonfile' {

  export interface Callback {
    (err: any, obj: any): any;
  }

  export function readFile(path: string, cb: Callback);
}
