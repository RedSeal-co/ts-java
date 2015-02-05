/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./java.d.ts' />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var Immutable = require('immutable');
var Work = require('./work');
var requiredSeedClasses = [
    'java.lang.Class',
    'java.lang.Cloneable',
    'java.lang.Comparable',
    'java.lang.Enum',
    'java.lang.Iterable',
    'java.lang.Long',
    'java.lang.Number',
    'java.lang.Object',
    'java.lang.String',
];
var alwaysExcludeClasses = [
];
// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
var ClassesMap = (function () {
    function ClassesMap(java, includedPatterns, excludedPatterns) {
        this.java = java;
        this.classes = {};
        this.unhandledTypes = Immutable.Set();
        assert.ok(includedPatterns);
        assert.ok(includedPatterns instanceof Immutable.Set);
        this.includedPatterns = includedPatterns;
        this.excludedPatterns = excludedPatterns ? excludedPatterns : Immutable.Set();
        var requiredPatterns = _.map(requiredSeedClasses, function (s) {
            var pattern = '^' + s.replace(/\./g, '\\.') + '$';
            return new RegExp(pattern);
        });
        this.includedPatterns = this.includedPatterns.merge(requiredPatterns);
        var excludedPats = _.map(alwaysExcludeClasses, function (s) {
            var pattern = '^' + s.replace(/\./g, '\\.') + '$';
            return new RegExp(pattern);
        });
        this.excludedPatterns = this.excludedPatterns.merge(excludedPats);
    }
    // *inWhiteList()*: Return true for classes of iterest.
    ClassesMap.prototype.inWhiteList = function (className) {
        var result = this.includedPatterns.find(function (ns) {
            return className.match(ns) !== null;
        }) !== undefined && this.excludedPatterns.find(function (ns) {
            return className.match(ns) !== null;
        }) === undefined;
        return result;
    };
    // *shortClassName()*: Return the short class name given the full className (class path).
    ClassesMap.prototype.shortClassName = function (className) {
        return _.last(className.split('.'));
    };
    // *loadClass()*: load the class and return its Class object.
    ClassesMap.prototype.loadClass = function (className) {
        return this.java.getClassLoader().loadClassSync(className);
    };
    // *mapClassInterfaces()*: Find the direct interfaces of className.
    // Note that we later compute the transitive closure of all inherited interfaces
    ClassesMap.prototype.mapClassInterfaces = function (className, clazz, work) {
        var _this = this;
        assert.strictEqual(clazz.getNameSync(), className);
        var interfaces = _.map(clazz.getInterfacesSync(), function (intf) {
            return intf.getNameSync();
        });
        interfaces = _.filter(interfaces, function (intf) {
            return _this.inWhiteList(intf);
        });
        // Methods of Object must always be available on any instance variable, even variables whose static
        // type is a Java interface. Java does this implicitly. We have to do it explicitly.
        var javaLangObject = 'java.lang.Object';
        if (interfaces.length === 0 && className !== javaLangObject && clazz.getSuperclassSync() === null) {
            interfaces.push(javaLangObject);
        }
        _.forEach(interfaces, function (intf) {
            work.addTodo(intf);
        });
        return interfaces;
    };
    // *typeEncoding()*: return the JNI encoding string for a java class
    ClassesMap.prototype.typeEncoding = function (clazz) {
        var name = clazz.getNameSync();
        var primitives = {
            boolean: 'Z',
            byte: 'B',
            char: 'C',
            double: 'D',
            float: 'F',
            int: 'I',
            long: 'J',
            short: 'S',
            void: 'V'
        };
        var encoding;
        if (clazz.isPrimitiveSync()) {
            encoding = primitives[name];
        }
        else if (clazz.isArraySync()) {
            encoding = name;
        }
        else {
            encoding = clazz.getCanonicalNameSync();
            assert.ok(encoding, 'typeEncoding cannot handle type');
            encoding = 'L' + encoding + ';';
        }
        return encoding.replace(/\./g, '/');
    };
    // *methodSignature()*: return the signature of a method, i.e. a string unique to any method variant,
    // encoding the method name, types of parameters, and the return type.
    // This string may be passed as the method name to java.callMethod() in order to execute a specific variant.
    ClassesMap.prototype.methodSignature = function (method) {
        var _this = this;
        var name = method.getNameSync();
        var paramTypes = method.getParameterTypesSync();
        var sigs = paramTypes.map(function (p) {
            return _this.typeEncoding(p);
        });
        var signature = name + '(' + sigs.join('') + ')';
        if ('getReturnTypeSync' in method) {
            // methodSignature can be called on either a constructor or regular method.
            // constructors don't have return types.
            signature += this.typeEncoding(method.getReturnTypeSync());
        }
        return signature;
    };
    ClassesMap.prototype.tsTypeName = function (javaTypeName) {
        var typeName = javaTypeName;
        var ext = '';
        while (typeName[0] === '[') {
            typeName = typeName.slice(1);
            ext += '[]';
        }
        var m = typeName.match(/^L(.*);$/);
        if (m) {
            typeName = m[1];
        }
        var primitiveTypes = {
            B: 'number',
            C: 'string',
            D: 'number',
            F: 'number',
            I: 'number',
            J: 'number',
            S: 'number',
            Z: 'boolean',
            boolean: 'boolean',
            byte: 'number',
            char: 'string',
            double: 'number',
            float: 'number',
            int: 'number',
            long: 'number',
            short: 'number',
            void: 'void',
            'java.lang.Double': 'number',
            'java.lang.Float': 'number',
            'java.lang.Integer': 'number',
            'java.lang.Object': 'object_t',
            'java.lang.String': 'string_t'
        };
        if (typeName in primitiveTypes) {
            return primitiveTypes[typeName] + ext;
        }
        if (this.inWhiteList(typeName)) {
            var shortName = this.shortClassName(typeName);
            return shortName + ext;
        }
        else {
            this.unhandledTypes = this.unhandledTypes.add(typeName);
            return 'any' + ext;
        }
    };
    ClassesMap.prototype.baseType = function (typeName) {
        var ext = '';
        while (typeName[0] === '[') {
            typeName = typeName.slice(1);
            ext += '[]';
        }
        var m = typeName.match(/^L(.*);$/);
        if (m) {
            typeName = m[1];
        }
        return [typeName, ext];
    };
    // *mapMethod()*: return a map of useful properties of a method or constructor.
    // For our purposes, we can treat constructors as methods except for the handling of return type.
    ClassesMap.prototype.mapMethod = function (method, work) {
        var _this = this;
        var signature = this.methodSignature(method);
        var modifiers = method.getModifiersSync();
        var isStatic = (modifiers & 8) === 8;
        var returnType = 'void';
        if ('getReturnTypeSync' in method) {
            returnType = method.getReturnTypeSync().getNameSync();
        }
        var methodMap = {
            name: method.getNameSync(),
            declared: method.getDeclaringClassSync().getNameSync(),
            returns: returnType,
            tsReturns: this.tsTypeName(returnType),
            paramNames: _.map(method.getParametersSync(), function (p) {
                return p.getNameSync();
            }),
            paramTypes: _.map(method.getParameterTypesSync(), function (p) {
                return p.getNameSync();
            }),
            tsParamTypes: _.map(method.getParameterTypesSync(), function (p) {
                return _this.tsTypeName(p.getNameSync());
            }),
            isStatic: isStatic,
            isVarArgs: method.isVarArgsSync(),
            generic_proto: method.toGenericStringSync(),
            plain_proto: method.toStringSync(),
            signature: signature
        };
        var addToTheToDoList = function (canonicalTypeName) {
            // We expect various type names here, 4 general categories:
            // 1) primitive types such as int, long, char
            // 2) arrays of primitive types, such as int[]
            // 3) class names such as java.util.Iterator
            // 4) array-of-class names such as java.util.Iterator[]
            // We only add to the todo list for the last two, and only in the non-array form.
            var parts = _this.baseType(canonicalTypeName);
            canonicalTypeName = parts[0];
            if (_this.inWhiteList(canonicalTypeName)) {
                if (!work.alreadyAdded(canonicalTypeName)) {
                    //           console.log('Adding:', canonicalTypeName);
                    work.addTodo(canonicalTypeName);
                }
            }
            else {
            }
        };
        addToTheToDoList(methodMap.declared);
        addToTheToDoList(methodMap.returns);
        _.forEach(methodMap.paramTypes, function (p) {
            addToTheToDoList(p);
        });
        return methodMap;
    };
    // *mapClassMethods()*: return a methodMap array for the methods of a class
    ClassesMap.prototype.mapClassMethods = function (className, clazz, work) {
        return _.map(clazz.getMethodsSync(), function (m) {
            return this.mapMethod(m, work);
        }, this);
    };
    // *mapClassConstructors()*: return a methodMap array for the constructors of a class
    ClassesMap.prototype.mapClassConstructors = function (className, clazz, work) {
        return _.map(clazz.getConstructorsSync(), function (m) {
            return this.mapMethod(m, work);
        }, this);
    };
    ClassesMap.prototype.compareVariants = function (a, b) {
        function countArgsOfTypeAny(a) {
            return _.filter(a.tsParamTypes, function (t) { return t === 'any'; }).length;
        }
        // We want variants with more parameters to come first.
        if (a.paramTypes.length > b.paramTypes.length) {
            return -1;
        }
        else if (a.paramTypes.length < b.paramTypes.length) {
            return 1;
        }
        // For the same number of parameters, order methods with fewer 'any' arguments first
        if (countArgsOfTypeAny(a) < countArgsOfTypeAny(b)) {
            return -1;
        }
        else if (countArgsOfTypeAny(a) > countArgsOfTypeAny(b)) {
            return 1;
        }
        // For the same number of parameters, order the longer (presumably more complex) signature to be first
        if (a.signature.length > b.signature.length) {
            return -1;
        }
        else if (a.signature.length < b.signature.length) {
            return 1;
        }
        // As a final catch-all, just sort lexically by signature.
        return b.signature.localeCompare(a.signature);
    };
    // *groupMethods()*: group overloaded methods (i.e. having the same name)
    ClassesMap.prototype.groupMethods = function (flatList) {
        var _this = this;
        var variantsMap = _.groupBy(flatList, function (method) {
            return method.name;
        });
        _.forEach(variantsMap, function (variants, name) {
            variantsMap[name] = variants.sort(_this.compareVariants);
        });
        return variantsMap;
    };
    // *fixClassPath()*: given a full class path name, rename any path components that are reserved words.
    ClassesMap.prototype.fixClassPath = function (fullName) {
        var reservedWords = [
            'function',
            'package'
        ];
        var parts = fullName.split('.');
        parts = _.map(parts, function (part) {
            if (_.indexOf(reservedWords, part) === -1) {
                return part;
            }
            else {
                return part + '_';
            }
        });
        return parts.join('.');
    };
    // *packageName()*: given a full class path name, return the package name.
    ClassesMap.prototype.packageName = function (className) {
        var parts = className.split('.');
        parts.pop();
        return parts.join('.');
    };
    // *mapClass()*: return a map of all useful properties of a class.
    ClassesMap.prototype.mapClass = function (className, work) {
        var _this = this;
        var clazz = this.loadClass(className);
        assert.strictEqual(className, clazz.getNameSync());
        var interfaces = this.mapClassInterfaces(className, clazz, work);
        var methods = this.mapClassMethods(className, clazz, work);
        var constructors = this.mapClassConstructors(className, clazz, work);
        var isInterface = clazz.isInterfaceSync();
        var isPrimitive = clazz.isPrimitiveSync();
        var superclass = clazz.getSuperclassSync();
        function bySignature(a, b) {
            return a.signature.localeCompare(b.signature);
        }
        var tsInterfaces = _.map(interfaces, function (intf) {
            return _this.fixClassPath(intf);
        });
        if (superclass) {
            work.addTodo(superclass.getNameSync());
            tsInterfaces.unshift(this.fixClassPath(superclass.getNameSync()));
        }
        var classMap = {
            packageName: this.packageName(this.fixClassPath(className)),
            fullName: className,
            shortName: this.shortClassName(className),
            isInterface: isInterface,
            isPrimitive: isPrimitive,
            superclass: superclass === null ? null : superclass.getNameSync(),
            interfaces: interfaces,
            tsInterfaces: tsInterfaces,
            methods: methods.sort(bySignature),
            constructors: constructors.sort(this.compareVariants),
            variants: this.groupMethods(methods)
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
    // *initialize()*: fully initialize from seedClasses.
    ClassesMap.prototype.initialize = function (seedClasses) {
        this.loadAllClasses(seedClasses);
    };
    return ClassesMap;
})();
var ClassesMap;
(function (ClassesMap) {
    'use strict';
})(ClassesMap || (ClassesMap = {}));
module.exports = ClassesMap;
//# sourceMappingURL=classes-map.js.map