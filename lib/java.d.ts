declare module Java {

  export interface JavaMethod {
    getNameSync(): string;
    getDeclaringClassSync(): JavaClass;
    getReturnTypeSync(): JavaClass;
    getParameterTypesSync(): Array<JavaClass>;
    getParametersSync(): Array<JavaParameter>;
    isVarArgsSync(): boolean;
    toGenericStringSync(): string;
    toStringSync(): string;
  }

  export interface JavaClass {
    getNameSync(): string;
    getTypeNameSync(): string;
    getInterfacesSync(): Array<JavaClass>;
    getMethodsSync(): Array<JavaMethod>;
  }

  export interface JavaParameter {
    getNameSync(): string;
  }

  export interface JavaLoader {
    loadClassSync(string): JavaClass;
  }

  export interface Instance {
    classpath: Array<string>;
    callStaticMethodSync(className: string, methodName: string): any;
    getClassLoader(): JavaLoader;
  }

}

declare module 'java' {
  var java: Java.Instance;
  export = java;
}
