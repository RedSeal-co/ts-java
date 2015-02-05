declare module Java {

  export interface Executable {
    getNameSync(): string;
    getDeclaringClassSync(): Class;
    getParameterTypesSync(): Array<Class>;
    getParametersSync(): Array<Parameter>;
    getModifiersSync(): number;
    isVarArgsSync(): boolean;
    toGenericStringSync(): string;
    toStringSync(): string;
  }

  export interface Method extends Executable {
    getReturnTypeSync(): Class;
  }

  export interface Constructor extends Executable {
  }

  export interface Class {
    getNameSync(): string;
    getCanonicalNameSync(): string;
    getTypeNameSync(): string;
    getInterfacesSync(): Array<Class>;
    getMethodsSync(): Array<Method>;
    getConstructorsSync(): Array<Constructor>;
    isArraySync(): boolean;
    isInterfaceSync(): boolean;
    isPrimitiveSync(): boolean;
    getSuperclassSync(): Class;
  }

  export interface Parameter {
    getNameSync(): string;
  }

  export interface Loader {
    loadClassSync(string): Class;
  }

  interface Callback {
    (err: any, value: any): void;
  }

  // *Singleton* declares methods & members exported by the node java module.
  export interface Singleton {
    classpath: Array<string>;
    import(className: string): any;
    callMethod(instance: any, className: string, methodName: string, args: any[], callback: Callback): void;
    callMethodSync(instance: any, className: string, methodName: string, ...args: any[]): any;
    callStaticMethodSync(className: string, methodName: string, ...args: any[]): any;
    getClassLoader(): Loader;
  }

}

declare module 'java' {
  var java: Java.Singleton;
  export = java;
}
