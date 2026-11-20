"use strict";

/**
 * Inert stand-in for the native `canvas` module.
 *
 * The gate installs dependencies with `npm ci --ignore-scripts` (PR code must
 * never run install scripts), so canvas' node-pre-gyp binary is not downloaded
 * and `require("canvas")` would throw. Nothing in the gate draws anything, so a
 * callable stub that answers every property access is enough.
 *
 * Used by:
 *   - scripts/smoke-load.js (via a Module._load hook)
 *   - jest.config.js (moduleNameMapper, for tests/ChatHandler.test.js)
 */

let stub;

stub = new Proxy(function () {}, {
  get(target, property) {
    if (property === "then") return undefined; // never look like a promise
    if (property === Symbol.toPrimitive) return () => "";
    if (property === "toString" || property === "valueOf") return () => "";
    return stub;
  },
  apply() {
    return stub;
  },
  construct() {
    return stub;
  },
});

module.exports = stub;
