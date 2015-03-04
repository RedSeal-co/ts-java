declare module 'ls-archive' {

  export interface ArchiveEntry {
    isFile(): boolean;
    isFolder(): boolean;
    isSymbolicLink(): boolean;
    getPath(): string;
  }

  export function list(archivePath: string, callback: (err: Error, entries: ArchiveEntry[]) => void): void;
}
