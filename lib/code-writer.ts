/// <reference path='../node_modules/immutable/dist/immutable.d.ts'/>
/// <reference path='../typings/handlebars/handlebars.d.ts' />
/// <reference path='../typings/lodash/lodash.d.ts' />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='bluebird.d.ts' />
/// <reference path='glob.d.ts' />

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
import util = require('util');

interface IFunctionReturningPromise<R> {
  (x?: any): BluePromise<R>;
}

interface IStreamFn {
  (x: string): BluePromise<void>;
}

interface IEndFn {
  (): BluePromise<void>;
}

interface IHandlebarHelperOptions {
  fn: Function;
}

// ## CodeWriter
// A class for writing Javascript/TypeScript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.ts.
class CodeWriter {

  private classesMap: ClassesMap;
  private classes: ClassesMap.IClassDefinitionMap;
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
    var filenames = glob.sync(path.join(templatesDirPath, '*' + extension));
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


  tsTypeName(javaTypeName: string): string {
    var m = javaTypeName.match(/\[L([\.\$\w]+);$/);
    var ext = '';
    if (m) {
      javaTypeName = m[1];
      ext = '[]';
    }
    if (this.classesMap.inWhiteList(javaTypeName)) {
      var shortName = this.classesMap.shortClassName(javaTypeName);
      return (shortName === 'String') ? 'string' : shortName + ext;
    } else {
      return javaTypeName + ext;
    }
  }


  // *registerHandlebarHelpers()*
  registerHandlebarHelpers() : void {
    handlebars.registerHelper('intf', (interfaces: Array<string>, options: IHandlebarHelperOptions) => {
      return _.reduce(interfaces, (out: string, intf: string) => {
        var interfaceMap = this.classes[intf];
        return out + options.fn(interfaceMap.shortName);
      }, '');
    });
    handlebars.registerHelper('margs', (method: ClassesMap.IMethodDefinition, options: IHandlebarHelperOptions) => {
      var params = method.params;
      var names = method.paramNames;
      var args = _.map(names, (name: string, i: number) => {
        if (method.isVarArgs && i === names.length - 1) {
          return util.format('...%s: %s', name, this.tsTypeName(params[i]));
        } else {
          return util.format('%s: %s', name, this.tsTypeName(params[i]));
        }
      });
      return args.join(', ');
    });
    handlebars.registerHelper('mcall', (method: ClassesMap.IMethodDefinition, options: IHandlebarHelperOptions) => {
      return method.paramNames.join(', ');
    });
    handlebars.registerHelper('tstype', (javaTypeName: string, options: IHandlebarHelperOptions) => {
      return this.tsTypeName(javaTypeName);
    });
  }

  // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
  streamLibraryClassFile(className: string, template: string, streamFn: IStreamFn, endFn: IEndFn): BluePromise<void> {
    return streamFn(this.fill(template, this.classes[className]))
      .then(() => { return endFn(); });
  }


  // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.ts).
  writeLibraryClassFile(className: string, template: string = 'sourcefile', ext: string = '.ts'): BluePromise<void> {
    var classMap = this.classes[className];

    var fileName = classMap.shortName;
    var filePath = 'out/lib/' + fileName + ext;

    var stream = fs.createWriteStream(filePath);
    var streamFn: IStreamFn = <IStreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: IEndFn = <IEndFn> BluePromise.promisify(stream.end, stream);

    return this.streamLibraryClassFile(className, template, streamFn, endFn);
  }


  // *writePackageFile(): write a .d.ts file a package/namespace
  // This currently writes one file for the entire set of classes.
  // TODO: refactor so that we write one file per top-level package/namespace.
  writePackageFile(): BluePromise<void> {

    var fileName = 'TinkerPop'; // TODO: from package/namespace
    var filePath = 'out/' + fileName + '.d.ts';

    var stream = fs.createWriteStream(filePath);
    var streamFn: IStreamFn = <IStreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: IEndFn = <IEndFn> BluePromise.promisify(stream.end, stream);

    return streamFn(this.fill('package', this.classes))
      .then(() => { return endFn(); });
  }


  // *getClassMap(): accessor method to return the 'class map' for the given class name.
  // The class map is a javascript object map/dictionary containing all properties of interest for the class.
  getClassMap(className: string): ClassesMap.IClassDefinition {
    return this.classes[className];
  }


  // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
  getMethodVariants(className: string, methodName: string) {
    var methods = this.classes[className].methods;
    return _.filter(methods, (method: ClassesMap.IMethodDefinition) => { return method.name === methodName; });
  }
}

export = CodeWriter;
