/// <reference path='../node_modules/immutable/dist/Immutable.d.ts'/>
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

interface IFunctionReturningPromise<R> {
  (x?: any): BluePromise<R>;
}

interface IStreamFn {
  (x: string): BluePromise<void>;
}

interface IEndFn {
  (): BluePromise<void>;
}

// ## JavascriptWriter
// A class that provides methods for writing Javascript source files for a set of classes specified in `classesMap`.
// classesMap must be a fully initialized `ClassesMap` object, see ./classes-map.js.
class JavascriptWriter {

  private classes: ClassesMap.IClassDefinitionMap;
  private methodOriginations: ClassesMap.IMethodOriginationMap;
  private templates: Immutable.Map<string, HandlebarsTemplateDelegate>;

  constructor(classesMap: ClassesMap.ClassesMap, templatesDirPath: string) {
    this.classes = classesMap.getClasses();
    this.methodOriginations = classesMap.getMethodOriginations();
    this.templates = Immutable.Map<string, HandlebarsTemplateDelegate>();

    var extension = '.txt';
    var filenames = glob.sync(path.join(templatesDirPath, '*' + extension));
    _.forEach(filenames, (path: string) => {
      var lastSlash = path.lastIndexOf('/');
      assert(lastSlash !== -1);
      var name = path.slice(lastSlash + 1, -extension.length);
      var contents = fs.readFileSync(path, { encoding: 'utf8' });
      var compiled = handlebars.compile(contents);
      this.templates = this.templates.set(name, compiled);
    });
  }


  // *writeRequiredInterfaces()*: write the require() statements for all required interfaces.
  writeRequiredInterfaces(streamFn: IStreamFn, className: string): BluePromise<void> {
    assert.ok(this.classes);
    var classMap = this.classes[className];
    assert.ok(classMap);

    var import_ = this.templates.get('import');

    return BluePromise.all(classMap.interfaces)
      .each((intf: string) => {
        assert.ok(intf in this.classes, 'Unknown interface:' + intf);
        var interfaceMap = this.classes[intf];
        var interfaceName = interfaceMap.shortName + 'Wrapper';
        return streamFn(import_({ name: interfaceName }));
      })
      .then(() => { return streamFn('\n'); });
  }


  // *writeJsHeader(): write the 'header' of a library .js file for the given class.
  // The header includes a minimal doc comment, the necessary requires(), and the class constructor.
  writeJsHeader(streamFn: IStreamFn, className: string) {
    var classMap = this.classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var firstLines = this.templates.get('firstLines');
    var constructor = this.templates.get('constructor');

    return streamFn(firstLines({ name: jsClassName }))
      .then(() => {
        return this.writeRequiredInterfaces(streamFn, className);
      })
      .then(() => {
        return streamFn(constructor({ name: jsClassName }));
      });
  }


  // *writeOneDefinedMethod(): write one method definition.
  writeOneDefinedMethod(streamFn: IStreamFn, className: string, method: ClassesMap.IMethodDefinition) {
    var classMap = this.classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var text = this.templates.get('definedMethod');

    var methodName = method.name;
    var signature = method.signature;
    return streamFn(text({ clazz: jsClassName, method: methodName, signature: signature }));
  }


  // *writeOneInheritedMethod(): write the declaration of one method 'inherited' from another class.
  writeOneInheritedMethod(streamFn: IStreamFn, className: string, method: ClassesMap.IMethodDefinition) {
    var classMap = this.classes[className];
    var jsClassName = classMap.shortName + 'Wrapper';

    var text = this.templates.get('inheritedMethod');

    var methodName = method.name;
    var signature = method.signature;
    var defining = this.classes[this.methodOriginations[signature]].shortName + 'Wrapper';
    return streamFn(text({ clazz: jsClassName, method: methodName, signature: signature, defining: defining }));
  }


  // *writeJsMethods(): write all method declarations for a class.
  writeJsMethods(streamFn: IStreamFn, className: string) {
    function bySignature(a: ClassesMap.IMethodDefinition, b: ClassesMap.IMethodDefinition) {
      return a.signature.localeCompare(b.signature);
    }

    var classMap = this.classes[className];
    return BluePromise.all(classMap.methods.sort(bySignature))
      .each((method: ClassesMap.IMethodDefinition) => {
        if (method.definedHere) {
          return this.writeOneDefinedMethod(streamFn, className, method);
        } else {
          return this.writeOneInheritedMethod(streamFn, className, method);
        }
      });
  }


  // *streamLibraryClassFile(): stream a complete source file for a java wrapper class.
  streamLibraryClassFile(className: string, streamFn: IStreamFn, endFn: IEndFn) {
    return this.writeJsHeader(streamFn, className)
      .then(() => { return this.writeJsMethods(streamFn, className); })
      .then(() => { return endFn(); });
  }


  // *writeLibraryClassFile(): write a complete source file for a library class (lib/classWrapper.js).
  writeLibraryClassFile(className: string) {
    var classMap = this.classes[className];

    var fileName = classMap.shortName + 'Wrapper';
    var filePath = 'out/lib/' + fileName + '.js';

    var stream = fs.createWriteStream(filePath);
    var streamFn: IStreamFn = <IStreamFn> BluePromise.promisify(stream.write, stream);
    var endFn: IEndFn = <IEndFn> BluePromise.promisify(stream.end, stream);

    return this.streamLibraryClassFile(className, streamFn, endFn);
  }


  // *getClassMap(): accessor method to return the 'class map' for the given class name.
  // The class map is a javascript object map/dictionary containing all properties of interest for the class.
  getClassMap(className: string) {
    return this.classes[className];
  }


  // *getMethodVariants(): accessor method to return the an array of method definitions for all variants of methodName.
  getMethodVariants(className: string, methodName: string) {
    var methods = this.classes[className].methods;
    return _.filter(methods, (method: ClassesMap.IMethodDefinition) => { return method.name === methodName; });
  }
}

export = JavascriptWriter;
