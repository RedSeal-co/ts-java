/// <reference path='../node_modules/immutable/dist/Immutable.d.ts' />
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='gremlin-v3.d.ts' />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var Immutable = require('immutable');
var Work = require('./work');
var Gremlin = require('gremlin-v3');
// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
var ClassesMap = (function () {
    function ClassesMap(_config) {
        if (_config === void 0) { _config = {}; }
        this.gremlin = new Gremlin();
        this.classes = {};
        this.methodOriginations = {};
        this.config = _config;
        this.config.whitelist = _config.whitelist || [];
        this.config.blacklist = _config.blacklist || [];
        if (_.isEmpty(this.config.whitelist)) {
            this.config.whitelist = [
                /^java\.lang\.Object$/,
                /^java\.lang\.String$/,
                /^java\.lang\.CharSequence$/,
                /^java\.util\.Iterator$/,
                /^java\.util\.function\./,
                /^com\.tinkerpop\.gremlin\./
            ];
        }
        if (_.isEmpty(this.config.blacklist)) {
            this.config.blacklist = [
                /^java\.lang\.reflect\./
            ];
        }
    }
    // *inWhiteList()*: Return true for classes of iterest.
    ClassesMap.prototype.inWhiteList = function (className) {
        var result = _.find(this.config.whitelist, function (ns) {
            return className.match(ns);
        }) !== undefined && _.find(this.config.blacklist, function (ns) {
            return className.match(ns);
        }) === undefined;
        return result;
    };
    // *shortClassName()*: Return the short class name given the full className (class path).
    ClassesMap.prototype.shortClassName = function (className) {
        if (!this.inWhiteList(className))
            throw new Error('shortClassName given bad classname:' + className);
        var m = className.match(/\.([\$\w]+)$/);
        return m[1];
    };
    // *loadClass()*: load the class and return its Class object.
    ClassesMap.prototype.loadClass = function (className) {
        return this.gremlin.java.getClassLoader().loadClassSync(className);
    };
    // *mapClassInterfaces()*: Find the direct interfaces of className.
    // Note that we later compute the transitive closure of all inherited interfaces
    ClassesMap.prototype.mapClassInterfaces = function (className, clazz, work) {
        assert.strictEqual(clazz.getNameSync(), className);
        var interfaces = _.map(clazz.getInterfacesSync(), function (intf) {
            return intf.getNameSync();
        });
        interfaces = _.filter(interfaces, function (intf) {
            return this.inWhiteList(intf);
        }, this);
        var javaLangObject = 'java.lang.Object';
        if (interfaces.length === 0 && className !== javaLangObject)
            interfaces.push(javaLangObject);
        _.forEach(interfaces, function (intf) {
            work.addTodo(intf);
        }, this);
        return interfaces;
    };
    // *methodSignature()*: return the signature of a method, i.e. a string unique to any method variant,
    // containing method name and types of parameters.
    // Note: Java does not consider the function return type to be part of the method signature.
    ClassesMap.prototype.methodSignature = function (methodMap) {
        var signature;
        var varArgs = methodMap.isVarArgs ? '...' : '';
        if (methodMap.isVarArgs) {
            var last = _.last(methodMap.params);
            var match = /\[L(.+);/.exec(last);
            assert.ok(match, require('util').inspect(methodMap, { depth: null }));
            var finalArg = match[1] + '...';
            var params = methodMap.params.slice(0, -1);
            params.push(finalArg);
            signature = methodMap.name + '(' + params.join() + ')';
        }
        else {
            signature = methodMap.name + '(' + methodMap.params.join() + varArgs + ')';
        }
        return signature;
    };
    // *mapMethod()*: return a map of useful properties of a method.
    ClassesMap.prototype.mapMethod = function (method, work) {
        var _this = this;
        var methodMap = {
            name: method.getNameSync(),
            declared: method.getDeclaringClassSync().getNameSync(),
            returns: method.getReturnTypeSync().getNameSync(),
            params: _.map(method.getParameterTypesSync(), function (p) {
                return p.getNameSync();
            }),
            isVarArgs: method.isVarArgsSync(),
            generic: method.toGenericStringSync(),
            string: method.toStringSync(),
        };
        methodMap.signature = this.methodSignature(methodMap);
        var addToTheToDoList = function (canonicalTypeName) {
            // We expect various type names here, 4 general categories:
            // 1) primitive types such as int, long, char
            // 2) arrays of primitive types, such as int[]
            // 3) class names such as java.util.Iterator
            // 4) array-of-class names such as java.util.Iterator[]
            // We only add to the todo list for the last two, and only in the non-array form.
            var match = /(.*)\[\]/.exec(canonicalTypeName);
            if (match)
                canonicalTypeName = match[1];
            if (_this.inWhiteList(canonicalTypeName)) {
                if (!work.alreadyAdded(canonicalTypeName)) {
                    //           console.log('Adding:', canonicalTypeName);
                    work.addTodo(canonicalTypeName);
                }
            }
        };
        addToTheToDoList(methodMap.declared);
        addToTheToDoList(methodMap.returns);
        return methodMap;
    };
    // *mapClassMethods()*: return a methodMap array for the methods of a class
    ClassesMap.prototype.mapClassMethods = function (className, clazz, work) {
        return _.map(clazz.getMethodsSync(), function (m) {
            return this.mapMethod(m, work);
        }, this);
    };
    // *mapClass()*: return a map of all useful properties of a class.
    ClassesMap.prototype.mapClass = function (className, work) {
        var clazz = this.loadClass(className);
        var interfaces = this.mapClassInterfaces(className, clazz, work);
        var methods = this.mapClassMethods(className, clazz, work);
        var classMap = {
            fullName: className,
            shortName: this.shortClassName(className),
            interfaces: interfaces,
            methods: methods
        };
        return classMap;
    };
    // *loadAllClasses()*: load and map all classes of interest
    ClassesMap.prototype.loadAllClasses = function (seedClasses) {
        var work = new Work(seedClasses);
        while (!work.isDone()) {
            var className = work.next();
            work.setDone(className);
            this.classes[className] = this.mapClass(className, work);
        }
        return work;
    };
    // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
    ClassesMap.prototype.getClasses = function () {
        return this.classes;
    };
    // *_interfacesClosure()*: extend interfaces to the transitive closure of all inherited interfaces.
    ClassesMap.prototype._interfacesClosure = function (className, work) {
        var _this = this;
        assert.ok(!work.alreadyDone(className));
        var transitiveClosure = Immutable.Set(this.classes[className].interfaces);
        var maxdepth = 0;
        _.forEach(this.classes[className].interfaces, function (intf) {
            if (!work.alreadyDone(intf))
                _this._interfacesClosure(intf, work);
            assert.ok(work.alreadyDone(intf));
            assert.ok(typeof _this.classes[intf].depth === 'number');
            if (maxdepth < _this.classes[intf].depth)
                maxdepth = _this.classes[intf].depth;
            transitiveClosure = transitiveClosure.union(_this.classes[intf].interfaces);
        });
        var byDepth = function (a, b) {
            var result = _this.classes[a].depth - _this.classes[b].depth;
            if (result === 0) {
                // for tiebreaker, arrange for java.* to sort before com.*
                result = _this.classes[b].fullName.localeCompare(_this.classes[a].fullName);
            }
            return result;
        };
        this.classes[className].interfaces = transitiveClosure.toArray().sort(byDepth);
        this.classes[className].depth = maxdepth + 1;
        work.setDone(className);
    };
    // *transitiveClosureInterfaces()*: compute the _interfacesClosure for all classes.
    ClassesMap.prototype.transitiveClosureInterfaces = function () {
        var work = new Work(_.keys(this.classes));
        while (!work.isDone()) {
            var className = work.next();
            this._interfacesClosure(className, work);
        }
    };
    // *_locateMethodOriginations()*: find where each method of className was first defined.
    // Private method for use by *mapMethodOriginations()*.
    // This method will resursively call itself for all inherited interfaces
    // before it locates the methods of this class.
    ClassesMap.prototype._locateMethodOriginations = function (className, work) {
        var _this = this;
        assert.ok(className in this.classes);
        var classMap = this.classes[className];
        assert.strictEqual(className, classMap.fullName);
        _.forEach(classMap.interfaces, function (intf) {
            if (!work.alreadyDone(intf)) {
                assert.ok(intf in _this.classes, 'Unknown interface:' + intf);
                _this._locateMethodOriginations(intf, work);
            }
        });
        _.forEach(classMap.methods, function (method, index) {
            assert.ok(typeof method.signature === 'string');
            var definedHere = false;
            if (!(method.signature in _this.methodOriginations)) {
                if (!(method.signature in classMap.interfaces)) {
                    definedHere = true;
                    _this.methodOriginations[method.signature] = className;
                    if (method.declared !== className) {
                        console.log('Method %s located in %s but declared in %s', method.signature, className, method.declared);
                    }
                }
            }
            classMap.methods[index].definedHere = definedHere;
        });
        work.setDone(className);
    };
    // *mapMethodOriginations()*: Create a map of all methods. Keys are method signatures, values are class names.
    ClassesMap.prototype.mapMethodOriginations = function () {
        var work = new Work(_.keys(this.classes));
        while (!work.isDone()) {
            var className = work.next();
            this._locateMethodOriginations(className, work);
        }
        return this.methodOriginations;
    };
    // *getMethodOriginations()*: return the map of all original method definitions.
    ClassesMap.prototype.getMethodOriginations = function () {
        return this.methodOriginations;
    };
    // *initialize()*: fully initialize from seedClasses.
    ClassesMap.prototype.initialize = function (seedClasses) {
        this.loadAllClasses(seedClasses);
        this.transitiveClosureInterfaces();
        this.mapMethodOriginations();
    };
    return ClassesMap;
})();
module.exports = ClassesMap;
//# sourceMappingURL=classes-map.js.map