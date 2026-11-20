#!/usr/bin/env node
/**
 * smoke-load.js - CI gate step: load every command module the bots load at boot.
 *
 * For src/minecraft/commands (classes instantiated with `minecraft`),
 * src/discord/commands (plain objects registered as slash commands) and
 * src/discord/oldcommands (classes instantiated with `discord`) this script
 * require()s the file, applies the shape the real loaders expect and prints one
 * line per file.
 *
 * Sockets and timers are stubbed before any module is loaded: requiring a
 * command must never dial out, and some libraries (skyhelper-networth) keep a
 * refresh timer alive forever, so the process always ends with process.exit().
 *
 * Node 18 compatible. No dependencies beyond the repo's own.
 * Exit codes: 0 = every module loaded and had the expected shape, 1 = failures.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "config.json");

const COMMAND_DIRS = [
  { dir: "src/minecraft/commands", kind: "minecraft" },
  { dir: "src/discord/commands", kind: "slash" },
  { dir: "src/discord/oldcommands", kind: "discord" },
];

const activity = { sockets: 0, requests: 0, timers: 0 };

// ---------------------------------------------------------------------------
// 1. Neutralise outbound I/O and timers before anything is required.
// ---------------------------------------------------------------------------

function fakeTimer() {
  return {
    ref() {
      return this;
    },
    unref() {
      return this;
    },
    hasRef() {
      return false;
    },
    refresh() {
      return this;
    },
    close() {
      return this;
    },
  };
}

function fakeSocket() {
  const socket = new EventEmitter();
  socket.write = () => true;
  socket.end = () => socket;
  socket.destroy = () => socket;
  socket.setTimeout = () => socket;
  socket.setNoDelay = () => socket;
  socket.setKeepAlive = () => socket;
  socket.connect = () => socket;
  socket.remoteAddress = "127.0.0.1";
  return socket;
}

function fakeRequest() {
  const request = new EventEmitter();
  request.write = () => true;
  request.end = () => request;
  request.abort = () => {};
  request.destroy = () => {};
  request.setTimeout = () => request;
  request.setHeader = () => request;
  request.getHeader = () => undefined;
  request.removeHeader = () => request;
  request.setNoDelay = () => request;
  request.setSocketKeepAlive = () => request;
  return request;
}

global.setInterval = function () {
  activity.timers++;
  return fakeTimer();
};
global.setTimeout = function () {
  activity.timers++;
  return fakeTimer();
};
global.setImmediate = function () {
  activity.timers++;
  return fakeTimer();
};

const net = require("net");
net.connect = function () {
  activity.sockets++;
  return fakeSocket();
};
net.createConnection = net.connect;
net.Socket.prototype.connect = function () {
  activity.sockets++;
  return this;
};

const http = require("http");
http.request = function () {
  activity.requests++;
  return fakeRequest();
};
http.get = http.request;

const https = require("https");
https.request = function () {
  activity.requests++;
  return fakeRequest();
};
https.get = https.request;

const tls = require("tls");
tls.connect = function () {
  activity.sockets++;
  return fakeSocket();
};

// Globals the command modules and the shared base classes expect to exist at
// runtime (they are declared in .eslintrc as globals and set by the managers).
global.bot = { chat() {}, _client: { chat() {} }, player: null, entity: null, username: "smoke-test" };
global.client = { user: { id: "0", tag: "smoke#0000" }, channels: { cache: new Map() }, guilds: { cache: new Map() } };
global.guild = { name: "smoke-test", id: "0" };
global.imgurUrl = "";

// ---------------------------------------------------------------------------
// 2. Shape checks - mirrors what the loaders actually do.
// ---------------------------------------------------------------------------

const stubMinecraft = {};
const stubDiscord = {};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkMinecraftCommand(moduleExport) {
  if (typeof moduleExport !== "function") {
    throw new Error("expected a class (module.exports = class ...)");
  }
  const instance = new moduleExport(stubMinecraft);
  if (!isNonEmptyString(instance.name)) throw new Error("instance.name is not a non-empty string");
  if (!isNonEmptyString(instance.description)) throw new Error("instance.description is not a non-empty string");
  if (typeof instance.onCommand !== "function") throw new Error("instance.onCommand is not a function");
  return instance.name;
}

function checkSlashCommand(moduleExport) {
  if (moduleExport === null || typeof moduleExport !== "object" || Array.isArray(moduleExport)) {
    throw new Error("expected a plain object (module.exports = { name, description, execute })");
  }
  if (!isNonEmptyString(moduleExport.name)) throw new Error("name is not a non-empty string");
  if (!isNonEmptyString(moduleExport.description)) throw new Error("description is not a non-empty string");
  if (typeof moduleExport.execute !== "function") throw new Error("execute is not a function");
  return moduleExport.name;
}

function checkDiscordCommand(moduleExport) {
  if (typeof moduleExport !== "function") {
    throw new Error("expected a class (module.exports = class ...)");
  }
  const instance = new moduleExport(stubDiscord);
  if (!isNonEmptyString(instance.name)) throw new Error("instance.name is not a non-empty string");
  if (!isNonEmptyString(instance.description)) throw new Error("instance.description is not a non-empty string");
  if (typeof instance.onCommand !== "function") throw new Error("instance.onCommand is not a function");
  if (!["all", "commander", "mod"].includes(instance.permission)) {
    throw new Error(`instance.permission is ${JSON.stringify(instance.permission)}, expected "all" | "commander" | "mod"`);
  }
  return instance.name;
}

const CHECKS = {
  minecraft: checkMinecraftCommand,
  slash: checkSlashCommand,
  discord: checkDiscordCommand,
};

// ---------------------------------------------------------------------------
// 3. Walk the command directories.
// ---------------------------------------------------------------------------

function listCommandFiles(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  return fs
    .readdirSync(absoluteDir)
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => path.join(absoluteDir, file));
}

function loadOne(file) {
  const before = { ...activity };
  const moduleExport = require(file);
  const used = {
    sockets: activity.sockets - before.sockets,
    requests: activity.requests - before.requests,
    timers: activity.timers - before.timers,
  };
  return { moduleExport, used };
}

function describeActivity(used) {
  const parts = [];
  if (used.sockets > 0) parts.push(`${used.sockets} socket(s)`);
  if (used.requests > 0) parts.push(`${used.requests} http request(s)`);
  if (used.timers > 0) parts.push(`${used.timers} timer(s)`);
  return parts.length > 0 ? `blocked ${parts.join(", ")}` : "";
}

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`FAIL  ${CONFIG_PATH} is missing.`);
    console.error("      the gate runs: cp config.example.json config.json");
    process.exit(1);
  }

  const failures = [];
  let checked = 0;
  let blockedActivity = 0;

  for (const { dir, kind } of COMMAND_DIRS) {
    const files = listCommandFiles(dir);
    if (files.length === 0) {
      failures.push(`${dir}: no .js command files found`);
      continue;
    }

    console.log(`\n${dir} (${files.length} files)`);
    for (const file of files) {
      const relative = path.relative(ROOT, file);
      try {
        const { moduleExport, used } = loadOne(file);
        const name = CHECKS[kind](moduleExport);
        const extra = describeActivity(used);
        if (extra) blockedActivity++;
        checked++;
        console.log(`  ok    ${relative} -> "${name}"${extra ? ` (${extra})` : ""}`);
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        failures.push(`${relative}: ${message}`);
        console.log(`  FAIL  ${relative}: ${message}`);
      }
    }
  }

  console.log("");
  if (failures.length > 0) {
    console.error(`smoke-load: ${failures.length} failure(s), ${checked} module(s) loaded ok`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`smoke-load: ${checked} module(s) loaded ok, 0 failures`);
  if (blockedActivity > 0) {
    console.log(`smoke-load: ${blockedActivity} module(s) tried to use sockets/timers at load time; they were stubbed out`);
  }
  // skyhelper-networth and friends keep timers alive: exit explicitly.
  process.exit(0);
}

main();
