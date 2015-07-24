// tsJavaModule.ts
// This file was generated by ts-java.
/// <reference path="../typings/java/java.d.ts" />

// Generated using the following tsjava options:
// tsJavaModulePath:
//   tsJavaModule.ts
// classpath:
//   target/hellojava-1.0.0.jar
// classes:
//   com.redseal.hellojava.HelloJava
// packages:
//   <none>

/* tslint:disable:max-line-length class-name */

declare function require(name: string): any;
require('source-map-support').install();

import _java = require('java');
import BluePromise = require('bluebird');
import path = require('path');

_java.asyncOptions = {
    syncSuffix: '',
    asyncSuffix: 'A',
    promiseSuffix: 'P',
    promisify: BluePromise.promisify
};

// JVM initialization callback which adds tsjava.classpath to the JVM classpath.
function beforeJvm(): BluePromise<void> {
  var moduleJars: string[] = ['target/hellojava-1.0.0.jar'];
  moduleJars.forEach((jarPath: string) => {
    _java.classpath.push(path.join(__dirname, '', jarPath));
  });
  return BluePromise.resolve();
}

_java.registerClientP(beforeJvm);

export module Java {
  'use strict';

  interface StringDict {
    [index: string]: string;
  }

  export type NodeJavaAPI = typeof _java;

  export function getJava(): NodeJavaAPI {
    return _java;
  }

  export function ensureJvm(): Promise<void> {
    return _java.ensureJvm();
  }


  // Return the fully qualified class path for a class name.
  // Returns undefined if the className is ambiguous or not present in the configured classes.
  export function fullyQualifiedName(className: string): string {
    var shortToLongMap: StringDict = {
      'HelloJava': 'com.redseal.hellojava.HelloJava',
      'Object': 'java.lang.Object',
      'String': 'java.lang.String'
    };
    return shortToLongMap[className];
  }

  export function importClass(className: 'HelloJava'): Java.com.redseal.hellojava.HelloJava.Static;
  export function importClass(className: 'Object'): Java.java.lang.Object.Static;
  export function importClass(className: 'String'): Java.java.lang.String.Static;
  export function importClass(className: 'com.redseal.hellojava.HelloJava'): Java.com.redseal.hellojava.HelloJava.Static;
  export function importClass(className: 'java.lang.Object'): Java.java.lang.Object.Static;
  export function importClass(className: 'java.lang.String'): Java.java.lang.String.Static;
  export function importClass(className: string): any;
  export function importClass(className: string): any {
    var fullName: string = fullyQualifiedName(className) || className;
    return _java.import(fullName);
  }

  export interface Callback<T> {
    (err?: Error, result?: T): void;
  }

  // Returns true if javaObject is an instance of the named class, which may be a short className.
  // Returns false if javaObject is not an instance of the named class.
  // Throws an exception if the named class does not exist, or is an ambiguous short name.
  export function instanceOf(javaObject: any, className: string): boolean {
    var fullName: string = fullyQualifiedName(className) || className;
    return _java.instanceOf(javaObject, fullName);
  }






  export function newInstanceA(className: 'com.redseal.hellojava.HelloJava', cb: Callback<Java.HelloJava>): void;
  export function newInstanceA(className: 'java.lang.Object', cb: Callback<object_t>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: string_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: string_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: string_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', arg0: object_array_t, cb: Callback<string>): void;
  export function newInstanceA(className: 'java.lang.String', cb: Callback<string>): void;
  export function newInstanceA(className: string, ...args: any[]): void;
  export function newInstanceA(className: string, ...args: any[]): any {
    args.unshift(className);
    return _java.newInstance.apply(_java, args);
  }

  export function newInstance(className: 'com.redseal.hellojava.HelloJava'): Java.HelloJava;
  export function newInstance(className: 'java.lang.Object'): object_t;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: string_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: string_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t, arg1: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_t): string;
  export function newInstance(className: 'java.lang.String', arg0: string_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t): string;
  export function newInstance(className: 'java.lang.String', arg0: object_array_t): string;
  export function newInstance(className: 'java.lang.String'): string;
  export function newInstance(className: string, ...args: any[]): any;
  export function newInstance(className: string, ...args: any[]): any {
    args.unshift(className);
    return _java.newInstanceSync.apply(_java, args);
  }

  export function newInstanceP(className: 'com.redseal.hellojava.HelloJava'): Promise<Java.HelloJava>;
  export function newInstanceP(className: 'java.lang.Object'): Promise<object_t>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: string_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t, arg2: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: string_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t, arg1: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: string_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String', arg0: object_array_t): Promise<string>;
  export function newInstanceP(className: 'java.lang.String'): Promise<string>;
  export function newInstanceP(className: string, ...args: any[]): Promise<any>;
  export function newInstanceP(className: string, ...args: any[]): Promise<any> {
    args.unshift(className);
    return _java.newInstanceP.apply(_java, args);
  }

  export function newArray(className: 'com.redseal.hellojava.HelloJava', arg: Java.HelloJava[]): array_t<com.redseal.hellojava.HelloJava>;
  export function newArray(className: 'java.lang.Object', arg: object_t[]): array_t<java.lang.Object>;
  export function newArray(className: 'java.lang.String', arg: string_t[]): array_t<java.lang.String>;
  export function newArray<T>(className: string, arg: any[]): array_t<T>;
  export function newArray<T>(className: string, arg: any[]): array_t<T> {
    return _java.newArray(className, arg);
  }

  // export module Java {

  // Node-java has special handling for methods that return long or java.lang.Long,
  // returning a Javascript Number but with an additional property longValue.
  export interface longValue_t extends Number {
    longValue: string;
  }

  // Node-java can automatically coerce a javascript string into a java.lang.String.
  // This special type alias allows to declare that possiblity to Typescript.
  export type string_t = string | Java.java.lang.String;

  // Java methods that take java.lang.Object parameters implicitly will take a java.lang.String.
  // But string_t is not sufficient for this case, we need object_t.
  export type object_t = Java.java.lang.Object | string | boolean | number | longValue_t;

  // Java methods that take long or java.lang.Long parameters may take javascript numbers,
  // longValue_t (see above) or java.lang.Long.
  // This special type alias allows to declare that possiblity to Typescript.
  export type long_t = number | longValue_t ;

  // Handling of other primitive numeric types is simpler, as there is no loss of precision.
  export type boolean_t = boolean ;
  export type short_t = number ;
  export type integer_t = number ;
  export type double_t = number ;
  export type float_t = number ;
  export type number_t = number ;

  export interface array_t<T> extends Java.java.lang.Object {
    // This is an opaque type for a java array_t T[];
    // Use Java.newArray<T>(className, [...]) to create wherever a Java method expects a T[],
    // most notably for vararg parameteters.
    __dummy: T;
  }

  export type object_array_t = array_t<Java.java.lang.Object> | object_t[];

  export import HelloJava = com.redseal.hellojava.HelloJava;
  export import Object = java.lang.Object;
  export import String = java.lang.String;

  export module com.redseal.hellojava {
    export interface HelloJava extends Java.java.lang.Object {
      // public boolean java.lang.Object.equals(java.lang.Object)
      equalsA(arg0: object_t, cb: Callback<object_t>): void;
      equals(arg0: object_t): object_t;
      equalsP(arg0: object_t): Promise<object_t>;
      // public final native java.lang.Class<?> java.lang.Object.getClass()
      getClassA( cb: Callback<object_t>): void;
      getClass(): object_t;
      getClassP(): Promise<object_t>;
      // public native int java.lang.Object.hashCode()
      hashCodeA( cb: Callback<object_t>): void;
      hashCode(): object_t;
      hashCodeP(): Promise<object_t>;
      // public final native void java.lang.Object.notify()
      notifyA( cb: Callback<void>): void;
      notify(): void;
      notifyP(): Promise<void>;
      // public final native void java.lang.Object.notifyAll()
      notifyAllA( cb: Callback<void>): void;
      notifyAll(): void;
      notifyAllP(): Promise<void>;
      // public java.lang.String java.lang.Object.toString()
      toStringA( cb: Callback<string>): void;
      toString(): string;
      toStringP(): Promise<string>;
      // public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException
      waitA(arg0: object_t, arg1: object_t, cb: Callback<void>): void;
      wait(arg0: object_t, arg1: object_t): void;
      waitP(arg0: object_t, arg1: object_t): Promise<void>;
      // public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException
      waitA(arg0: object_t, cb: Callback<void>): void;
      wait(arg0: object_t): void;
      waitP(arg0: object_t): Promise<void>;
      // public final void java.lang.Object.wait() throws java.lang.InterruptedException
      waitA( cb: Callback<void>): void;
      wait(): void;
      waitP(): Promise<void>;
    }
    export module HelloJava {
      export interface Static {
        new (): com.redseal.hellojava.HelloJava;
        // public static java.lang.String com.redseal.hellojava.HelloJava.sayHello()
        sayHelloA( cb: Callback<string>): void;
        sayHello(): string;
        sayHelloP(): Promise<string>;
      }
    }
  }

  export module java.lang {
    export interface Object  {
      // public boolean java.lang.Object.equals(java.lang.Object)
      equalsA(arg0: object_t, cb: Callback<object_t>): void;
      equals(arg0: object_t): object_t;
      equalsP(arg0: object_t): Promise<object_t>;
      // public final native java.lang.Class<?> java.lang.Object.getClass()
      getClassA( cb: Callback<object_t>): void;
      getClass(): object_t;
      getClassP(): Promise<object_t>;
      // public native int java.lang.Object.hashCode()
      hashCodeA( cb: Callback<object_t>): void;
      hashCode(): object_t;
      hashCodeP(): Promise<object_t>;
      // public final native void java.lang.Object.notify()
      notifyA( cb: Callback<void>): void;
      notify(): void;
      notifyP(): Promise<void>;
      // public final native void java.lang.Object.notifyAll()
      notifyAllA( cb: Callback<void>): void;
      notifyAll(): void;
      notifyAllP(): Promise<void>;
      // public java.lang.String java.lang.Object.toString()
      toStringA( cb: Callback<string>): void;
      toString(): string;
      toStringP(): Promise<string>;
      // public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException
      waitA(arg0: object_t, arg1: object_t, cb: Callback<void>): void;
      wait(arg0: object_t, arg1: object_t): void;
      waitP(arg0: object_t, arg1: object_t): Promise<void>;
      // public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException
      waitA(arg0: object_t, cb: Callback<void>): void;
      wait(arg0: object_t): void;
      waitP(arg0: object_t): Promise<void>;
      // public final void java.lang.Object.wait() throws java.lang.InterruptedException
      waitA( cb: Callback<void>): void;
      wait(): void;
      waitP(): Promise<void>;
    }
    export module Object {
      export interface Static {
        new (): java.lang.Object;
      }
    }
  }

  export module java.lang {
    export interface String extends Java.java.lang.Object {
      // public char java.lang.String.charAt(int)
      charAtA(arg0: object_t, cb: Callback<object_t>): void;
      charAt(arg0: object_t): object_t;
      charAtP(arg0: object_t): Promise<object_t>;
      // public default java.util.stream.IntStream java.lang.CharSequence.chars()
      charsA( cb: Callback<object_t>): void;
      chars(): object_t;
      charsP(): Promise<object_t>;
      // public int java.lang.String.codePointAt(int)
      codePointAtA(arg0: object_t, cb: Callback<object_t>): void;
      codePointAt(arg0: object_t): object_t;
      codePointAtP(arg0: object_t): Promise<object_t>;
      // public int java.lang.String.codePointBefore(int)
      codePointBeforeA(arg0: object_t, cb: Callback<object_t>): void;
      codePointBefore(arg0: object_t): object_t;
      codePointBeforeP(arg0: object_t): Promise<object_t>;
      // public int java.lang.String.codePointCount(int,int)
      codePointCountA(arg0: object_t, arg1: object_t, cb: Callback<object_t>): void;
      codePointCount(arg0: object_t, arg1: object_t): object_t;
      codePointCountP(arg0: object_t, arg1: object_t): Promise<object_t>;
      // public default java.util.stream.IntStream java.lang.CharSequence.codePoints()
      codePointsA( cb: Callback<object_t>): void;
      codePoints(): object_t;
      codePointsP(): Promise<object_t>;
      // public int java.lang.String.compareTo(java.lang.String)
      compareToA(arg0: string_t, cb: Callback<object_t>): void;
      compareTo(arg0: string_t): object_t;
      compareToP(arg0: string_t): Promise<object_t>;
      // public int java.lang.String.compareTo(java.lang.Object)
      compareToA(arg0: object_t, cb: Callback<object_t>): void;
      compareTo(arg0: object_t): object_t;
      compareToP(arg0: object_t): Promise<object_t>;
      // public int java.lang.String.compareToIgnoreCase(java.lang.String)
      compareToIgnoreCaseA(arg0: string_t, cb: Callback<object_t>): void;
      compareToIgnoreCase(arg0: string_t): object_t;
      compareToIgnoreCaseP(arg0: string_t): Promise<object_t>;
      // public java.lang.String java.lang.String.concat(java.lang.String)
      concatA(arg0: string_t, cb: Callback<string>): void;
      concat(arg0: string_t): string;
      concatP(arg0: string_t): Promise<string>;
      // public boolean java.lang.String.contains(java.lang.CharSequence)
      containsA(arg0: object_t, cb: Callback<object_t>): void;
      contains(arg0: object_t): object_t;
      containsP(arg0: object_t): Promise<object_t>;
      // public boolean java.lang.String.contentEquals(java.lang.StringBuffer)
      contentEqualsA(arg0: object_t, cb: Callback<object_t>): void;
      contentEquals(arg0: object_t): object_t;
      contentEqualsP(arg0: object_t): Promise<object_t>;
      // public boolean java.lang.String.contentEquals(java.lang.CharSequence)
      contentEqualsA(arg0: object_t, cb: Callback<object_t>): void;
      contentEquals(arg0: object_t): object_t;
      contentEqualsP(arg0: object_t): Promise<object_t>;
      // public boolean java.lang.String.endsWith(java.lang.String)
      endsWithA(arg0: string_t, cb: Callback<object_t>): void;
      endsWith(arg0: string_t): object_t;
      endsWithP(arg0: string_t): Promise<object_t>;
      // public boolean java.lang.Object.equals(java.lang.Object)
      equalsA(arg0: object_t, cb: Callback<object_t>): void;
      equals(arg0: object_t): object_t;
      equalsP(arg0: object_t): Promise<object_t>;
      // public boolean java.lang.String.equalsIgnoreCase(java.lang.String)
      equalsIgnoreCaseA(arg0: string_t, cb: Callback<object_t>): void;
      equalsIgnoreCase(arg0: string_t): object_t;
      equalsIgnoreCaseP(arg0: string_t): Promise<object_t>;
      // public void java.lang.String.getBytes(int,int,byte[],int)
      getBytesA(arg0: object_t, arg1: object_t, arg2: object_array_t, arg3: object_t, cb: Callback<void>): void;
      getBytes(arg0: object_t, arg1: object_t, arg2: object_array_t, arg3: object_t): void;
      getBytesP(arg0: object_t, arg1: object_t, arg2: object_array_t, arg3: object_t): Promise<void>;
      // public byte[] java.lang.String.getBytes(java.nio.charset.Charset)
      getBytesA(arg0: object_t, cb: Callback<object_t[]>): void;
      getBytes(arg0: object_t): object_t[];
      getBytesP(arg0: object_t): Promise<object_t[]>;
      // public byte[] java.lang.String.getBytes(java.lang.String) throws java.io.UnsupportedEncodingException
      getBytesA(arg0: string_t, cb: Callback<object_t[]>): void;
      getBytes(arg0: string_t): object_t[];
      getBytesP(arg0: string_t): Promise<object_t[]>;
      // public byte[] java.lang.String.getBytes()
      getBytesA( cb: Callback<object_t[]>): void;
      getBytes(): object_t[];
      getBytesP(): Promise<object_t[]>;
      // public void java.lang.String.getChars(int,int,char[],int)
      getCharsA(arg0: object_t, arg1: object_t, arg2: object_array_t, arg3: object_t, cb: Callback<void>): void;
      getChars(arg0: object_t, arg1: object_t, arg2: object_array_t, arg3: object_t): void;
      getCharsP(arg0: object_t, arg1: object_t, arg2: object_array_t, arg3: object_t): Promise<void>;
      // public final native java.lang.Class<?> java.lang.Object.getClass()
      getClassA( cb: Callback<object_t>): void;
      getClass(): object_t;
      getClassP(): Promise<object_t>;
      // public native int java.lang.Object.hashCode()
      hashCodeA( cb: Callback<object_t>): void;
      hashCode(): object_t;
      hashCodeP(): Promise<object_t>;
      // public int java.lang.String.indexOf(java.lang.String,int)
      indexOfA(arg0: string_t, arg1: object_t, cb: Callback<object_t>): void;
      indexOf(arg0: string_t, arg1: object_t): object_t;
      indexOfP(arg0: string_t, arg1: object_t): Promise<object_t>;
      // public int java.lang.String.indexOf(int,int)
      indexOfA(arg0: object_t, arg1: object_t, cb: Callback<object_t>): void;
      indexOf(arg0: object_t, arg1: object_t): object_t;
      indexOfP(arg0: object_t, arg1: object_t): Promise<object_t>;
      // public int java.lang.String.indexOf(java.lang.String)
      indexOfA(arg0: string_t, cb: Callback<object_t>): void;
      indexOf(arg0: string_t): object_t;
      indexOfP(arg0: string_t): Promise<object_t>;
      // public int java.lang.String.indexOf(int)
      indexOfA(arg0: object_t, cb: Callback<object_t>): void;
      indexOf(arg0: object_t): object_t;
      indexOfP(arg0: object_t): Promise<object_t>;
      // public native java.lang.String java.lang.String.intern()
      internA( cb: Callback<string>): void;
      intern(): string;
      internP(): Promise<string>;
      // public boolean java.lang.String.isEmpty()
      isEmptyA( cb: Callback<object_t>): void;
      isEmpty(): object_t;
      isEmptyP(): Promise<object_t>;
      // public int java.lang.String.lastIndexOf(java.lang.String,int)
      lastIndexOfA(arg0: string_t, arg1: object_t, cb: Callback<object_t>): void;
      lastIndexOf(arg0: string_t, arg1: object_t): object_t;
      lastIndexOfP(arg0: string_t, arg1: object_t): Promise<object_t>;
      // public int java.lang.String.lastIndexOf(int,int)
      lastIndexOfA(arg0: object_t, arg1: object_t, cb: Callback<object_t>): void;
      lastIndexOf(arg0: object_t, arg1: object_t): object_t;
      lastIndexOfP(arg0: object_t, arg1: object_t): Promise<object_t>;
      // public int java.lang.String.lastIndexOf(java.lang.String)
      lastIndexOfA(arg0: string_t, cb: Callback<object_t>): void;
      lastIndexOf(arg0: string_t): object_t;
      lastIndexOfP(arg0: string_t): Promise<object_t>;
      // public int java.lang.String.lastIndexOf(int)
      lastIndexOfA(arg0: object_t, cb: Callback<object_t>): void;
      lastIndexOf(arg0: object_t): object_t;
      lastIndexOfP(arg0: object_t): Promise<object_t>;
      // public int java.lang.String.length()
      lengthA( cb: Callback<object_t>): void;
      length(): object_t;
      lengthP(): Promise<object_t>;
      // public boolean java.lang.String.matches(java.lang.String)
      matchesA(arg0: string_t, cb: Callback<object_t>): void;
      matches(arg0: string_t): object_t;
      matchesP(arg0: string_t): Promise<object_t>;
      // public final native void java.lang.Object.notify()
      notifyA( cb: Callback<void>): void;
      notify(): void;
      notifyP(): Promise<void>;
      // public final native void java.lang.Object.notifyAll()
      notifyAllA( cb: Callback<void>): void;
      notifyAll(): void;
      notifyAllP(): Promise<void>;
      // public int java.lang.String.offsetByCodePoints(int,int)
      offsetByCodePointsA(arg0: object_t, arg1: object_t, cb: Callback<object_t>): void;
      offsetByCodePoints(arg0: object_t, arg1: object_t): object_t;
      offsetByCodePointsP(arg0: object_t, arg1: object_t): Promise<object_t>;
      // public boolean java.lang.String.regionMatches(boolean,int,java.lang.String,int,int)
      regionMatchesA(arg0: object_t, arg1: object_t, arg2: string_t, arg3: object_t, arg4: object_t, cb: Callback<object_t>): void;
      regionMatches(arg0: object_t, arg1: object_t, arg2: string_t, arg3: object_t, arg4: object_t): object_t;
      regionMatchesP(arg0: object_t, arg1: object_t, arg2: string_t, arg3: object_t, arg4: object_t): Promise<object_t>;
      // public boolean java.lang.String.regionMatches(int,java.lang.String,int,int)
      regionMatchesA(arg0: object_t, arg1: string_t, arg2: object_t, arg3: object_t, cb: Callback<object_t>): void;
      regionMatches(arg0: object_t, arg1: string_t, arg2: object_t, arg3: object_t): object_t;
      regionMatchesP(arg0: object_t, arg1: string_t, arg2: object_t, arg3: object_t): Promise<object_t>;
      // public java.lang.String java.lang.String.replace(java.lang.CharSequence,java.lang.CharSequence)
      replaceA(arg0: object_t, arg1: object_t, cb: Callback<string>): void;
      replace(arg0: object_t, arg1: object_t): string;
      replaceP(arg0: object_t, arg1: object_t): Promise<string>;
      // public java.lang.String java.lang.String.replace(char,char)
      replaceA(arg0: object_t, arg1: object_t, cb: Callback<string>): void;
      replace(arg0: object_t, arg1: object_t): string;
      replaceP(arg0: object_t, arg1: object_t): Promise<string>;
      // public java.lang.String java.lang.String.replaceAll(java.lang.String,java.lang.String)
      replaceAllA(arg0: string_t, arg1: string_t, cb: Callback<string>): void;
      replaceAll(arg0: string_t, arg1: string_t): string;
      replaceAllP(arg0: string_t, arg1: string_t): Promise<string>;
      // public java.lang.String java.lang.String.replaceFirst(java.lang.String,java.lang.String)
      replaceFirstA(arg0: string_t, arg1: string_t, cb: Callback<string>): void;
      replaceFirst(arg0: string_t, arg1: string_t): string;
      replaceFirstP(arg0: string_t, arg1: string_t): Promise<string>;
      // public java.lang.String[] java.lang.String.split(java.lang.String,int)
      splitA(arg0: string_t, arg1: object_t, cb: Callback<string[]>): void;
      split(arg0: string_t, arg1: object_t): string[];
      splitP(arg0: string_t, arg1: object_t): Promise<string[]>;
      // public java.lang.String[] java.lang.String.split(java.lang.String)
      splitA(arg0: string_t, cb: Callback<string[]>): void;
      split(arg0: string_t): string[];
      splitP(arg0: string_t): Promise<string[]>;
      // public boolean java.lang.String.startsWith(java.lang.String,int)
      startsWithA(arg0: string_t, arg1: object_t, cb: Callback<object_t>): void;
      startsWith(arg0: string_t, arg1: object_t): object_t;
      startsWithP(arg0: string_t, arg1: object_t): Promise<object_t>;
      // public boolean java.lang.String.startsWith(java.lang.String)
      startsWithA(arg0: string_t, cb: Callback<object_t>): void;
      startsWith(arg0: string_t): object_t;
      startsWithP(arg0: string_t): Promise<object_t>;
      // public java.lang.CharSequence java.lang.String.subSequence(int,int)
      subSequenceA(arg0: object_t, arg1: object_t, cb: Callback<object_t>): void;
      subSequence(arg0: object_t, arg1: object_t): object_t;
      subSequenceP(arg0: object_t, arg1: object_t): Promise<object_t>;
      // public java.lang.String java.lang.String.substring(int,int)
      substringA(arg0: object_t, arg1: object_t, cb: Callback<string>): void;
      substring(arg0: object_t, arg1: object_t): string;
      substringP(arg0: object_t, arg1: object_t): Promise<string>;
      // public java.lang.String java.lang.String.substring(int)
      substringA(arg0: object_t, cb: Callback<string>): void;
      substring(arg0: object_t): string;
      substringP(arg0: object_t): Promise<string>;
      // public char[] java.lang.String.toCharArray()
      toCharArrayA( cb: Callback<object_t[]>): void;
      toCharArray(): object_t[];
      toCharArrayP(): Promise<object_t[]>;
      // public java.lang.String java.lang.String.toLowerCase(java.util.Locale)
      toLowerCaseA(arg0: object_t, cb: Callback<string>): void;
      toLowerCase(arg0: object_t): string;
      toLowerCaseP(arg0: object_t): Promise<string>;
      // public java.lang.String java.lang.String.toLowerCase()
      toLowerCaseA( cb: Callback<string>): void;
      toLowerCase(): string;
      toLowerCaseP(): Promise<string>;
      // public java.lang.String java.lang.Object.toString()
      toStringA( cb: Callback<string>): void;
      toString(): string;
      toStringP(): Promise<string>;
      // public java.lang.String java.lang.String.toUpperCase(java.util.Locale)
      toUpperCaseA(arg0: object_t, cb: Callback<string>): void;
      toUpperCase(arg0: object_t): string;
      toUpperCaseP(arg0: object_t): Promise<string>;
      // public java.lang.String java.lang.String.toUpperCase()
      toUpperCaseA( cb: Callback<string>): void;
      toUpperCase(): string;
      toUpperCaseP(): Promise<string>;
      // public java.lang.String java.lang.String.trim()
      trimA( cb: Callback<string>): void;
      trim(): string;
      trimP(): Promise<string>;
      // public final void java.lang.Object.wait(long,int) throws java.lang.InterruptedException
      waitA(arg0: object_t, arg1: object_t, cb: Callback<void>): void;
      wait(arg0: object_t, arg1: object_t): void;
      waitP(arg0: object_t, arg1: object_t): Promise<void>;
      // public final native void java.lang.Object.wait(long) throws java.lang.InterruptedException
      waitA(arg0: object_t, cb: Callback<void>): void;
      wait(arg0: object_t): void;
      waitP(arg0: object_t): Promise<void>;
      // public final void java.lang.Object.wait() throws java.lang.InterruptedException
      waitA( cb: Callback<void>): void;
      wait(): void;
      waitP(): Promise<void>;
    }
    export module String {
      export interface Static {
        CASE_INSENSITIVE_ORDER: object_t;
        new (arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: string_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t, arg2: object_t, arg3: object_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t, arg2: object_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t, arg2: object_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t, arg2: object_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t): java.lang.String;
        new (arg0: object_array_t, arg1: string_t): java.lang.String;
        new (arg0: object_array_t, arg1: object_t): java.lang.String;
        new (arg0: object_t): java.lang.String;
        new (arg0: object_t): java.lang.String;
        new (arg0: string_t): java.lang.String;
        new (arg0: object_array_t): java.lang.String;
        new (arg0: object_array_t): java.lang.String;
        new (): java.lang.String;
        // public static java.lang.String java.lang.String.copyValueOf(char[],int,int)
        copyValueOfA(arg0: object_array_t, arg1: object_t, arg2: object_t, cb: Callback<string>): void;
        copyValueOf(arg0: object_array_t, arg1: object_t, arg2: object_t): string;
        copyValueOfP(arg0: object_array_t, arg1: object_t, arg2: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.copyValueOf(char[])
        copyValueOfA(arg0: object_array_t, cb: Callback<string>): void;
        copyValueOf(arg0: object_array_t): string;
        copyValueOfP(arg0: object_array_t): Promise<string>;
        // public static java.lang.String java.lang.String.format(java.util.Locale,java.lang.String,java.lang.Object...)
        formatA(arg0: object_t, arg1: string_t, arg2: object_array_t, cb: Callback<string>): void;
        format(arg0: object_t, arg1: string_t, ...arg2: object_t[]): string;
        format(arg0: object_t, arg1: string_t, arg2: object_array_t): string;
        formatP(arg0: object_t, arg1: string_t, ...arg2: object_t[]): Promise<string>;
        formatP(arg0: object_t, arg1: string_t, arg2: object_array_t): Promise<string>;
        // public static java.lang.String java.lang.String.format(java.lang.String,java.lang.Object...)
        formatA(arg0: string_t, arg1: object_array_t, cb: Callback<string>): void;
        format(arg0: string_t, ...arg1: object_t[]): string;
        format(arg0: string_t, arg1: object_array_t): string;
        formatP(arg0: string_t, ...arg1: object_t[]): Promise<string>;
        formatP(arg0: string_t, arg1: object_array_t): Promise<string>;
        // public static java.lang.String java.lang.String.join(java.lang.CharSequence,java.lang.CharSequence...)
        joinA(arg0: object_t, arg1: object_array_t, cb: Callback<string>): void;
        join(arg0: object_t, ...arg1: object_t[]): string;
        join(arg0: object_t, arg1: object_array_t): string;
        joinP(arg0: object_t, ...arg1: object_t[]): Promise<string>;
        joinP(arg0: object_t, arg1: object_array_t): Promise<string>;
        // public static java.lang.String java.lang.String.join(java.lang.CharSequence,java.lang.Iterable<? extends java.lang.CharSequence>)
        joinA(arg0: object_t, arg1: object_t, cb: Callback<string>): void;
        join(arg0: object_t, arg1: object_t): string;
        joinP(arg0: object_t, arg1: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(char[],int,int)
        valueOfA(arg0: object_array_t, arg1: object_t, arg2: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_array_t, arg1: object_t, arg2: object_t): string;
        valueOfP(arg0: object_array_t, arg1: object_t, arg2: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(java.lang.Object)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(char[])
        valueOfA(arg0: object_array_t, cb: Callback<string>): void;
        valueOf(arg0: object_array_t): string;
        valueOfP(arg0: object_array_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(boolean)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(long)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(int)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(float)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(double)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
        // public static java.lang.String java.lang.String.valueOf(char)
        valueOfA(arg0: object_t, cb: Callback<string>): void;
        valueOf(arg0: object_t): string;
        valueOfP(arg0: object_t): Promise<string>;
      }
    }
  }


  // } // module Java

} // module Module
