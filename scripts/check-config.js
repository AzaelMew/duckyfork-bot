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
  // discord.commands.enabled is either "*" (a string) or a list of names; the
  // example can only show one of the two shapes, so both are accepted here and
  // checkRequiredKeys() validates the contents.
  if (keyPath === "discord.commands.enabled" && (typeof actual === "string" || Array.isArray(actual))) {
    return;
  }
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

// ---------------------------------------------------------------------------
// Required keys for the unified (Sky + Aria) codebase. The generic schema walk
// above already reports them when they are absent from config.example.json, but
// these carry the hint a deployment needs (what to put there and where it comes
// from). Only key paths - never values - are printed.
// ---------------------------------------------------------------------------

const REQUIRED_KEYS = [
  ["bridge.name", "string", "this bot's own name, e.g. the guild-bridge name shown to players"],
  ["bridge.peerUrl", "string", "http://host:port of the other bot, no trailing path"],
  ["bridge.peerGuild", "string", "guild name sent in the /api/message body"],
  ["bridge.mirrorOnSend", "boolean", "whether MinecraftManager.send mirrors to the peer"],
  ["bridge.relayBangCommands", "boolean", "whether ! commands from the peer are executed"],
  ["bridge.peerRank.rank", "string", "rank shown for peer-bot messages"],
  ["bridge.peerRank.guildRank", "string", "guild rank shown for peer-bot messages"],
  ["web.token", "string", "shared secret for the bridge HTTP endpoints"],
  ["paths.blacklist", "string", "path of blacklist.txt (absolute, or relative to the bot working directory)"],
  ["features.retryOnRateLimit", "boolean", "retry a guild line when Hypixel rate-limits it"],
  ["features.imageCompression", "boolean", "compress Discord images with sharp before upload"],
  ["features.peerDiscordRelay", "boolean", "post peer-bot messages into this bot's Discord channels"],
];

const PLACEHOLDERS = {
  "bridge.name": ["BOT_NAME"],
  "bridge.peerUrl": ["PEER_HOST"],
  "bridge.peerGuild": ["peer"],
  "bridge.peerRank.rank": ["PEER_RANK"],
  "bridge.peerRank.guildRank": ["PEER_GUILD_RANK"],
};

function readPath(object, keyPath) {
  let current = object;
  for (const part of keyPath.split(".")) {
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function checkRequiredKeys(config) {
  for (const [keyPath, type, hint] of REQUIRED_KEYS) {
    const { found, value } = readPath(config, keyPath);

    if (!found || value === null || value === undefined) {
      problems.push(`${keyPath}: missing - ${hint} (run scripts/migrate-config.js to add it)`);
      continue;
    }

    if (typeof value !== type) {
      problems.push(`${keyPath}: expected ${type}, got ${describe(value)} - ${hint}`);
      continue;
    }

    if (type === "string" && value.trim().length === 0) {
      problems.push(`${keyPath}: is empty - ${hint}`);
      continue;
    }

    for (const placeholder of PLACEHOLDERS[keyPath] || []) {
      if (value.includes(placeholder)) {
        warnings.push(`${keyPath}: still the config.example.json placeholder - set the real value with scripts/migrate-config.js`);
      }
    }
  }

  const enabled = readPath(config, "discord.commands.enabled");
  if (!enabled.found) {
    problems.push('discord.commands.enabled: missing - "*" for every command, or the list of command names to load');
  } else if (enabled.value !== "*") {
    if (!Array.isArray(enabled.value)) {
      problems.push('discord.commands.enabled: expected "*" or an array of command names, got ' + describe(enabled.value));
    } else if (enabled.value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
      problems.push("discord.commands.enabled: every entry must be a non-empty string");
    }
  }

  const peerUrl = readPath(config, "bridge.peerUrl");
  if (peerUrl.found && typeof peerUrl.value === "string" && peerUrl.value.trim().length > 0) {
    let parsed;
    try {
      parsed = new URL(peerUrl.value);
    } catch (error) {
      problems.push("bridge.peerUrl: not an absolute URL (expected http://host:port)");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      problems.push("bridge.peerUrl: must use http:// or https://");
    }
  }
}

// The generic schema walk and the required-key pass can report the same path.
// Keep the later (more specific) message at the position of the first one.
function dedupeProblems() {
  const indexByKey = new Map();
  const unique = [];

  for (const problem of problems) {
    const key = problem.split(": ")[0];
    if (indexByKey.has(key)) {
      unique[indexByKey.get(key)] = problem;
    } else {
      indexByKey.set(key, unique.length);
      unique.push(problem);
    }
  }

  problems.length = 0;
  problems.push(...unique);
}

function checkConfigFile(target) {
  problems.length = 0;
  warnings.length = 0;

  const schema = readJson(SCHEMA_PATH, "schema");
  const config = readJson(target, "config");

  checkNode(schema, config, "", true);
  collectExtraKeys(schema, config, "");
  checkRequiredKeys(config);
  dedupeProblems();

  return { target, problems: problems.slice(), warnings: warnings.slice() };
}

function main() {
  const target = path.resolve(process.argv[2] || path.join(REPO_ROOT, "config.json"));

  if (!fs.existsSync(target)) {
    console.error(`FAIL  config file not found: ${target}`);
    console.error("      copy config.example.json to config.json first");
    process.exit(1);
  }

  const result = checkConfigFile(target);

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) console.warn(`warn  ${warning}`);
  }

  if (result.problems.length > 0) {
    console.error(`\nFAIL  ${result.problems.length} problem(s) in ${displayPath(target)}:`);
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`OK    ${displayPath(target)} matches config.example.json (${result.warnings.length} warning(s))`);
}

if (require.main === module) {
  main();
}

module.exports = { checkConfigFile };
