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
  (x: string): BluePromise<void>;
}

interface EndFn {
  (): BluePromise<void>;
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
    var streamFn: StreamFn = <StreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = <EndFn> BluePromise.promisify(stream.end, stream);

    return this.streamLibraryClassFile(className, template, streamFn, endFn);
  }


  // *writePackageFile(): write a .d.ts file a package/namespace
  // This currently writes one file for the entire set of classes.
  // TODO: refactor so that we write one file per top-level package/namespace.
  writePackageFile(options: TsJavaOptions): BluePromise<void> {
    var stream = fs.createWriteStream(options.outputPath);
    var streamFn: StreamFn = <StreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = <EndFn> BluePromise.promisify(stream.end, stream);

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


  // *writeAutoImportFile(): write the autoImport.ts file, small .ts source file that makes it possible
  // to import java classes with just their class name;
  writeAutoImportFile(options: TsJavaOptions): BluePromise<void> {
    var stream = fs.createWriteStream(options.autoImportPath);
    var streamFn: StreamFn = <StreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: EndFn = <EndFn> BluePromise.promisify(stream.end, stream);

    // the tsjava section in the package.json provides the path for ts-java to write
    // both the java.d.ts file (as options.outputPath) and the autoImport.ts file
    // (as options.autoImportPath). But autoImport.ts must reference the java.d.ts
    // file, which means we have to compute a relative path. The function path.relative
    // does most of the work, but we have to arrange for it to compute the relative
    // path from the *directory* containing the autoImport.ts file to the java.d.ts *file*.
    var autoImportDir: string = path.dirname(path.resolve(options.autoImportPath));
    var relativePath = path.relative(autoImportDir, path.resolve(options.outputPath));

    var outputBaseName = path.basename(options.autoImportPath);
    return streamFn('// ' + outputBaseName + '\n')
      .then(() => streamFn('// This file was generated by ts-java.\n'))
      .then(() => streamFn('/// <reference path="' + relativePath + '" />\n\n'))
      .then(() => streamFn(this.fill('autoImport', this.sortedClasses)))
      .then(() => endFn());
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
