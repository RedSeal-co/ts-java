/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./zip.d.ts' />
/// <reference path='./java.d.ts' />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var BluePromise = require('bluebird');
var debug = require('debug');
var fs = require('fs');
var Immutable = require('immutable');
var ParamContext = require('./paramcontext');
var Work = require('./work');
var zip = require('zip');
var openAsync = BluePromise.promisify(fs.open, fs);
var dlog = debug('ts-java:classes-map');
var requiredCoreClasses = [
    'java.lang.Object',
    'java.lang.String',
];
var reservedShortNames = {
    'Number': null
};
// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
var ClassesMap = (function () {
    function ClassesMap(java, options) {
        var _this = this;
        this.java = java;
        this.options = options;
        this.classCache = Immutable.Map();
        this.classes = {};
        this.unhandledTypes = Immutable.Set();
        this.unhandledInterfaces = Immutable.Set();
        this.unhandledSuperClasses = Immutable.Set();
        this.allClasses = Immutable.Set();
        // We create this after the first pass.
        this.shortToLongNameMap = null;
        // TODO: remove these two lines when the deprecated `seedClasses` and `whiteList` are no longer needed.
        options.classes = options.classes || options.seedClasses;
        options.packages = options.packages || options.whiteList;
        this.includedPatterns = Immutable.Set(_.map(this.options.packages, function (expr) {
            var pattern = _this.packageExpressionToRegExp(expr);
            dlog('package pattern:', pattern);
            return pattern;
        }));
        var seeds = Immutable.Set(requiredCoreClasses).merge(options.classes);
        seeds.forEach(function (className) {
            if (!_this.inWhiteList(className)) {
                var pattern = new RegExp('^' + className.replace(/([\.\$])/g, '\\$1') + '$');
                _this.includedPatterns = _this.includedPatterns.add(pattern);
            }
        });
    }
    // *getAllClasses()*: Return the set of all classes selected by the configuration, i.e. appearing in output java.d.ts.
    ClassesMap.prototype.getAllClasses = function () {
        return this.allClasses;
    };
    // *getIncludedPatterns()*: Return the set of all package patterns derived from the configuration.
    ClassesMap.prototype.getIncludedPatterns = function () {
        return this.includedPatterns;
    };
    // *getOptions()*: Return the TsJavaOptions used to configure this ClassesMap.
    ClassesMap.prototype.getOptions = function () {
        return this.options;
    };
    // *packageExpressionToRegExp()*: Return a RegExp equivalent to the given package expression.
    ClassesMap.prototype.packageExpressionToRegExp = function (expr) {
        if (/\.\*$/.test(expr)) {
            // package string ends with .*
            expr = expr.slice(0, -1); // remove the *
            expr = expr + '[\\w\\$]+$'; // and replace it with expression designed to match exactly one classname string
        }
        else if (/\.\*\*$/.test(expr)) {
            // package string ends with .**
            expr = expr.slice(0, -2); // remove the **
        }
        expr = '^' + expr.replace(/\./g, '\\.');
        return new RegExp(expr);
    };
    // *inWhiteList()*: Return true for classes of interest.
    ClassesMap.prototype.inWhiteList = function (className) {
        var allowed = this.includedPatterns.find(function (ns) {
            return className.match(ns) !== null;
        }) !== undefined;
        if (allowed) {
            var isAnon = /\$\d+$/.test(className);
            if (isAnon) {
                dlog('Filtering out anon class:', className);
                allowed = false;
            }
        }
        return allowed;
    };
    // *isIncludedClass()*: Return true if the class will appear in the output java.d.ts file.
    // All such classes 1) match the classes or package expressions in the tsjava section of the package.json,
    // and 2) are public.
    ClassesMap.prototype.isIncludedClass = function (className) {
        return this.allClasses.has(className);
    };
    // *shortClassName()*: Return the short class name given the full className (class path).
    ClassesMap.prototype.shortClassName = function (className) {
        return _.last(className.split('.'));
    };
    // *getClass()*: get the Class object for the given full class name.
    ClassesMap.prototype.getClass = function (className) {
        var clazz = this.classCache.get(className);
        if (!clazz) {
            throw new Error('java.lang.ClassNotFoundException:' + className);
        }
        return clazz;
    };
    // *resolveInterfaces()*: Find the set of non-excluded interfaces for the given class `clazz`.
    // If an interface of a class is excluded by the configuration, we check the ancestors of that class.
    ClassesMap.prototype.resolveInterfaces = function (clazz) {
        var _this = this;
        var result = Immutable.Set();
        _.forEach(clazz.getInterfacesSync(), function (intf) {
            var intfName = intf.getNameSync();
            if (_this.isIncludedClass(intfName)) {
                result = result.add(intfName);
            }
            else {
                // Remember the excluded interface
                _this.unhandledInterfaces = _this.unhandledInterfaces.add(intfName);
                // recurse and merge results.
                result = result.merge(_this.resolveInterfaces(intf));
            }
        });
        return result;
    };
    // *mapClassInterfaces()*: Find the direct interfaces of className.
    ClassesMap.prototype.mapClassInterfaces = function (className, clazz) {
        assert.strictEqual(clazz.getNameSync(), className);
        var interfaces = this.resolveInterfaces(clazz).toArray();
        // Methods of Object must always be available on any instance variable, even variables whose static
        // type is a Java interface. Java does this implicitly. We have to do it explicitly.
        var javaLangObject = 'java.lang.Object';
        if (interfaces.length === 0 && className !== javaLangObject && clazz.getSuperclassSync() === null) {
            interfaces.push(javaLangObject);
        }
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
        if (!this.isIncludedClass(typeName) && typeName !== 'void') {
            // Since the type is not in our included classes, we might want to use the Typescript 'any' type.
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
            'java.lang.Object': context === 0 /* eInput */ ? 'object_t' : 'object_t',
            'java.lang.Short': context === 0 /* eInput */ ? 'short_t' : 'number',
            'java.lang.String': context === 0 /* eInput */ ? 'string_t' : 'string'
        };
        if (typeName in javaTypeToTypescriptType) {
            typeName = javaTypeToTypescriptType[typeName];
        }
        else if (this.isIncludedClass(typeName)) {
            // Use the short class name if it doesn't cause name conflicts.
            // This can only be done correctly after running prescanAllClasses,
            // when this.shortToLongNameMap has been populated.
            // However, conflicts are very rare, and unit tests currently don't run prescanAllClasses,
            // so it is convenient to always map to the short name if shortToLongNameMap doesn't exist.
            var shortName = this.shortClassName(typeName);
            if (!this.shortToLongNameMap || this.shortToLongNameMap[shortName] === typeName) {
                typeName = shortName;
            }
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
        else if (context === 1 /* eReturn */) {
            // Functions that return a Java array are thunked by node-java to return a
            // javascript array of the corresponding type.
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
    ClassesMap.prototype.mapMethod = function (method) {
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
        return methodMap;
    };
    // *mapClassMethods()*: return a methodMap array for the methods of a class
    ClassesMap.prototype.mapClassMethods = function (className, clazz) {
        return _.map(clazz.getMethodsSync(), function (m) {
            return this.mapMethod(m);
        }, this);
    };
    // *mapField()*: return a map of useful properties of a field.
    ClassesMap.prototype.mapField = function (field) {
        var name = field.getNameSync();
        var fieldType = field.getTypeSync();
        var fieldTypeName = fieldType.getNameSync();
        var declaredIn = field.getDeclaringClassSync().getNameSync();
        var tsType = this.tsTypeName(fieldTypeName, 1 /* eReturn */);
        var modifiers = field.getModifiersSync();
        var isStatic = (modifiers & 8) === 8;
        var isSynthetic = field.isSyntheticSync();
        var fieldDefinition = {
            name: name,
            tsType: tsType,
            isStatic: isStatic,
            isSynthetic: isSynthetic,
            modifiers: modifiers,
            declaredIn: declaredIn
        };
        return fieldDefinition;
    };
    // *mapClassFields()*: return a FieldDefinition array for the fields of a class
    ClassesMap.prototype.mapClassFields = function (className, clazz) {
        // For reasons I don't understand, it seems that getFields() can return duplicates.
        // TODO: Figure out why there are duplicates, as perhaps there is a better fix.
        // In the meantime, we dedup here.
        var allFields = _.map(clazz.getFieldsSync(), function (f) {
            return this.mapField(f);
        }, this);
        return _.uniq(allFields, false, 'name');
    };
    // *mapClassConstructors()*: return a methodMap array for the constructors of a class
    ClassesMap.prototype.mapClassConstructors = function (className, clazz) {
        return _.map(clazz.getConstructorsSync(), function (m) {
            return this.mapMethod(m);
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
        // As a penultimate catch-all, sort lexically by signature.
        var result = b.signature.localeCompare(a.signature);
        if (result !== 0) {
            return result;
        }
        // As a final catch-all, sort lexically by the generic proto signature.
        return a.generic_proto.localeCompare(b.generic_proto);
    };
    // *flattenDictionary()*: return an array of the dictionary's values, sorted by the dictionary's keys.
    ClassesMap.prototype.flattenDictionary = function (dict) {
        function caseInsensitiveOrder(a, b) {
            var A = a.toLowerCase();
            var B = b.toLowerCase();
            if (A < B) {
                return -1;
            }
            else if (A > B) {
                return 1;
            }
            else {
                return 0;
            }
        }
        var keys = _.keys(dict).sort(caseInsensitiveOrder);
        return _.map(keys, function (key) { return dict[key]; });
    };
    // *groupMethods()*: group methods first by name, and then by signature.
    ClassesMap.prototype.groupMethods = function (flatList) {
        var result = {};
        _.forEach(flatList, function (method) {
            if (!_.has(result, method.name)) {
                result[method.name] = {};
            }
            result[method.name][method.signature] = method;
        });
        return result;
    };
    ClassesMap.prototype.interfacesTransitiveClosure = function (directInterfaces) {
        var _this = this;
        var work = new Work();
        directInterfaces.forEach(function (intf) { return work.addTodo(intf); });
        work.forEach(function (intf) {
            _this.classes[intf].interfaces.forEach(function (parent) { return work.addTodo(parent); });
        });
        return work.getDone().toArray();
    };
    ClassesMap.prototype.mergeOverloadedVariants = function (variantsDict, directInterfaces) {
        var _this = this;
        var interfaces = this.interfacesTransitiveClosure(directInterfaces).sort();
        // TODO: sort by depth instead of lexical order.
        _.forEach(variantsDict, function (methodVariants, methodName) {
            _.forEach(interfaces, function (intfName) {
                var intfVariantsDict = _this.classes[intfName].variantsDict;
                if (_.has(intfVariantsDict, methodName)) {
                    _.assign(variantsDict[methodName], intfVariantsDict[methodName]);
                }
            });
        });
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
        var clazz = this.getClass(className);
        assert.strictEqual(className, clazz.getNameSync());
        var interfaces = this.mapClassInterfaces(className, clazz).sort();
        interfaces.forEach(function (intfName) {
            if (!work.alreadyDone(intfName)) {
                work.addTodo(intfName); // needed only to simplify a unit test. Normally a no-op.
                dlog('Recursing in mapClass to do inherited interface:', intfName);
                _this.classes[intfName] = _this.mapClass(intfName, work);
                work.setDone(intfName);
            }
        });
        var methods = this.mapClassMethods(className, clazz).sort(bySignature);
        var fields = this.mapClassFields(className, clazz);
        var constructors = this.mapClassConstructors(className, clazz);
        var shortName = this.shortClassName(className);
        var alias = shortName;
        var useAlias = true;
        if (this.shortToLongNameMap === null) {
        }
        else if (this.shortToLongNameMap[shortName] !== className) {
            alias = className;
            useAlias = false;
        }
        var isInterface = clazz.isInterfaceSync();
        var isPrimitive = clazz.isPrimitiveSync();
        var isEnum = clazz.isEnumSync();
        // Get the superclass of the class, if it exists, and is an included class.
        // If the immediate type is not an included class, we ascend up the ancestry
        // until we find an included superclass. If none exists, we declare the
        // class to not have a superclass, even though it does.
        // We report all such skipped superclasses in the summary diagnostics.
        // The developer can then choose to add any of these classes to the seed classes list.
        var superclass = clazz.getSuperclassSync();
        while (superclass && !this.isIncludedClass(superclass.getNameSync())) {
            this.unhandledSuperClasses = this.unhandledSuperClasses.add(superclass.getNameSync());
            superclass = superclass.getSuperclassSync();
        }
        function bySignature(a, b) {
            return a.signature.localeCompare(b.signature);
        }
        var tsInterfaces = _.map(interfaces, function (intf) {
            return _this.fixClassPath(intf);
        });
        if (superclass) {
            tsInterfaces.unshift(this.fixClassPath(superclass.getNameSync()));
        }
        // tsInterfaces is used in the extends clause of an interface declaration.
        // Each intf is an interface name is a fully scoped java path, but in typescript
        // these paths are all relative paths under the output module Java.
        // In most cases it is not necessary to include the 'Java.' module in the interface
        // name, but in few cases leaving it out causes naming conflicts, most notably
        // between java.lang and groovy.lang.
        tsInterfaces = _.map(tsInterfaces, function (intf) {
            return 'Java.' + intf;
        });
        var variantsDict = this.groupMethods(methods);
        this.mergeOverloadedVariants(variantsDict, interfaces);
        var variants = _.map(variantsDict, function (bySig) { return _this.flattenDictionary(bySig).sort(_this.compareVariants); });
        var classMap = {
            quotedPkgName: this.packageName(this.fixClassPath(className)),
            packageName: this.packageName(className),
            fullName: className,
            shortName: shortName,
            alias: alias,
            useAlias: useAlias,
            tsType: this.tsTypeName(className),
            isInterface: isInterface,
            isPrimitive: isPrimitive,
            superclass: superclass === null ? null : superclass.getNameSync(),
            interfaces: interfaces,
            tsInterfaces: tsInterfaces,
            methods: methods,
            constructors: constructors.sort(this.compareVariants),
            variantsDict: variantsDict,
            variants: variants,
            isEnum: isEnum,
            fields: fields
        };
        return classMap;
    };
    // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
    ClassesMap.prototype.getClasses = function () {
        return this.classes;
    };
    // *getSortedClasses()*: return a sorted array of classes.
    ClassesMap.prototype.getSortedClasses = function () {
        return this.flattenDictionary(this.classes);
    };
    // *getWhitedListedClassesInJar()*: For the given jar, read the index, and return an array of all classes
    // from the jar that are selected by the configuration.
    ClassesMap.prototype.getWhitedListedClassesInJar = function (jarpath) {
        var _this = this;
        dlog('getWhitedListedClassesInJar started for:', jarpath);
        var result = [];
        return openAsync(jarpath, 'r', '0666').then(function (fd) {
            var reader = zip.Reader(fd);
            reader.forEach(function (entry) {
                if (entry) {
                    var entryPath = entry.getName();
                    if (/\.class$/.test(entryPath)) {
                        var className = entryPath.slice(0, -'.class'.length).replace(/\//g, '.');
                        if (_this.inWhiteList(className)) {
                            result.push(className);
                        }
                    }
                }
            });
        }).then(function () { return result; });
    };
    // *createShortNameMap()*: Find all classes with unique class names, and create a map from name to full class name.
    // E.g. if `java.lang.String` is the only class named `String`, the map will contain {'String': 'java.lang.String'}.
    // For non-unique class names, the name is added to the map with a null value.
    ClassesMap.prototype.createShortNameMap = function () {
        var _this = this;
        dlog('createShortNameMap started');
        // We assume this.allClasses now contains a complete list of all classes
        // that we will process. We scan it now to create the shortToLongNameMap,
        // which allows us to discover class names conflicts.
        // Conflicts are recorded by using null for the longName.
        this.shortToLongNameMap = {};
        this.allClasses.forEach(function (longName) {
            var shortName = _this.shortClassName(longName);
            if (shortName in reservedShortNames || shortName in _this.shortToLongNameMap) {
                // We have a conflict
                _this.shortToLongNameMap[shortName] = null;
            }
            else {
                // No conflict yet
                _this.shortToLongNameMap[shortName] = longName;
            }
        });
        dlog('createShortNameMap completed');
        return;
    };
    // *analyzeIncludedClasses()*: Analyze all of the classes included by the configuration, creating a ClassDefinition
    // for each class.
    ClassesMap.prototype.analyzeIncludedClasses = function () {
        var _this = this;
        dlog('analyzeIncludedClasses started');
        var work = new Work();
        this.allClasses.forEach(function (className) { return work.addTodo(className); });
        work.forEach(function (className) {
            _this.classes[className] = _this.mapClass(className, work);
        });
        dlog('analyzeIncludedClasses completed');
        return;
    };
    // *loadClassCache()*: Load all classes seen in prescan, pruning any non-public classes.
    ClassesMap.prototype.loadClassCache = function () {
        var _this = this;
        var Modifier = this.java.import('java.lang.reflect.Modifier');
        var nonPublic = Immutable.Set();
        var classLoader = this.java.getClassLoader();
        this.allClasses.forEach(function (className) {
            var clazz = classLoader.loadClassSync(className);
            var modifiers = clazz.getModifiersSync();
            var isPublic = Modifier.isPublicSync(modifiers);
            var isPrivate = Modifier.isPrivateSync(modifiers);
            var isProtected = Modifier.isProtectedSync(modifiers);
            if (isPublic) {
                _this.classCache = _this.classCache.set(className, clazz);
            }
            else {
                nonPublic = nonPublic.add(className);
                if (isPrivate) {
                    dlog('Pruning private class:', className);
                }
                else if (isProtected) {
                    dlog('Pruning protected class:', className);
                }
                else {
                    dlog('Pruning package-private class:', className);
                }
            }
        });
        this.allClasses = this.allClasses.subtract(nonPublic);
        return;
    };
    // *initialize()*: fully initialize from configured packages & classes.
    ClassesMap.prototype.initialize = function () {
        var _this = this;
        return BluePromise.resolve().then(function () { return _this.preScanAllClasses(); }).then(function () { return _this.loadClassCache(); }).then(function () { return _this.createShortNameMap(); }).then(function () { return _this.analyzeIncludedClasses(); });
    };
    // *preScanAllClasses()*: scan all jars in the class path and find all classes matching our filter.
    // The result is stored in the member variable this.allClasses and returned as the function result
    ClassesMap.prototype.preScanAllClasses = function () {
        var _this = this;
        dlog('preScanAllClasses started');
        var options = this.options;
        var result = Immutable.Set();
        var promises = _.map(options.classpath, function (jarpath) { return _this.getWhitedListedClassesInJar(jarpath); });
        return BluePromise.all(promises).each(function (classes) {
            result = result.merge(classes);
        }).then(function () {
            _this.allClasses = result;
            dlog('preScanAllClasses completed');
        });
    };
    return ClassesMap;
})();
var ClassesMap;
(function (ClassesMap) {
    'use strict';
})(ClassesMap || (ClassesMap = {}));
module.exports = ClassesMap;
//# sourceMappingURL=classes-map.js.map