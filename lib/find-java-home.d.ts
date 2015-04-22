declare module 'find-java-home' {

  interface Callback {
    (err: Error, home: string): void;
  }

  function findJavaHome(cb: Callback): void;

  export = findJavaHome;
}
