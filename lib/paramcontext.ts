'use strict';

// It's not possible to export an enum from a module that uses `export = ModuleName;`
// If it were, this enum would be declared in classes-map.ts
// The only reason we need this enum to be public is so we can use it in unit tests.

// The context of a parameter, either an input to a function, or a return result.
enum ParamContext {eInput, eReturn};

export = ParamContext;
