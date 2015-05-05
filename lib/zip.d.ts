declare module 'zip' {
  export = Zip;
}

declare module Zip {
  export interface Entry {
    getName(): string;
  }

  export interface EntryCallback {
    (entry: Entry): void;
  }

  export class _Reader {
    forEach(cb: EntryCallback): void;
  }

  export function Reader(fd: number): _Reader;
}