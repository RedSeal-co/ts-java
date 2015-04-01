/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./ls-archive.d.ts' />
/// <reference path='./java.d.ts' />
'use strict';
var _ = require('lodash');
var archive = require('ls-archive');
var assert = require('assert');
var BluePromise = require('bluebird');
var debug = require('debug');
var Immutable = require('immutable');
var ParamContext = require('./paramcontext');
var Work = require('./work');
var dlog = debug('ts-java:classes-map');
var requiredSeedClasses = [
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
        this.classes = {};
        this.unhandledTypes = Immutable.Set();
        this.allClasses = Immutable.Set();
        // We create this after the first pass.
        this.shortToLongNameMap = null;
        this.includedPatterns = Immutable.Set(_.map(this.options.whiteList, function (str) {
            return new RegExp(str);
        }));
        var seeds = Immutable.Set(requiredSeedClasses).merge(options.seedClasses);
        seeds.forEach(function (className) {
            if (!_this.inWhiteList(className)) {
                var pattern = new RegExp('^' + className.replace(/([\.\$])/g, '\\$1') + '$');
                _this.includedPatterns = _this.includedPatterns.add(pattern);
            }
        });
    }
    // *inWhiteList()*: Return true for classes of interest.
    ClassesMap.prototype.inWhiteList = function (className) {
        return this.includedPatterns.find(function (ns) {
            return className.match(ns) !== null;
        }) !== undefined;
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
            'java.lang.Object': context === 0 /* eInput */ ? 'object_t' : 'object_t',
            'java.lang.Short': context === 0 /* eInput */ ? 'short_t' : 'number',
            'java.lang.String': context === 0 /* eInput */ ? 'string_t' : 'string'
        };
        if (typeName in javaTypeToTypescriptType) {
            typeName = javaTypeToTypescriptType[typeName];
        }
        else if (this.inWhiteList(typeName)) {
            // Use the short class name if it doesn't cause name conflicts.
            // This can only be done correctly in our 2nd pass, when this.shortToLongNameMap has been populated.
            // However, conflicts are very rare, and unit tests currently don't run two passes,
            // so it is convenient to always map to the short name in the first pass.
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
    ClassesMap.prototype.addToTheToDoList = function (canonicalTypeName, work) {
        // We expect various type names here, 4 general categories:
        // 1) primitive types such as int, long, char
        // 2) arrays of primitive types, such as int[]
        // 3) class names such as java.util.Iterator
        // 4) array-of-class names such as java.util.Iterator[]
        // We only add to the todo list for the last two, and only in the non-array form.
        var parts = this.baseType(canonicalTypeName);
        canonicalTypeName = parts[0];
        if (this.inWhiteList(canonicalTypeName)) {
            work.addTodo(canonicalTypeName);
        }
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
        this.addToTheToDoList(methodMap.declared, work);
        this.addToTheToDoList(methodMap.returns, work);
        _.forEach(methodMap.paramTypes, function (p) {
            _this.addToTheToDoList(p, work);
        });
        return methodMap;
    };
    // *mapClassMethods()*: return a methodMap array for the methods of a class
    ClassesMap.prototype.mapClassMethods = function (className, clazz, work) {
        return _.map(clazz.getMethodsSync(), function (m) {
            return this.mapMethod(m, work);
        }, this);
    };
    // *mapField()*: return a map of useful properties of a field.
    ClassesMap.prototype.mapField = function (field, work) {
        var name = field.getNameSync();
        var fieldType = field.getTypeSync();
        var fieldTypeName = fieldType.getNameSync();
        var declaredIn = field.getDeclaringClassSync().getNameSync();
        var tsType = this.tsTypeName(fieldTypeName, 1 /* eReturn */);
        if (this.inWhiteList(fieldTypeName)) {
            this.addToTheToDoList(fieldTypeName, work);
        }
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
    ClassesMap.prototype.mapClassFields = function (className, clazz, work) {
        // For reasons I don't understand, it seems that getFields() can return duplicates.
        // TODO: Figure out why there are duplicates, as perhaps there is a better fix.
        // In the meantime, we dedup here.
        var allFields = _.map(clazz.getFieldsSync(), function (f) {
            return this.mapField(f, work);
        }, this);
        return _.uniq(allFields, false, 'name');
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
        var fields = this.mapClassFields(className, clazz, work);
        var constructors = this.mapClassConstructors(className, clazz, work);
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
        // Get the superclass of the class, if it exists, and is in our white list.
        // If the immediate type is not in the whitelist, we ascend up the ancestry
        // until we find a whitelisted superclass. If none exists, we declare the
        // class to not have a superclass, even though it does.
        // The developer may want to include the superclass in the seed classes.
        // TODO: implement better diagnostics so it will be clear to the developer
        // that s/he needs to decide whether the superclass needs to be included.
        var superclass = clazz.getSuperclassSync();
        while (superclass && !this.inWhiteList(superclass.getNameSync())) {
            this.unhandledTypes = this.unhandledTypes.add(superclass.getNameSync());
            superclass = superclass.getSuperclassSync();
        }
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
        // tsInterfaces is used in the extends clause of an interface declaration.
        // Each intf is an interface name is a fully scoped java path, but in typescript
        // these paths are all relative paths under the output module Java.
        // In most cases it is not necessary to include the 'Java.' module in the interface
        // name, but in few cases leaving it out causes naming conflicts, most notably
        // between java.lang and groovy.lang.
        tsInterfaces = _.map(tsInterfaces, function (intf) {
            return 'Java.' + intf;
        });
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
            methods: methods.sort(bySignature),
            constructors: constructors.sort(this.compareVariants),
            variants: this.groupMethods(methods),
            isEnum: isEnum,
            fields: fields
        };
        return classMap;
    };
    // *loadAllClasses()*: load and map all classes of interest
    ClassesMap.prototype.loadAllClasses = function (seedClasses) {
        var work = new Work();
        _.forEach(seedClasses, function (className) { return work.addTodo(className); });
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
    ClassesMap.prototype.getWhitedListedClassesInJar = function (jarpath) {
        var _this = this;
        var listArchive = BluePromise.promisify(archive.list, archive);
        return listArchive(jarpath).then(function (entries) {
            var allPaths = _.map(entries, function (entry) { return entry.getPath(); });
            var classFilePaths = _.filter(allPaths, function (path) { return /.class$/.test(path); });
            var classNames = _.map(classFilePaths, function (path) {
                return path.slice(0, -'.class'.length).replace(/\//g, '.');
            });
            var result = _.filter(classNames, function (name) { return _this.inWhiteList(name); });
            return result;
        });
    };
    // *initialize()*: fully initialize from seedClasses.
    ClassesMap.prototype.initialize = function () {
        var _this = this;
        return this.preScanAllClasses().then(function () {
            while (true) {
                // We assume this.allClasses now contains a complete list of all classes
                // that we will process. We scan it now to create the shortToLongNameMap,
                // which allows us to discover class names conflicts.
                // Conflicts are recorded by using null for the longName.
                _this.shortToLongNameMap = {};
                _this.allClasses.forEach(function (longName) {
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
                // Reset our ClassDefinitionMap in case we are recreating it.
                _this.classes = {};
                var seeds = _this.allClasses.toArray();
                var work = _this.loadAllClasses(seeds);
                // We must now check to see if additional classes were processed beyond those
                // in this.allClasses at the start of the loop. This only happens if the TsJavaOptions
                // whiteList includes java.lang or java.util packages and results in classes being
                // added that were not specified in the seed classes.
                var checkClassList = work.getDone();
                assert(_this.allClasses.size <= checkClassList.size);
                var unexpected = checkClassList.subtract(_this.allClasses);
                if (unexpected.size === 0) {
                    break;
                }
                else {
                    console.error('These classes should be added to the tsjava.seedClasses list:', unexpected);
                    _this.allClasses = checkClassList;
                }
            }
        });
    };
    // *preScanAllClasses()*: scan all jars in the class path and find all classes matching our filter.
    // The result is stored in the member variable this.allClasses and returned as the function result
    ClassesMap.prototype.preScanAllClasses = function () {
        var _this = this;
        var options = this.options;
        return BluePromise.reduce(options.classpath, function (allSoFar, jarpath) {
            return _this.getWhitedListedClassesInJar(jarpath).then(function (classes) {
                return BluePromise.reduce(classes, function (allSoFar, className) { return allSoFar.add(className); }, allSoFar);
            });
        }, Immutable.Set()).then(function (allSoFar) {
            // We don't have java.lang classes in the scan of jars in the class path.
            // We'll get them from these two sources of seed classes.
            allSoFar = allSoFar.union(options.seedClasses);
            allSoFar = allSoFar.union(requiredSeedClasses);
            _this.allClasses = allSoFar;
            return allSoFar;
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