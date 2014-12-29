declare module Java {

  export interface JavaMethod {
    getNameSync(): string;
    getDeclaringClassSync(): JavaClass;
    getReturnTypeSync(): JavaClass;
    getParameterTypesSync(): Array<JavaClass>;
    isVarArgsSync(): boolean;
    toGenericStringSync(): string;
    toStringSync(): string;
  }

  export interface JavaClass {
    getNameSync(): string;
    getInterfacesSync(): Array<JavaClass>;
    getMethodsSync(): Array<JavaMethod>;
  }

  export interface JavaLoader {
    loadClassSync(string): JavaClass;
  }

  export interface Java {
    callStaticMethodSync(className: string, methodName: string): any;
    getClassLoader(): JavaLoader;
  }

}

// declare function Gremlin(opts?: Object): Gremlin.Gremlin;

declare module 'gremlin-v3' {
  class Gremlin {
    java: Java.Java;
    new (opts?: Object);
  }

  export = Gremlin;
}
