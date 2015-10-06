/// <reference path='../node_modules/immutable/dist/immutable.d.ts' />
/// <reference path='../typings/bluebird/bluebird.d.ts' />
/// <reference path="../typings/debug/debug.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />
/// <reference path='../typings/node/node.d.ts' />
/// <reference path='./zip.d.ts' />
'use strict';
var _ = require('lodash');
var assert = require('assert');
var BluePromise = require('bluebird');
var debug = require('debug');
var fs = require('fs');
var Immutable = require('immutable');
var Work = require('./work');
var zip = require('zip');
var reflection = require('./reflection');
var Java = reflection.Java;
var openAsync = BluePromise.promisify(fs.open);
var dlog = debug('ts-java:classes-map');
var ddbg = debug('ts-java:classes-map-dbg');
var requiredCoreClasses = [
    'java.lang.Object',
    'java.lang.String',
];
var reservedShortNames = {
    'Number': null
};
(function (ParamContext) {
    ParamContext[ParamContext["eInput"] = 0] = "eInput";
    ParamContext[ParamContext["eReturn"] = 1] = "eReturn";
})(exports.ParamContext || (exports.ParamContext = {}));
var ParamContext = exports.ParamContext;
;
// ## ClassesMap
// ClassesMap is a map of a set of java classes/interfaces, containing information extracted via Java Reflection.
// For each such class/interface, we extract the set of interfaces inherited/implemented by the class,
// and information about all methods implemented by the class (directly or indirectly via inheritance).
var ClassesMap = (function () {
    function ClassesMap(options) {
        var _this = this;
        this.Modifier = Java.importClass('java.lang.reflect.Modifier');
        this.options = options;
        this.classCache = Immutable.Map();
        this.classes = {};
        this.unhandledTypes = Immutable.Set();
        this.unhandledInterfaces = Immutable.Set();
        this.unhandledSuperClasses = Immutable.Set();
        this.allClasses = Immutable.Set();
        this.allExcludedClasses = Immutable.Set();
        this.Modifier = Java.importClass('java.lang.reflect.Modifier');
        // shortToLongNameMap is initialized by createShortNameMap(), in the initialize() sequence,
        // before analyzeIncludedClasses() is called.
        this.shortToLongNameMap = null;
        this.interfaceDepthCache = Immutable.Map();
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
    // *initialize()*: fully initialize from configured packages & classes.
    ClassesMap.prototype.initialize = function () {
        var _this = this;
        return BluePromise.resolve()
            .then(function () { return _this.preScanAllClasses(); })
            .then(function () { return _this.loadClassCache(); })
            .then(function () { return _this.createShortNameMap(); })
            .then(function () { return _this.analyzeIncludedClasses(); });
    };
    // *fixGenericNestedTypeName()*: given a className returned by java reflection for generics,
    // check to see if the className appears to be a nested class name with the outer class redundantly specified.
    // If so, remove the redundant outer class name.
    ClassesMap.prototype.fixGenericNestedTypeName = function (className) {
        var m = /^([\w\.]+)\.\1\$(.+)$/.exec(className);
        if (m) {
            className = m[1] + '$' + m[2];
        }
        return className;
    };
    // *classNameOnly()*: Given a string that is either a classname, or a generic type, return just the classname.
    // This method should only be called in contexts where the name is a known classname or generic type name,
    // but for defensive programming purposes we thrown an exception if the name is not known.
    ClassesMap.prototype.classNameOnly = function (possiblyGenericClassName) {
        var genericTypeExp = /^(.*)<(.*)>$/;
        var m = genericTypeExp.exec(possiblyGenericClassName);
        var className = m ? m[1] : possiblyGenericClassName;
        className = this.fixGenericNestedTypeName(className);
        // For defensive programming purposes, let's confirm that className is a legitimate className,
        // (seen while scanning all classes in the classpath):
        var isKnown = this.allClasses.has(className) || this.allExcludedClasses.has(className);
        if (!isKnown) {
            throw new Error(possiblyGenericClassName + ' is not a known className');
        }
        return className;
    };
    // *isIncludedClass()*: Return true if the class will appear in the output java.d.ts file.
    // All such classes 1) match the classes or package expressions in the tsjava section of the package.json,
    // and 2) are public.
    ClassesMap.prototype.isIncludedClass = function (className) {
        return this.allClasses.has(this.classNameOnly(className));
    };
    // *isExcludedClass()*: return true if className was seen in classpath, but excluded by configuration.
    // Return false if the className was seen in classpath and allowed by configuration.
    // Throws exception for unrecognized class name.
    // If className appears to be a generic type, perform the test on just the classname.
    ClassesMap.prototype.isExcludedClass = function (className) {
        var genericTypeExp = /^(.*)<(.*)>$/;
        var m = genericTypeExp.exec(className);
        if (m) {
            className = m[1];
        }
        var isExcluded = this.allExcludedClasses.has(className);
        if (!isExcluded) {
            // For defensive programming purposes, let's confirm that className is a legitimate className,
            // by confirming that it exists in the allClasses list:
            var isKnown = this.allClasses.has(className);
            if (!isKnown) {
                throw new Error(className + ' is not a known className');
            }
        }
        return isExcluded;
    };
    // *getSortedClasses()*: return a sorted array of classes.
    ClassesMap.prototype.getSortedClasses = function () {
        return this.flattenDictionary(this.classes);
    };
    // *getClasses()*: return the map of all classes. Keys are classnames, values are classMaps.
    ClassesMap.prototype.getClasses = function () {
        return this.classes;
    };
    // *getAllClasses()*: Return the set of all classes selected by the configuration, i.e. appearing in output java.d.ts.
    ClassesMap.prototype.getAllClasses = function () {
        return this.allClasses;
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
    ClassesMap.prototype.stackTrace = function (msg) {
        var c = console;
        c.trace(msg);
        process.abort();
    };
    // This function is temporary while conducting a refactoring.
    ClassesMap.prototype.tsTypeNameInputEncoded = function (javaTypeName) {
        return this.tsTypeName(javaTypeName, ParamContext.eInput, true);
    };
    // #### **jniDecodeType()**: given a java type name, if it is a JNI encoded type string, decode it.
    // The `encodedTypes` parameter indicates that JNI type strings such as `Ljava.lang.Object;` are expected.
    // It is temporary instrumentation until this refactoring is complete.
    ClassesMap.prototype.jniDecodeType = function (javaTypeName, encodedTypes) {
        if (encodedTypes === void 0) { encodedTypes = false; }
        var typeName = javaTypeName;
        var ext = '';
        while (typeName[0] === '[') {
            if (!encodedTypes) {
                this.stackTrace(javaTypeName);
            }
            typeName = typeName.slice(1);
            ext += '[]';
        }
        var m = typeName.match(/^L(.*);$/);
        if (m) {
            if (!encodedTypes) {
                this.stackTrace(javaTypeName);
            }
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
            if (!encodedTypes) {
                this.stackTrace(javaTypeName);
            }
            typeName = jniAbbreviations[typeName];
        }
        return { typeName: typeName, ext: ext };
    };
    // #### **boxIfJavaPrimitive()**: if typeName is a primitive type, return the boxed Object type.
    ClassesMap.prototype.boxIfJavaPrimitive = function (typeName) {
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
        return typeName;
    };
    // #### **mapUnhandledTypesToJavaLangObject()**: if typeName is a java class not included by configuration,
    // record that the class is 'unhandled', and instead use java.lang.Object.
    ClassesMap.prototype.mapUnhandledTypesToJavaLangObject = function (typeName) {
        if (typeName !== 'void' && !this.isIncludedClass(typeName)) {
            // Since the type is not in our included classes, we might want to use the Typescript 'any' type.
            // However, array_t<any> doesn't really make sense. Rather, we want array_t<Object>,
            // or possibly instead of Object a superclass that is in our whitelist.
            this.unhandledTypes = this.unhandledTypes.add(typeName);
            typeName = 'java.lang.Object';
        }
        return typeName;
    };
    // #### **mapJavaPrimitivesToTypescript()**: For primitive (boxed) types, return the corresponding Typescript type.
    // The typescript type depends on the context, whether the type is in input parameter or function return type.
    ClassesMap.prototype.mapJavaPrimitivesToTypescript = function (typeName, context) {
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
            'java.lang.Boolean': context === ParamContext.eInput ? 'boolean_t' : 'boolean',
            'java.lang.Double': context === ParamContext.eInput ? 'double_t' : 'number',
            'java.lang.Float': context === ParamContext.eInput ? 'float_t' : 'number',
            'java.lang.Integer': context === ParamContext.eInput ? 'integer_t' : 'number',
            'java.lang.Long': context === ParamContext.eInput ? 'long_t' : 'longValue_t',
            'java.lang.Number': context === ParamContext.eInput ? 'number_t' : 'number',
            'java.lang.Object': context === ParamContext.eInput ? 'object_t' : 'object_t',
            'java.lang.Short': context === ParamContext.eInput ? 'short_t' : 'number',
            'java.lang.String': context === ParamContext.eInput ? 'string_t' : 'string'
        };
        if (typeName in javaTypeToTypescriptType) {
            typeName = javaTypeToTypescriptType[typeName];
        }
        return typeName;
    };
    // #### **getJavaAliasName()**: given a java full classname string, return the aliased short name.
    // In cases where the the short class name is ambiguous, return the full name.
    // In all cases, add the 'Java.' namespace qualifier.
    ClassesMap.prototype.getJavaAliasName = function (className) {
        var typeName = className;
        assert.ok(this.isIncludedClass(typeName));
        var shortName = this.shortClassName(typeName);
        if (this.shortToLongNameMap[shortName] === typeName) {
            typeName = shortName;
        }
        // Add the 'Java.' namespace
        typeName = 'Java.' + typeName;
        return typeName;
    };
    // #### **tsTypeName()**: given a java type name, return a typescript type name
    // declared public only for unit tests
    // The `encodedTypes` parameter is a hack put in place to assist with a refactoring.
    // tsTypeName() needs to be split up into functions that handle different aspects of the typename transformation.
    ClassesMap.prototype.tsTypeName = function (javaTypeName, context, encodedTypes) {
        if (context === void 0) { context = ParamContext.eInput; }
        if (encodedTypes === void 0) { encodedTypes = false; }
        var _a = this.jniDecodeType(javaTypeName, encodedTypes), typeName = _a.typeName, ext = _a.ext;
        typeName = this.boxIfJavaPrimitive(typeName);
        typeName = this.mapUnhandledTypesToJavaLangObject(typeName);
        var mappedType = this.mapJavaPrimitivesToTypescript(typeName, context);
        if (mappedType !== typeName || typeName === 'void') {
            typeName = mappedType;
        }
        else if (this.isIncludedClass(typeName)) {
            typeName = this.getJavaAliasName(typeName);
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
        else if (context === ParamContext.eReturn) {
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
    // *isSimpleName()*: Returns true if the string s is a simple name, i.e. one word composed of
    // alphanumeric characters plus $
    ClassesMap.prototype.isSimpleName = function (s) {
        return s.match(/^\w+$/) !== null;
    };
    // *translateIfPrimitiveType()*: If s is a Java primitive type, return the corresponding Typescript type.
    ClassesMap.prototype.translateIfPrimitiveType = function (s, context) {
        if (context === void 0) { context = ParamContext.eInput; }
        var translated = this.boxIfJavaPrimitive(s);
        if (translated !== s) {
            translated = this.mapJavaPrimitivesToTypescript(translated, context);
        }
        return translated;
    };
    // *translateFullClassPathsToShortAlias()*: Given a string which may be a java generic type string,
    // find all full java class paths and translate them to their short alias names.
    ClassesMap.prototype.translateFullClassPathsToShortAlias = function (javaGenericType) {
        // javaGenericType might be a complex type, say java.util.List<java.lang.Class<?>>
        // The translated result would be: Java.List<Java.Class<?>>
        var translated = javaGenericType;
        var re = /[\w\$\.]+/g;
        var m;
        while ((m = re.exec(translated)) !== null) {
            var name = m[0];
            var tname = this.fixGenericNestedTypeName(name);
            if (this.isSimpleName(tname)) {
                // This should catch generic free variables (T, E) as well as primitive types (int, long, ...)
                tname = this.translateIfPrimitiveType(tname);
            }
            else if (this.isIncludedClass(tname)) {
                tname = this.getJavaAliasName(tname);
            }
            else {
                assert(this.isExcludedClass(tname));
                tname = 'any';
            }
            translated = translated.replace(name, tname);
            re.lastIndex -= name.length - tname.length;
        }
        return translated;
    };
    // *translateGenericTypeLists()*: Given a string that may be a java generic type, find all generic
    // constraint expressions <...> and translate them to the best corresponding typescript constraint.
    ClassesMap.prototype.translateGenericTypeLists = function (javaGenericType) {
        // javaGenericType might be a complex type, for example java.util.List<java.lang.Class<?>>
        // As in the example, there may be nested expressions. The algorithm that follows processes
        // the innermost expressions first, replacing the angle brackets < and > with utf8 characters « and ».
        // When all angle brackets have been translated, we make one last pass to restore them.
        if (javaGenericType.indexOf('<') === -1) {
            return javaGenericType;
        }
        var translated = javaGenericType;
        var done = false;
        while (!done) {
            done = true;
            // The regexp re finds generic type expressions foo<...>.
            var re = /([\w\$\.]+)<([^<>]+)>/g;
            var m;
            while ((m = re.exec(translated)) != null) {
                done = false;
                var parts = m[2].split(',');
                parts = _.map(parts, function (s) {
                    s = s.trim();
                    // Typescript doesn't have wildcards in generics.
                    // But I believe an upper bound wildcard expression '? extends T' can be safely translated to 'T'.
                    s = s.replace(/\? extends /, '');
                    // Typescript doesn't have lower bound expressions at all.
                    // Replacing '? super T' with 'T' will be wrong in nearly all cases, so we just replace the whole
                    // constraint with 'any'.
                    // But we also need to translate '?' to 'any', so we combine these two cases by just translating
                    // any constraint that starts with ? to 'any'
                    if (s[0] === '?') {
                        s = 'any';
                    }
                    return s;
                });
                // The generic type expression original matched above might be of the form any<...>.
                // This happens when a Java generic class is excluded by configuration.
                // In that case we have to omit the match generic types <...>, and just return 'any'.
                var reconstructed;
                if (m[1] === 'any') {
                    reconstructed = 'any';
                }
                else {
                    reconstructed = m[1] + '«' + parts.join('‡') + '»';
                }
                translated = translated.replace(m[0], reconstructed);
                re.lastIndex -= m[0].length - reconstructed.length;
            }
        }
        translated = translated.replace(/«/g, '<').replace(/»/g, '>').replace(/‡/g, ', ');
        return translated;
    };
    // *translateGenericType()*: Given a string that may be a java generic type, return the best translation
    // to a typescript type.
    ClassesMap.prototype.translateGenericType = function (javaGenericType) {
        var tsGenericType = javaGenericType;
        // Detect if the type is an array type. If it is strip the string of [] from the type, to be restored later.
        var m = tsGenericType.match(/^([^\[]+)(\[\])+$/);
        if (m) {
            tsGenericType = m[1];
        }
        tsGenericType = this.translateFullClassPathsToShortAlias(tsGenericType);
        tsGenericType = this.translateGenericTypeLists(tsGenericType);
        if (m) {
            tsGenericType = tsGenericType + m[2];
        }
        return tsGenericType;
    };
    // *mapMethod()*: return a map of useful properties of a method or constructor.
    // For our purposes, we can treat constructors as methods except for the handling of return type.
    // declared public only for unit tests
    ClassesMap.prototype.mapMethod = function (method) {
        var _this = this;
        var signature = this.methodSignature(method);
        var isStatic = this.Modifier.isStatic(method.getModifiers());
        var returnType = 'void';
        var genericReturnType = returnType;
        if ('getReturnType' in method) {
            returnType = method.getReturnType().getName();
            genericReturnType = method.getGenericReturnType().getTypeName();
        }
        else {
            // It is convenient to declare the return type for a constructor to be the type of the class,
            // possibly transformed by tsTypeName. This is because node-java will always convert boxed primitive
            // types to the corresponding javascript primitives, e.g. java.lang.String -> string, and
            // java.lang.Integer -> number.
            returnType = method.getDeclaringClass().getName();
            genericReturnType = method.getDeclaringClass().getTypeName();
        }
        var generic_proto = method.toGenericString();
        var ts_generic_proto = this.translateGenericProto(generic_proto);
        var tsReturnsRegular = this.tsTypeName(returnType, ParamContext.eReturn, true);
        var tsGenericReturns = this.translateGenericType(genericReturnType);
        var tsReturns = this.options.generics ? tsGenericReturns : tsReturnsRegular;
        var tsGenericParamTypes = _.map(method.getGenericParameterTypes(), function (p) {
            return _this.translateGenericType(p.getTypeName());
        });
        var methodMap = {
            name: method.getName(),
            declared: method.getDeclaringClass().getName(),
            returns: returnType,
            genericReturns: genericReturnType,
            tsReturnsRegular: tsReturnsRegular,
            tsGenericReturns: tsGenericReturns,
            tsReturns: tsReturns,
            paramNames: _.map(method.getParameters(), function (p) { return p.getName(); }),
            paramTypes: _.map(method.getParameterTypes(), function (p) { return p.getName(); }),
            tsParamTypes: _.map(method.getParameterTypes(), function (p) { return _this.tsTypeNameInputEncoded(p.getName()); }),
            genericParamTypes: _.map(method.getGenericParameterTypes(), function (p) { return p.getTypeName(); }),
            tsGenericParamTypes: tsGenericParamTypes,
            tsTypeParameters: _.map(method.getTypeParameters(), function (p) { return p.getName(); }),
            isStatic: isStatic,
            isVarArgs: method.isVarArgs(),
            generic_proto: generic_proto,
            ts_generic_proto: ts_generic_proto,
            plain_proto: method.toString(),
            signature: signature
        };
        return methodMap;
    };
    // *mapClassMethods()*: return a methodMap array for the methods of a class
    // declared public only for unit tests
    ClassesMap.prototype.mapClassMethods = function (className, clazz) {
        return _.map(clazz.getMethods(), function (m) { return this.mapMethod(m); }, this);
    };
    // *mapClass()*: return a map of all useful properties of a class.
    // declared public only for unit tests
    ClassesMap.prototype.mapClass = function (className, work) {
        var _this = this;
        var clazz = this.getClass(className);
        assert.strictEqual(className, clazz.getName());
        var genericName = clazz.toGenericString();
        var classTypeName = clazz.getTypeName();
        var annotations = _.map(clazz.getAnnotations(), function (anno) { return anno.toString(); });
        var typeParms = _.map(clazz.getTypeParameters(), function (t) { return t.getName(); });
        // Get the superclass of the class, if it exists, and is an included class.
        // If the immediate type is not an included class, we ascend up the ancestry
        // until we find an included superclass. If none exists, we declare the
        // class to not have a superclass, even though it does.
        // We report all such skipped superclasses in the summary diagnostics.
        // The developer can then choose to add any of these classes to the seed classes list.
        var superclass = clazz.getSuperclass();
        while (superclass && !this.isIncludedClass(superclass.getName())) {
            this.unhandledSuperClasses = this.unhandledSuperClasses.add(superclass.getName());
            superclass = superclass.getSuperclass();
        }
        var interfaces = this.mapClassInterfaces(className, clazz).sort();
        if (superclass) {
            interfaces.unshift(superclass.getName());
        }
        interfaces.forEach(function (intfName) {
            if (!work.alreadyDone(intfName)) {
                work.addTodo(intfName); // needed only to simplify a unit test. Normally a no-op.
                dlog('Recursing in mapClass to do inherited interface:', intfName);
                _this.classes[intfName] = _this.mapClass(intfName, work);
                work.setDone(intfName);
            }
        });
        var genericInterfaces = _.map(clazz.getGenericInterfaces(), function (genType) { return genType.getTypeName(); });
        var methods = this.mapClassMethods(className, clazz).sort(bySignature);
        var fields = this.mapClassFields(className, clazz);
        var constructors = this.mapClassConstructors(className, clazz);
        var shortName = this.shortClassName(className);
        var alias = shortName;
        var useAlias = true;
        if (this.shortToLongNameMap[shortName] !== className) {
            alias = className;
            useAlias = false;
        }
        var isInterface = clazz.isInterface();
        var isPrimitive = clazz.isPrimitive();
        var isEnum = clazz.isEnum();
        function bySignature(a, b) {
            return a.signature.localeCompare(b.signature);
        }
        var tsInterfaces = _.map(interfaces, function (intf) { return _this.fixClassPath(intf); });
        // tsInterfaces is used in the extends clause of an interface declaration.
        // Each intf is an interface name is a fully scoped java path, but in typescript
        // these paths are all relative paths under the output module Java.
        // In most cases it is not necessary to include the 'Java.' module in the interface
        // name, but in few cases leaving it out causes naming conflicts, most notably
        // between java.lang and groovy.lang.
        tsInterfaces = _.map(tsInterfaces, function (intf) { return 'Java.' + intf; });
        var variantsDict = this.groupMethods(methods);
        this.mergeOverloadedVariants(variantsDict, interfaces);
        var variants = _.map(variantsDict, function (bySig) {
            return _this.flattenDictionary(bySig).sort(_this.compareVariants);
        });
        var classMap = {
            quotedPkgName: this.packageName(this.fixClassPath(className)),
            packageName: this.packageName(className),
            genericName: genericName,
            annotations: annotations,
            classTypeName: classTypeName,
            fullName: className,
            shortName: shortName,
            typeParms: typeParms,
            alias: alias,
            useAlias: useAlias,
            tsType: this.tsTypeName(className) + this.unconstrainedTypeList(typeParms),
            isInterface: isInterface,
            isPrimitive: isPrimitive,
            superclass: superclass === null ? null : superclass.getName(),
            interfaces: interfaces,
            tsInterfaces: tsInterfaces,
            genericInterfaces: genericInterfaces,
            methods: methods,
            constructors: constructors.sort(this.compareVariants),
            variantsDict: variantsDict,
            variants: variants,
            isEnum: isEnum,
            fields: fields
        };
        return classMap;
    };
    // *inWhiteList()*: Return true for classes of interest.
    // declared public only for unit tests
    ClassesMap.prototype.inWhiteList = function (className) {
        var allowed = this.includedPatterns.find(function (ns) { return className.match(ns) !== null; }) !== undefined;
        if (allowed) {
            var isAnon = /\$\d+$/.test(className);
            if (isAnon) {
                dlog('Filtering out anon class:', className);
                allowed = false;
            }
        }
        return allowed;
    };
    // *shortClassName()*: Return the short class name given the full className (class path).
    // declared public only for unit tests
    ClassesMap.prototype.shortClassName = function (className) {
        return _.last(className.split('.'));
    };
    // *getClass()*: get the Class object for the given full class name.
    // declared public only for unit tests
    ClassesMap.prototype.getClass = function (className) {
        var clazz = this.classCache.get(className);
        if (!clazz) {
            // For historical reasons, we simulate the exception thrown when the Java classloader doesn't find class
            throw new Error('java.lang.ClassNotFoundException:' + className);
        }
        return clazz;
    };
    // *mapClassInterfaces()*: Find the direct interfaces of className.
    // declared public only for unit tests
    ClassesMap.prototype.mapClassInterfaces = function (className, clazz) {
        assert.strictEqual(clazz.getName(), className);
        var interfaces = this.resolveInterfaces(clazz).toArray();
        // Methods of Object must always be available on any instance variable, even variables whose static
        // type is a Java interface. Java does this implicitly. We have to do it explicitly.
        var javaLangObject = 'java.lang.Object';
        if (interfaces.length === 0 && className !== javaLangObject && clazz.getSuperclass() === null) {
            interfaces.push(javaLangObject);
        }
        return interfaces;
    };
    // *fixClassPath()*: given a full class path name, rename any path components that are reserved words.
    // declared public only for unit tests
    ClassesMap.prototype.fixClassPath = function (fullName) {
        var reservedWords = [
            // TODO: include full list of reserved words
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
    // *translateGenericProto()*: given a string that is a Java generic method prototype
    // (as returned by Method.toGenericString()), return a complete Typescript generic method prototype.
    // declared public only for unit tests
    ClassesMap.prototype.translateGenericProto = function (generic_proto) {
        var tmp = generic_proto;
        tmp = tmp.replace('abstract ', '');
        tmp = tmp.replace('default ', '');
        tmp = tmp.replace('final ', '');
        tmp = tmp.replace('native ', '');
        tmp = tmp.replace('public ', '');
        tmp = tmp.replace('static ', ''); // we'll recognize static methods a different way
        tmp = tmp.replace('synchronized ', '');
        tmp = tmp.replace(/ throws .*$/, '');
        // The last character should now be a ')', the close parenthesis of the function's parameter list.
        assert.strictEqual(tmp[tmp.length - 1], ')');
        // The regex below is gnarly. It's designed to capture four fields
        // gentypes: (<[, \w]+>)?          -- optional expression '<...> '
        // returns: (?:(.*) )?             -- Optional function return result (optional because of constructors)
        // methodName: ([\.\$\w]+)         -- requires word string, but may include $ characters
        // params: \((.*)\)                -- The parameter list, identified only by the parentheses
        var parse = tmp.match(/^(<[, \w]+>)?(?:(.*) )?([\.\$\w]+)\((.*)\)$/);
        assert.ok(parse);
        assert.strictEqual(parse.length, 5);
        ddbg(parse);
        var gentypes = parse[1] === undefined ? '' : parse[1];
        var returns = parse[2] || 'void';
        var methodName = parse[3].split('.').slice(-1)[0];
        var params = parse[4];
        // Split at commas, but ignoring commas between < > for generics
        function splitParams(s) {
            // This function is a hack that takes advantage of the fact that Java Reflection
            // returns a prototype string that has no space after the commas we want to split at,
            // but does have a space after commas we want to ignore.
            var result = [];
            while (s.length > 0) {
                var i = s.search(/,[^\s]/);
                if (i === -1) {
                    result.push(s);
                    s = '';
                }
                else {
                    result.push(s.slice(0, i));
                    s = s.slice(i + 1);
                }
            }
            return result;
        }
        var result = {
            methodName: methodName.trim(),
            gentypes: gentypes.trim(),
            returns: returns.trim(),
            params: splitParams(params)
        };
        ddbg('CHECK:', result);
        return result;
    };
    // *resolveInterfaces()*: Find the set of non-excluded interfaces for the given class `clazz`.
    // If an interface of a class is excluded by the configuration, we check the ancestors of that class.
    ClassesMap.prototype.resolveInterfaces = function (clazz) {
        var _this = this;
        var result = Immutable.Set();
        _.forEach(clazz.getInterfaces(), function (intf) {
            var intfName = intf.getName();
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
    // *typeEncoding()*: return the JNI encoding string for a java class
    ClassesMap.prototype.typeEncoding = function (clazz) {
        var name = clazz.getName();
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
        if (clazz.isPrimitive()) {
            encoding = primitives[name];
        }
        else if (clazz.isArray()) {
            encoding = name;
        }
        else {
            encoding = clazz.getCanonicalName();
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
        var name = method.getName();
        var paramTypes = method.getParameterTypes();
        var sigs = paramTypes.map(function (p) { return _this.typeEncoding(p); });
        var signature = name + '(' + sigs.join('') + ')';
        if ('getReturnType' in method) {
            // methodSignature can be called on either a constructor or regular method.
            // constructors don't have return types.
            signature += this.typeEncoding(method.getReturnType());
        }
        return signature;
    };
    // *mapField()*: return a map of useful properties of a field.
    ClassesMap.prototype.mapField = function (field) {
        var name = field.getName();
        var fieldType = field.getType();
        var genericFieldType = field.getGenericType();
        var fieldTypeName = fieldType.getName();
        var declaredIn = field.getDeclaringClass().getName();
        var tsRegularType = this.tsTypeName(fieldTypeName, ParamContext.eReturn, true);
        var tsGenericType = this.translateGenericType(genericFieldType.getTypeName());
        var tsType = this.options.generics ? tsGenericType : tsRegularType;
        var isStatic = this.Modifier.isStatic(field.getModifiers());
        var isSynthetic = field.isSynthetic();
        var fieldDefinition = {
            name: name,
            tsRegularType: tsRegularType,
            tsGenericType: tsGenericType,
            tsType: tsType,
            isStatic: isStatic,
            isSynthetic: isSynthetic,
            declaredIn: declaredIn
        };
        return fieldDefinition;
    };
    // *mapClassFields()*: return a FieldDefinition array for the fields of a class
    ClassesMap.prototype.mapClassFields = function (className, clazz) {
        var _this = this;
        var allFields = clazz.getFields();
        var allFieldDefs = _.map(allFields, function (f) { return _this.mapField(f); });
        // For instance fields, we should keep only the fields declared in this class.
        // We'll have access to inherited fields through normal inheritance.
        // If we kept the inherited fields, it would result in duplicate definitions in the derived classes.
        var instanceFieldDefs = _.filter(allFieldDefs, function (f) {
            return !f.isStatic && f.declaredIn === clazz.getName();
        });
        // For static fields we should keep all inherited fields, since the .Static interface of a class
        // does not extend the .Static interface of its parent(s).
        // But we can't simply keep all static fields, because (apparently) a class can redefine a static
        // field with the same name as an inherited field.
        var staticFieldDefs = _.filter(allFieldDefs, function (f) { return f.isStatic; });
        staticFieldDefs = _.uniq(staticFieldDefs, false, 'name');
        return instanceFieldDefs.concat(staticFieldDefs);
    };
    // *mapClassConstructors()*: return a methodMap array for the constructors of a class
    ClassesMap.prototype.mapClassConstructors = function (className, clazz) {
        return _.map(clazz.getConstructors(), function (m) { return this.mapMethod(m); }, this);
    };
    // *compareVariants()*: Compare two method definitions, which should be two variants with the same method name.
    // We arrange to sort methods from most specific to most generic, as expected by Typescript.
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
    // *interfacesTransitiveClosure()*: return the transitive closure of all inherited interfaces given
    // a set of directly inherited interfaces.
    ClassesMap.prototype.interfacesTransitiveClosure = function (directInterfaces) {
        var _this = this;
        var work = new Work();
        directInterfaces.forEach(function (intf) { return work.addTodo(intf); });
        work.forEach(function (intf) {
            _this.classes[intf].interfaces.forEach(function (parent) { return work.addTodo(parent); });
        });
        return work.getDone().toArray();
    };
    // *interfaceDepth()*: return the 'depth' of a class in the class graph.
    // A class with no inherited interfaces has depth 0. We arrange so that java.lang.Object is the only such class.
    // Every other interface has a depth 1 greater than the maximum depth of any of its direct parent interfaces.
    ClassesMap.prototype.interfaceDepth = function (intf) {
        var _this = this;
        if (this.interfaceDepthCache.has(intf)) {
            return this.interfaceDepthCache.get(intf);
        }
        var parents = this.classes[intf].interfaces;
        var intfDepth = 0;
        if (parents.length > 0) {
            var depths = _.map(parents, function (parent) { return _this.interfaceDepth(parent); });
            intfDepth = _.max(depths) + 1;
        }
        this.interfaceDepthCache = this.interfaceDepthCache.set(intf, intfDepth);
        return intfDepth;
    };
    // *mergeOverloadedVariants()*: Merge into a class's variants dictionary all inherited overloaded variants.
    // The algorithm intentionally overwrites any method definition with the definition from the inherited
    // interface that first declared it. The only sigificant difference between the original declaration and a later override
    // is the generic_proto field, which we render into the output .d.ts file as a comment before the method.
    ClassesMap.prototype.mergeOverloadedVariants = function (variantsDict, directInterfaces) {
        var _this = this;
        var self = this;
        // Get the list of all inherited interfaces, ordered in descending order by interface depth.
        var interfaces = this.interfacesTransitiveClosure(directInterfaces)
            .sort(function (intf1, intf2) {
            return self.interfaceDepth(intf2) - self.interfaceDepth(intf1);
        });
        // for each method name of the class
        _.forEach(variantsDict, function (methodVariants, methodName) {
            // for all inherited interfaces
            _.forEach(interfaces, function (intfName) {
                var intfVariantsDict = _this.classes[intfName].variantsDict;
                // if the inherited interface declares any of the variants of the method
                if (_.has(intfVariantsDict, methodName)) {
                    // merge all of the variants into the class's variants dictionary.
                    _.assign(variantsDict[methodName], intfVariantsDict[methodName]);
                }
            });
        });
    };
    // *packageName()*: given a full class path name, return the package name.
    ClassesMap.prototype.packageName = function (className) {
        var parts = className.split('.');
        parts.pop();
        return parts.join('.');
    };
    // *getWhitedListedClassesInJar()*: For the given jar, read the index, and return an array of all classes
    // from the jar that are selected by the configuration.
    ClassesMap.prototype.getWhitedListedClassesInJar = function (jarpath) {
        var _this = this;
        dlog('getWhitedListedClassesInJar started for:', jarpath);
        var result = [];
        return openAsync(jarpath, 'r')
            .then(function (fd) {
            var reader = zip.Reader(fd);
            reader.forEach(function (entry) {
                if (entry) {
                    var entryPath = entry.getName();
                    if (/\.class$/.test(entryPath)) {
                        var className = entryPath.slice(0, -'.class'.length).replace(/\//g, '.');
                        if (_this.inWhiteList(className)) {
                            result.push(className);
                        }
                        else {
                            _this.allExcludedClasses = _this.allExcludedClasses.add(className);
                        }
                    }
                }
            });
        })
            .then(function () { return result; });
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
    // *isPublicClass()*: Return true if clazz has public visibility.
    ClassesMap.prototype.isPublicClass = function (clazz) {
        var modifiers = clazz.getModifiers();
        var isPublic = this.Modifier.isPublic(modifiers);
        if (isPublic) {
            var enclosingClass = clazz.getEnclosingClass();
            if (enclosingClass) {
                isPublic = this.isPublicClass(enclosingClass);
                if (!isPublic) {
                    dlog('******Pruning class because it is enclosed in nonpublic class:', enclosingClass.getName());
                }
            }
        }
        return isPublic;
    };
    // *loadClassCache()*: Load all classes seen in prescan, pruning any non-public classes.
    ClassesMap.prototype.loadClassCache = function () {
        var _this = this;
        var nonPublic = Immutable.Set();
        var classLoader = Java.getClassLoader();
        this.allClasses.forEach(function (className) {
            var clazz = classLoader.loadClass(className);
            var modifiers = clazz.getModifiers();
            var isPublic = _this.isPublicClass(clazz);
            if (isPublic) {
                _this.classCache = _this.classCache.set(className, clazz);
            }
            else {
                nonPublic = nonPublic.add(className);
                var isPrivate = _this.Modifier.isPrivate(modifiers);
                var isProtected = _this.Modifier.isProtected(modifiers);
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
        this.allExcludedClasses = this.allExcludedClasses.union(nonPublic);
        return;
    };
    // *preScanAllClasses()*: scan all jars in the class path and find all classes matching our filter.
    // The result is stored in the member variable this.allClasses and returned as the function result
    ClassesMap.prototype.preScanAllClasses = function () {
        var _this = this;
        dlog('preScanAllClasses started');
        var options = this.options;
        var result = Immutable.Set();
        var promises = _.map(options.classpath, function (jarpath) { return _this.getWhitedListedClassesInJar(jarpath); });
        return BluePromise.all(promises)
            .each(function (classes) {
            result = result.merge(classes);
        })
            .then(function () {
            _this.allClasses = result;
            dlog('preScanAllClasses completed');
        });
    };
    ClassesMap.prototype.unconstrainedTypeList = function (types) {
        if (!this.options.generics || types.length === 0) {
            return '';
        }
        else {
            return '<' + _.map(types, function () { return 'any'; }).join(', ') + '>';
        }
    };
    return ClassesMap;
})();
exports.ClassesMap = ClassesMap;
var ClassesMap;
(function (ClassesMap) {
    'use strict';
})(ClassesMap = exports.ClassesMap || (exports.ClassesMap = {}));
//# sourceMappingURL=classes-map.js.map