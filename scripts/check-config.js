#!/usr/bin/env node
/**
 * check-config.js - structural check of a config.json against config.example.json.
 *
 * Usage:
 *   node scripts/check-config.js [path/to/config.json]
 *
 * Every key that exists in config.example.json must exist in the checked file
 * with the same JSON type (object / array / string / number / boolean). Extra
 * keys are reported as warnings but never fail: the example file lags behind
 * real deployments.
 *
 * The script never prints values (only key paths and types), never touches the
 * network and never writes a file. Exit codes: 0 = ok, 1 = invalid or unreadable.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "config.example.json");

function readJson(file, label) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    console.error(`FAIL  ${label}: cannot read ${file} (${error.code || error.message})`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`FAIL  ${label}: ${file} is not valid JSON (${error.message})`);
    process.exit(1);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function displayPath(target) {
  const relative = path.relative(REPO_ROOT, target);
  return relative.startsWith("..") ? target : relative;
}

function describe(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (isPlainObject(value)) return "object";
  return typeof value;
}

const problems = [];
const warnings = [];

function checkNode(schema, actual, keyPath, hasKey) {
  if (!hasKey) {
    problems.push(`${keyPath}: missing (example has ${describe(schema)})`);
    return;
  }

  if (isPlainObject(schema)) {
    if (!isPlainObject(actual)) {
      problems.push(`${keyPath}: expected object, got ${describe(actual)}`);
      return;
    }
    for (const key of Object.keys(schema)) {
      checkNode(schema[key], actual[key], keyPath ? `${keyPath}.${key}` : key, Object.prototype.hasOwnProperty.call(actual, key));
    }
    return;
  }

  if (Array.isArray(schema)) {
    if (!Array.isArray(actual)) {
      problems.push(`${keyPath}: expected array, got ${describe(actual)}`);
      return;
    }
    // The example uses empty arrays, so element types are only checked if the
    // example provides a sample element.
    if (schema.length > 0) {
      const sample = schema[0];
      for (let i = 0; i < actual.length; i++) {
        if (describe(actual[i]) !== describe(sample) && !(typeof actual[i] === typeof sample)) {
          problems.push(`${keyPath}[${i}]: expected ${describe(sample)}, got ${describe(actual[i])}`);
        }
      }
    }
    return;
  }

  const expected = describe(schema);
  const found = describe(actual);
  if (expected !== found) {
    problems.push(`${keyPath}: expected ${expected}, got ${found}`);
  }
}

function collectExtraKeys(schema, actual, keyPath) {
  if (!isPlainObject(schema) || !isPlainObject(actual)) return;
  for (const key of Object.keys(actual)) {
    const childPath = keyPath ? `${keyPath}.${key}` : key;
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      warnings.push(`${childPath}: not in config.example.json`);
      continue;
    }
    collectExtraKeys(schema[key], actual[key], childPath);
  }
}

function main() {
  const target = path.resolve(process.argv[2] || path.join(REPO_ROOT, "config.json"));

  if (!fs.existsSync(target)) {
    console.error(`FAIL  config file not found: ${target}`);
    console.error("      copy config.example.json to config.json first");
    process.exit(1);
  }

  const schema = readJson(SCHEMA_PATH, "schema");
  const config = readJson(target, "config");

  checkNode(schema, config, "", true);
  collectExtraKeys(schema, config, "");

  if (warnings.length > 0) {
    for (const warning of warnings) console.warn(`warn  ${warning}`);
  }

  if (problems.length > 0) {
    console.error(`\nFAIL  ${problems.length} problem(s) in ${displayPath(target)}:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`OK    ${displayPath(target)} matches config.example.json (${warnings.length} warning(s))`);
}

main();
