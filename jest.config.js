"use strict";

/**
 * Jest picks this file up automatically; everything not listed here keeps the
 * Jest defaults.
 *
 * The gate installs with `npm ci --ignore-scripts` (a PR must not be able to run
 * install scripts), so the native `canvas` binding is absent and
 * src/minecraft/handlers/ChatHandler.js - imported by tests/ChatHandler.test.js
 * - would fail to load. The tests never draw, so the module is mapped to an
 * inert stub.
 */
module.exports = {
  moduleNameMapper: {
    "^canvas$": "<rootDir>/scripts/stubs/canvas.js",
  },
};
