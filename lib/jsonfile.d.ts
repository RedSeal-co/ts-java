declare module 'jsonfile' {

  export interface Callback {
    (err: any, obj: any): void;
  }

  export function readFile(path: string, cb: Callback);
}
