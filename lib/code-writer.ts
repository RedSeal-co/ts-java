/// <reference path='../node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path='../typings/glob/glob.d.ts' />
/// <reference path='../typings/handlebars/handlebars.d.ts' />
/// <reference path='../typings/lodash/lodash.d.ts' />
/// <reference path='../typings/node/node.d.ts' />

'use strict';

import _ = require('lodash');
import assert = require('assert');
import BluePromise = require('bluebird');
import ClassesMap = require('./classes-map');
import fs = require('fs');
import glob = require('glob');
import handlebars = require('handlebars');
import Immutable = require('immutable');
import path = require('path');
import TsJavaOptions = require('./TsJavaOptions');
import util = require('util');

interface StreamFn {
  (x: string): BluePromise<any>;
}

interface EndFn {
  (): BluePromise<any>;
}

interface HandlebarHelperOptions {
  fn: Function;
  hash: any;
}

// ## CodeWriter
// A class for writing Javascript/TypeScript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.ts.
class CodeWriter {

  private classesMap: ClassesMap;
  private classes: ClassesMap.ClassDefinitionMap;
  private sortedClasses: Array<ClassesMap.ClassDefinition>;
  private templates: Immutable.Map<string, HandlebarsTemplateDelegate>;

  constructor(classesMap: ClassesMap, templatesDirPath: string) {
    this.classesMap = classesMap;
    this.classes = classesMap.getClasses();
    this.sortedClasses = classesMap.getSortedClasses();
    this.templates = this.loadTemplates(templatesDirPath);
    this.registerHandlebarHelpers();
  }

  loadTemplates(templatesDirPath: string): Immutable.Map<string, HandlebarsTemplateDelegate> {
    var templates = Immutable.Map<string, HandlebarsTemplateDelegate>();
    var extension = '.txt';
    var globExpr = path.join(templatesDirPath, '*' + extension);
    var filenames = glob.sync(globExpr);
    if (filenames.length === 0) {
      throw new Error('No templates found in:' + globExpr);
    }
    _.forEach(filenames, (path: string) => {
      var lastSlash = path.lastIndexOf('/');
      assert(lastSlash !== -1);
      var name = path.slice(lastSlash + 1, -extension.length);
      var contents = fs.readFileSync(path, { encoding: 'utf8' });
      var compiled = handlebars.compile(contents);
      templates = templates.set(name, compiled);
    });
    return templates;
  }

  fill(name: string, ctx: Object): string {
    return this.templates.get(name)(ctx);
  }


  // *registerHandlebarHelpers()*
  registerHandlebarHelpers() : void {
    handlebars.registerHelper('margs', (method: ClassesMap.MethodDefinition, options: HandlebarHelperOptions) => {
      var tsParamTypes = method.tsParamTypes;
      var names = method.paramNames;
      // Map each parameter to the correct typescript type declaration.
      // We need special processing to take into account various ways that array arguments must be treated.
      var args = _.map(names, (name: string, i: number) => {
        // The last parameter might be a varargs parameter.
        var isLastParam: boolean = i === tsParamTypes.length - 1;

        // Is this argument an array type `array_t<T>`
        var argType: string = tsParamTypes[i];
        var m = argType.match(/^array_t<(.+)>$/);
        if (m) {
          // We do have a Java array type array_t<T>. Create the Javascript representation T[] for use below.
          argType = m[1] + '[]';
        }

        // If this parameter is not or should not be treated as a varargs parameter.
        // (options.hash.norest is context provided by the handlebars template.)
        if (options.hash.norest || !method.isVarArgs || !isLastParam) {
          // It this parameter an array of object_t?
          if (m && m[1] === 'object_t') {
            // Yes we do. This is a special case, where we can accept either array_t<Object> or object_t[]
            return util.format('%s: object_array_t', name);
          } else {
            // Not an array of object_t, the type tsParamTypes[i] is the correct type (whether an array or not)
            return util.format('%s: %s', name, tsParamTypes[i]);
          }
        } else {
          // This is a varargs parameter, use the javascript representation T[] recorded in argType.
          return util.format('...%s: %s', name, argType);
        }
      });
      return args.join(', ');
    });
    handlebars.registerHelper('mcall', (method: ClassesMap.MethodDefinition, options: HandlebarHelperOptions) => {
      return method.paramNames.join(', ');
    });
    handlebars.registerHelper('hasClass', (className: string, options: HandlebarHelperOptions) => {
      if (this.classes[className]) {
        return options.fn(this.classes[className]);
      }
    });
    handlebars.registerHelper('ifdef', function(conditional: any, options: HandlebarHelperOptions) {
      if (conditional !== undefined) {
        return options.fn(this);
      }
    });
    handlebars.registerHelper('join', function(array: string[], sep: string, options: HandlebarHelperOptions ) {
      return array.map((item: string) => options.fn(item)).join(sep);
    });
  }


  // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
  streamLibraryClassFile(className: string, template: string, streamFn: StreamFn, endFn: EndFn): BluePromise<void> {
    return streamFn(this.fill(template, this.classes[className]))
      .then(() => { return endFn(); });
  }


  // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.ts).
  writeLibraryClassFile(className: string, template: string = 'sourcefile', ext: string = '.ts'): BluePromise<void> {
    var classMap = this.classes[className];

    var fileName = classMap.shortName;
    var filePath = 'o/lib/' + fileName + ext;

    var stream = fs.createWriteStream(filePath);
    var streamFn: StreamFn = BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = BluePromise.promisify(stream.end, stream);

    return this.streamLibraryClassFile(className, template, streamFn, endFn);
  }


  // *streamPackageFile(): stream the java.d.ts file contents
  streamPackageFile(options: TsJavaOptions, streamFn: StreamFn, endFn: EndFn): BluePromise<void> {
    var context = {
      classes: this.sortedClasses,
      opts: options.asyncOptions
    };

    var outputBaseName = path.basename(options.outputPath);
    return streamFn('// ' + outputBaseName + '\n')
      .then(() => streamFn('// This file was generated by ts-java.\n'))
      .then(() => streamFn('/// <reference path="' + options.promisesPath + '" />\n\n'))
      .then(() => streamFn(this.fill('package', context)))
      .then(() => endFn());
  }


  // *writePackageFile(): write a java.d.ts file
  writePackageFile(options: TsJavaOptions): BluePromise<void> {
    var stream = fs.createWriteStream(options.outputPath);
    var streamFn: StreamFn = <StreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = <EndFn> BluePromise.promisify(stream.end, stream);

    return this.streamPackageFile(options, streamFn, endFn);
  }


  // *streamTsJavaModule(): stream the tsJavaModule.ts file contents
  streamTsJavaModule(options: TsJavaOptions, streamFn: StreamFn, endFn: EndFn): BluePromise<void> {
    // Remove the runtime libary rt.jar, which was added earlier as 'a convenience'.
    // TODO: refactor so that rt.jar is not present.
    var classpath: string[] = _.filter(options.classpath, (jarpath: string) => path.basename(jarpath) !== 'rt.jar');

    // Compute the relative path from the directory that will contain the tsJavaModule file to
    // the root directory of the module (i.e. directory containing package.json with tsjava section).
    // This relative path must be applied to each path in the classpath.
    var tsJavaModuleDir = path.dirname(path.resolve(options.tsJavaModulePath));
    var relativePath = path.relative(tsJavaModuleDir, process.cwd());

    var context = {
      classes: this.sortedClasses,
      opts: options.asyncOptions,
      classpath: classpath,
      classpathAdjust: relativePath,
      name: 'todo_module_name_here' // TODO: arrange for the module name to be here
    };

    var outputBaseName = path.basename(options.tsJavaModulePath);
    return streamFn('// ' + outputBaseName + '\n')
      .then(() => streamFn('// This file was generated by ts-java.\n'))
      .then(() => streamFn('/// <reference path="' + options.javaTypingsPath + '" />\n\n'))
      .then(() => streamFn(this.fill('tsJavaModule', context)))
      .then(() => endFn());
  }

  // *writeTsJavaModule(): write the tsJavaModule.ts file, small .ts source file that makes it possible
  // to import java classes with just their class name;
  writeTsJavaModule(options: TsJavaOptions): BluePromise<void> {
    var stream = fs.createWriteStream(options.tsJavaModulePath);
    var streamFn: StreamFn = <StreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = <EndFn> BluePromise.promisify(stream.end, stream);

    return this.streamTsJavaModule(options, streamFn, endFn);
  }


  // *getClassMap(): accessor method to return the 'class map' for the given class name.
  // The class map is a javascript object map/dictionary containing all properties of interest for the class.
  getClassMap(className: string): ClassesMap.ClassDefinition {
    return this.classes[className];
  }


  // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
  getMethodVariants(className: string, methodName: string) {
    var methods = this.classes[className].methods;
    return _.filter(methods, (method: ClassesMap.MethodDefinition) => { return method.name === methodName; });
  }
}

export = CodeWriter;
