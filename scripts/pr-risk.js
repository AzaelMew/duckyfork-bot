#!/usr/bin/env node
/**
 * pr-risk.js - CI gate step: classify a pull request as low or high risk.
 *
 * Usage:
 *   node scripts/pr-risk.js <base-ref> > risk.json
 *
 * Prints one JSON object:
 *   { risk, reasons[], touched[], depMajorChanges[], exportChanges[], callers{},
 *     size{files,lines}, newHosts[], extraSends[] }
 *
 * The workflow records this (job summary + artifact), it never fails on a high
 * risk result: high risk means "a human must look at this", not "reject".
 * Exit code is always 0, even when the analysis itself breaks (the JSON then
 * says risk=high and a reason explains why).
 *
 * Node 18 compatible, no dependencies beyond git and the repo itself.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// Loading changed modules must not need the native canvas binding: the gate
// installs with --ignore-scripts (same stub as scripts/smoke-load.js).
const canvasStub = require("./stubs/canvas.js");
const originalLoad = Module._load;
Module._load = function (request) {
  if (request === "canvas") return canvasStub;
  return originalLoad.apply(this, arguments);
};

// Files where a mistake can take a live bot down or leak a token.
const HIGH_RISK_PATHS = [
  /^src\/contracts\/minecraftCommand\.js$/,
  /^src\/express\//,
  /^src\/discord\/(DiscordManager|CommandHandler)\.js$/,
  /^src\/minecraft\/(MinecraftManager|CommandHandler)\.js$/,
  /^src\/minecraft\/handlers\/ChatHandler\.js$/,
  /^src\/contracts\/bridge\.js$/,
  /^config.*\.json$/,
  /^package(-lock)?\.json$/,
  /^\.github\//,
  /^scripts\//,
  /^index\.js$/,
  /^src\/Application\.js$/,
  /(^|\/)Dockerfile$/,
  /^src\/contracts\/Imgur\//,
];

// Files whose added URLs are dependency noise rather than outbound endpoints.
const URL_NOISE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|package\.json)$/;

// Directories whose exported names other code relies on.
const EXPORT_WATCHED = [/^src\/contracts\//, /^API\//, /^src\/minecraft\/commands\//];

const COMMAND_FILE = /^src\/(minecraft\/commands|discord\/oldcommands)\//;

const SEND_CALL = /\bthis\.(send|eventSend|warpSend|sendMinecraftMessage|sendPromoteMessage)\s*\(/;

const MAX_FILES = 12;
const MAX_LINES = 400;

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function gitOut(args) {
  const result = git(args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || `exit ${result.status}`}`);
  }
  return result.stdout;
}

function majorOf(range) {
  const match = String(range || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDiff(commit, baseRef) {
  const output = gitOut(["diff", "-U0", "--no-color", commit, "HEAD", "--", "."]);
  const touched = [];
  const addedByFile = new Map();
  let current = null;

  for (const line of output.split("\n")) {
    if (line.startsWith("+++ b/")) {
      current = line.slice(6);
      touched.push(current);
      if (!addedByFile.has(current)) addedByFile.set(current, []);
      continue;
    }
    if (line.startsWith("+++ ")) {
      current = null; // deleted file, /dev/null
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++") && current) {
      addedByFile.get(current).push(line.slice(1));
    }
  }

  // Also record deletions/renames, which the -U0 patch headers do not show.
  const nameStatus = gitOut(["diff", "--name-status", commit, "HEAD", "--", "."]);
  const entries = nameStatus
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return { status: parts[0].charAt(0), path: parts[parts.length - 1] };
    });

  return { touched: [...new Set([...touched, ...entries.map((entry) => entry.path)])], entries, addedByFile, baseRef };
}

function analyzeDependencies(commit, result, addReason) {
  const basePackage = (() => {
    const show = git(["show", `${commit}:package.json`]);
    if (show.status !== 0) return {};
    try {
      return JSON.parse(show.stdout);
    } catch (error) {
      return {};
    }
  })();

  const headPackage = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

  const collect = (pkg) => ({
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  });

  const baseDeps = collect(basePackage);
  const headDeps = collect(headPackage);
  const changes = [];

  for (const name of Object.keys(headDeps).sort()) {
    const before = baseDeps[name];
    const after = headDeps[name];
    if (before === undefined) {
      changes.push({ name, change: "added", from: null, to: after });
      continue;
    }
    if (before === after) continue;
    const beforeMajor = majorOf(before);
    const afterMajor = majorOf(after);
    if (beforeMajor !== null && afterMajor !== null && beforeMajor !== afterMajor) {
      changes.push({ name, change: "major", from: before, to: after });
    }
  }

  result.depMajorChanges = changes;

  for (const change of changes) {
    const label = change.change === "major" ? `major dependency bump: ${change.name} ${change.from} -> ${change.to}` : `new dependency: ${change.name}@${change.to}`;
    addReason(label);

    const namePattern = escapeRegExp(change.name);
    const grep = git(["grep", "-nE", `require\\((['"])${namePattern}\\1\\)`, "HEAD", "--", "src", "API", "index.js", "scripts"]);
    const callers =
      grep.status === 0
        ? grep.stdout
            .split("\n")
            .filter(Boolean)
            .map((line) => line.replace(/^HEAD:/, ""))
        : [];
    result.callers[`pkg:${change.name}`] = callers;
  }
}

function exportNames(source) {
  const names = new Set();

  for (const match of source.matchAll(/^\s*module\.exports\.([A-Za-z_$][\w$]*)\s*=/gm)) names.add(match[1]);
  for (const match of source.matchAll(/^\s*exports\.([A-Za-z_$][\w$]*)\s*=/gm)) names.add(match[1]);
  for (const match of source.matchAll(/^\s*module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*$/gm)) names.add(match[1]);
  for (const match of source.matchAll(/^\s*module\.exports\s*=\s*(?:new\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) names.add(match[1]);

  // module.exports = { a, b: ..., c() {} }
  const object = source.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\}\s*;?/);
  if (object) {
    for (const match of object[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?::|\(|,|$)/gm)) names.add(match[1]);
  }

  return [...names].sort();
}

// The loaders use the value, not the source: src/minecraft/CommandHandler.js
// does `new (require(file))(minecraft)` (so name/description/onCommand matter)
// and src/discord/CommandHandler.js registers the exported object as a slash
// command (name/description/execute). Requiring the module is therefore the
// honest check - for a class, Object.keys() is empty, so the prototype methods
// are what actually has to stay stable.
function exportShape(file) {
  const exported = require(file);
  const names = new Set();
  const collectKeys = (value) => {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return;
    for (const key of Object.keys(value)) names.add(key);
  };

  collectKeys(exported);
  if (typeof exported === "function" && exported.prototype) {
    for (const key of Object.getOwnPropertyNames(exported.prototype)) {
      if (key !== "constructor") names.add(`prototype.${key}`);
    }
  }
  if (names.size === 0) names.add("(default)");
  return [...names].sort();
}

function exportShapeOrSource(file, source) {
  try {
    return { names: exportShape(file), how: "require" };
  } catch (error) {
    // Loading can legitimately fail (native deps, top-level throws); fall back
    // to the static scan so the check still says something useful.
    return { names: exportNames(source), how: `static (${error.message.split("\n")[0]})` };
  }
}

function analyzeExports(commit, result, addReason) {
  const watched = result.touched.filter((file) => EXPORT_WATCHED.some((pattern) => pattern.test(file)));
  if (watched.length === 0) return;

  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "ducky-risk-base-"));
  const added = git(["worktree", "add", "--detach", worktree, commit]);
  if (added.status !== 0) {
    addReason(`export check skipped: cannot create a base worktree (${added.stderr.trim()})`);
    return;
  }

  try {
    // Same reason as in lint-ratchet.js: the copied config and the symlinked
    // node_modules are needed for the modules to load at all.
    const baseConfig = path.join(worktree, "config.json");
    if (!fs.existsSync(baseConfig)) {
      fs.copyFileSync(path.join(ROOT, "config.example.json"), baseConfig);
    }
    const baseModules = path.join(worktree, "node_modules");
    if (!fs.existsSync(baseModules)) {
      fs.symlinkSync(path.join(ROOT, "node_modules"), baseModules, "dir");
    }

    for (const file of watched) {
      const headPath = path.join(ROOT, file);
      const basePath = path.join(worktree, file);
      if (!fs.existsSync(headPath)) continue; // deleted at head, nothing to compare

      const baseSource = fs.existsSync(basePath) ? fs.readFileSync(basePath, "utf8") : "";
      const headSource = fs.readFileSync(headPath, "utf8");

      let before = exportShapeOrSource(basePath, baseSource);
      let after = exportShapeOrSource(headPath, headSource);
      // Never compare a required module against a statically parsed one: the
      // static scan cannot see prototype methods, so the diff would be noise.
      // If either side failed to load, parse both sides the same way.
      if (before.how !== "require" || after.how !== "require") {
        before = { names: exportNames(baseSource), how: "static" };
        after = { names: exportNames(headSource), how: "static" };
      }

      const addedNames = [...after.names].filter((name) => !before.names.includes(name)).sort();
      const removedNames = [...before.names].filter((name) => !after.names.includes(name)).sort();
      if (addedNames.length === 0 && removedNames.length === 0) continue;

      result.exportChanges.push({ file, added: addedNames, removed: removedNames, how: after.how });
      addReason(`export change in ${file}${removedNames.length ? ` (removed: ${removedNames.join(", ")})` : ""}${addedNames.length ? ` (added: ${addedNames.join(", ")})` : ""}`);

      const modulePath = file.replace(/\.js$/, "");
      const baseName = path.basename(modulePath);
      const grep = git(["grep", "-nE", `require\\((['"])[^'"]*${escapeRegExp(baseName)}(\\.js)?\\1\\)`, "HEAD"]);
      const importers =
        grep.status === 0
          ? grep.stdout
              .split("\n")
              .filter(Boolean)
              .map((line) => line.replace(/^HEAD:/, ""))
              .filter((line) => !line.startsWith("scripts/"))
          : [];
      result.callers[`importers:${file}`] = importers;
    }
  } finally {
    git(["worktree", "remove", "--force", worktree]);
  }
}

function analyzeSize(commit, result, addReason) {
  const numstat = gitOut(["diff", "--numstat", commit, "HEAD", "--", "."]);
  let files = 0;
  let lines = 0;
  for (const line of numstat.split("\n")) {
    if (!line.trim()) continue;
    files++;
    const [added, deleted] = line.split("\t");
    if (added !== "-") lines += Number(added) || 0;
    if (deleted !== "-") lines += Number(deleted) || 0;
  }
  result.size = { files, lines };
  if (files > MAX_FILES || lines > MAX_LINES) {
    addReason(`large diff: ${files} files, ${lines} changed lines (limit ${MAX_FILES} files / ${MAX_LINES} lines)`);
  }
}

function analyzeHosts(commit, parsed, result, addReason) {
  const hosts = new Map();
  for (const [file, addedLines] of parsed.addedByFile) {
    if (URL_NOISE.test(file)) continue;
    for (const line of addedLines) {
      for (const match of line.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        const host = match[1].toLowerCase();
        if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") continue;
        if (!hosts.has(host)) hosts.set(host, []);
        hosts.get(host).push(file);
      }
    }
  }

  for (const [host, files] of hosts) {
    // "new" = the host string does not exist anywhere in the base tree.
    const inBase = git(["grep", "-qF", host, commit, "--", "src", "API", "index.js", "scripts", ".github"]).status === 0;
    if (inBase) continue;
    result.newHosts.push({ host, files: [...new Set(files)] });
    addReason(`new outbound host: ${host} (${[...new Set(files)].join(", ")})`);
  }
}

function analyzeSends(parsed, result, addReason) {
  for (const [file, addedLines] of parsed.addedByFile) {
    if (!COMMAND_FILE.test(file)) continue;

    const addedCalls = addedLines.filter((line) => SEND_CALL.test(line));
    const headPath = path.join(ROOT, file);
    const headSource = fs.existsSync(headPath) ? fs.readFileSync(headPath, "utf8") : "";
    const totalCalls = headSource.split("\n").filter((line) => SEND_CALL.test(line)).length;

    const sends = {
      file,
      addedSendCalls: addedCalls.length,
      totalSendCalls: totalCalls,
      notes: [],
    };

    if (addedCalls.length > 1) {
      sends.notes.push("more than one added send call (every send is mirrored to the peer guild)");
      addReason(`extra send calls in ${file}: ${addedCalls.length} added in one command`);
    }

    // A multi-line guild message is rate limited by the server unless the
    // command throttles it (see the duckyfork-bot-ops pitfall).
    const multiLine = addedCalls.filter((line) => /^(?:.*this\.(?:send|eventSend|warpSend)\s*\(\s*`[^`]*\\n)/.test(line));
    if (multiLine.length > 0) {
      sends.notes.push("multi-line send without a throttle");
      addReason(`multi-line send in ${file}: mirrors several lines to the peer guild at once`);
    }

    const errorInterpolation = addedCalls.filter((line) => /\.message\b/.test(line));
    if (errorInterpolation.length > 0) {
      sends.notes.push("upstream error.message interpolated into a send");
      addReason(`upstream error text sent to chat in ${file}`);
    }

    if (sends.addedSendCalls > 0 || sends.notes.length > 0) result.extraSends.push(sends);
  }
}

function main() {
  const baseRef = process.argv[2] || "origin/main";
  const result = {
    risk: "low",
    reasons: [],
    touched: [],
    depMajorChanges: [],
    exportChanges: [],
    callers: {},
    size: { files: 0, lines: 0 },
    newHosts: [],
    extraSends: [],
  };

  const reasons = new Set();
  const addReason = (reason) => reasons.add(reason);

  try {
    const mergeBase = git(["merge-base", baseRef, "HEAD"]);
    if (mergeBase.status !== 0) throw new Error(`cannot resolve merge-base of ${baseRef} and HEAD: ${mergeBase.stderr.trim()}`);
    const commit = mergeBase.stdout.trim();
    result.base = { ref: baseRef, mergeBase: commit };

    const parsed = parseDiff(commit, baseRef);
    result.touched = [...new Set(parsed.touched)];

    for (const file of result.touched) {
      if (HIGH_RISK_PATHS.some((pattern) => pattern.test(file))) {
        addReason(`high-risk path: ${file}`);
      }
    }

    analyzeSize(commit, result, addReason);
    analyzeDependencies(commit, result, addReason);
    analyzeExports(commit, result, addReason);
    analyzeHosts(commit, parsed, result, addReason);
    analyzeSends(parsed, result, addReason);
  } catch (error) {
    addReason(`pr-risk failed: ${error.message}`);
  }

  result.reasons = [...reasons];
  result.risk = result.reasons.length > 0 ? "high" : "low";

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main();
