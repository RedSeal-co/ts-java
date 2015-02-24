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
}

// ## CodeWriter
// A class for writing Javascript/TypeScript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.ts.
class CodeWriter {

  private classesMap: ClassesMap;
  private classes: ClassesMap.ClassDefinitionMap;
  private templates: Immutable.Map<string, HandlebarsTemplateDelegate>;

  constructor(classesMap: ClassesMap, templatesDirPath: string) {
    this.classesMap = classesMap;
    this.classes = classesMap.getClasses();
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
    handlebars.registerHelper('intf', (interfaces: Array<string>, options: HandlebarHelperOptions) => {
      return _.reduce(interfaces, (out: string, intf: string) => {
        var interfaceMap = this.classes[intf];
        return out + options.fn(interfaceMap.shortName);
      }, '');
    });
    handlebars.registerHelper('margs', (method: ClassesMap.MethodDefinition, options: HandlebarHelperOptions) => {
      var tsParamTypes = method.tsParamTypes;
      var names = method.paramNames;
      var args = _.map(names, (name: string, i: number) => {
        return util.format('%s: %s', name, tsParamTypes[i]);
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

    var outputBaseName = path.basename(options.outputPath);
    return streamFn('// ' + outputBaseName + '\n')
      .then(() => streamFn('// This file was generated by ts-java.\n'))
      .then(() => streamFn('/// <reference path=\'' + options.promisesPath + '\' />\n\n'))
      .then(() => streamFn(this.fill('package', this.classes)))
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
