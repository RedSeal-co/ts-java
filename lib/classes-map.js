/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./java.d.ts' />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var debug = require('debug');
var Immutable = require('immutable');
var ParamContext = require('./paramcontext');
var Work = require('./work');
var dlog = debug('ts-java:classes-map');
var requiredSeedClasses = [
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
    // #### **methodSignature()**: return the signature of a method, i.e. a string unique to any method variant,
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
    // #### **tsTypeName()**: given a java type name, return a typescript type name
    ClassesMap.prototype.tsTypeName = function (javaTypeName, context) {
        if (context === void 0) { context = 0 /* eInput */; }
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
        // First convert the 1-letter JNI abbreviated type names to their human readble types
        var jniAbbreviations = {
            // see http://docs.oracle.com/javase/7/docs/technotes/guides/jni/spec/types.html
            B: 'byte',
            C: 'char',
            D: 'double',
            F: 'float',
            I: 'int',
            J: 'long',
            S: 'short',
            Z: 'boolean'
        };
        if (typeName in jniAbbreviations) {
            typeName = jniAbbreviations[typeName];
        }
        // Next, promote primitive types to their corresponding Object types, to avoid redundancy below.
        var primitiveToObjectMap = {
            'byte': 'java.lang.Object',
            'char': 'java.lang.Object',
            'boolean': 'java.lang.Boolean',
            'short': 'java.lang.Short',
            'long': 'java.lang.Long',
            'int': 'java.lang.Integer',
            'float': 'java.lang.Float',
            'double': 'java.lang.Double'
        };
        if (typeName in primitiveToObjectMap) {
            typeName = primitiveToObjectMap[typeName];
        }
        if (!this.inWhiteList(typeName) && typeName !== 'void') {
            // Since the type is not in our whiteList, we might want to use the Typescript 'any' type.
            // However, array_t<any> doesn't really make sense. Rather, we want array_t<Object>,
            // or possibly instead of Object a superclass that is in our whitelist.
            this.unhandledTypes = this.unhandledTypes.add(typeName);
            typeName = 'java.lang.Object';
        }
        // Finally, convert Java primitive types to Typescript primitive types.
        // node-java does type translation for a set of common/primitive types.
        // Translation is done both for function input parameters, and function return values.
        // In general, it's not a 1-1 mapping between types.
        // For function input parameters, we generaly need union types, so that methods can accept
        // either javascript values, or java values (object pointers of a given Java type).
        // Function return results are always a single type, but several java types may map to
        // one javascript type (e.g. number).
        // string_t is a union type [string|java.lang.String] defined in the handlebars template.
        // Likewise object_t is the union type [string|java.lang.Object], a special case because it
        // is common to pass a string to methods that are declared to take Object.
        // (This may change when we implement generics).
        // java.lang.Long type requires special handling, since javascript does not have 64-bit integers.
        // For return values, node-java returns a Number that has an additional key 'longValue' holding a string
        // representation of the full long integer. The value of the Number itself is the best floating point
        // approximation (53 bits of the mantissa plus an exponent).
        // We define an interface longValue_t (in package.txt) that that extends Number and adds a string member longValue.
        // We also define long_t, which is the union [number|longValue_t|java.lang.Long].
        var javaTypeToTypescriptType = {
            void: 'void',
            'java.lang.Boolean': context === 0 /* eInput */ ? 'boolean_t' : 'boolean',
            'java.lang.Double': context === 0 /* eInput */ ? 'double_t' : 'number',
            'java.lang.Float': context === 0 /* eInput */ ? 'float_t' : 'number',
            'java.lang.Integer': context === 0 /* eInput */ ? 'integer_t' : 'number',
            'java.lang.Long': context === 0 /* eInput */ ? 'long_t' : 'longValue_t',
            'java.lang.Number': context === 0 /* eInput */ ? 'number_t' : 'number',
            'java.lang.Object': context === 0 /* eInput */ ? 'object_t' : 'java.lang.Object',
            'java.lang.Short': context === 0 /* eInput */ ? 'short_t' : 'number',
            'java.lang.String': context === 0 /* eInput */ ? 'string_t' : 'string'
        };
        var isJavaLangType = typeName in javaTypeToTypescriptType;
        var isPrimitiveType = isJavaLangType && typeName !== 'java.lang.Object';
        if (isJavaLangType) {
            typeName = javaTypeToTypescriptType[typeName];
        }
        else if (this.inWhiteList(typeName)) {
            // TODO: we should only return shortName if we know there are no ambiguous cases.
            // Pivotal story 88154024
            typeName = this.shortClassName(typeName);
        }
        else {
            dlog('Unhandled type:', typeName);
            this.unhandledTypes = this.unhandledTypes.add(typeName);
            typeName = 'any';
        }
        // Handle arrays
        assert.ok(ext.length % 2 === 0); // ext must be sequence of zero or more '[]'.
        if (ext === '') {
        }
        else if (context === 1 /* eReturn */ && isPrimitiveType) {
            // Functions that return an array of a primitive type are thunked by node-java to return a
            // javascript array of the corresponding javascript primitive type.
            // This seems to work even for multidimensional arrays.
            typeName = typeName + ext;
        }
        else if (ext === '[]') {
            // Node-java has support for 1d arrays via newArray. We need the special opaque type array_t<T> to
            // model the type of these array objects.
            typeName = 'array_t<' + typeName + '>';
        }
        else {
            // This final else block handles two cases for multidimensial arrays:
            // 1) When used as a function input.
            // 2) When returned as a function result, and the element type is not a primitive.
            // Node-java currently doesn't handle these cases. We use the 'void' type here so that
            // such uses will be flagged with an error at compile time.
            this.unhandledTypes = this.unhandledTypes.add(typeName + ext);
            typeName = 'void';
        }
        return typeName;
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
        else {
            // It is convenient to declare the return type for a constructor to be the type of the class,
            // possibly transformed by tsTypeName. This is because node-java will always convert boxed primitive
            // types to the corresponding javascript primitives, e.g. java.lang.String -> string, and
            // java.lang.Integer -> number.
            returnType = method.getDeclaringClassSync().getNameSync();
        }
        var methodMap = {
            name: method.getNameSync(),
            declared: method.getDeclaringClassSync().getNameSync(),
            returns: returnType,
            tsReturns: this.tsTypeName(returnType, 1 /* eReturn */),
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
                    work.addTodo(canonicalTypeName);
                }
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
            tsType: this.tsTypeName(className),
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
        _.forEach(requiredSeedClasses, function (className) { return work.addTodo(className); });
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