declare module Java {

  export interface Method {
    getNameSync(): string;
    getDeclaringClassSync(): Class;
    getReturnTypeSync(): Class;
    getParameterTypesSync(): Array<Class>;
    getParametersSync(): Array<Parameter>;
    isVarArgsSync(): boolean;
    toGenericStringSync(): string;
    toStringSync(): string;
  }

  export interface Class {
    getNameSync(): string;
    getTypeNameSync(): string;
    getInterfacesSync(): Array<Class>;
    getMethodsSync(): Array<Method>;
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

  export interface Entry {
    classpath: Array<string>;
    callStaticMethodSync(className: string, methodName: string): any;
    getClassLoader(): Loader;
  }

}

declare module 'java' {
  var java: Java.Entry;
  export = java;
}
