#!/usr/bin/env node
/**
 * lint-ratchet.js - CI gate step: ESLint on changed files only, fail on regressions.
 *
 * Usage:
 *   node scripts/lint-ratchet.js <base-ref>
 *
 * Why: `npm run lint` on this repo has ~488 errors on main, so it cannot be a
 * gate. Instead every .js file changed by the PR is linted twice - once at the
 * merge base and once in the working tree - and the job fails only when a file's
 * error count went up. Pre-existing errors are therefore allowed to stay, but a
 * PR cannot add new ones.
 *
 * Node 18 compatible, no dependencies beyond the repo's devDependencies.
 * Exit codes: 0 = no regression, 1 = regression or the ratchet could not run.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ESLINT_BIN = path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

function git(args, options = {}) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  return result;
}

function run(command, args, options) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}

function listChangedJsFiles(baseRef) {
  const mergeBase = git(["merge-base", baseRef, "HEAD"]);
  if (mergeBase.status !== 0) {
    console.error(`lint-ratchet: cannot resolve merge-base between ${baseRef} and HEAD`);
    console.error(mergeBase.stderr.trim());
    process.exit(1);
  }
  const commit = mergeBase.stdout.trim();

  const diff = git(["diff", "--name-only", "--diff-filter=ACMR", commit, "HEAD", "--", "*.js"]);
  if (diff.status !== 0) {
    console.error("lint-ratchet: git diff failed");
    console.error(diff.stderr.trim());
    process.exit(1);
  }

  const files = diff.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((file) => !file.startsWith("node_modules/"));

  return { commit, files };
}

function lint(treeRoot, files, configPath) {
  const result = run(
    process.execPath,
    [
      ESLINT_BIN,
      "--no-eslintrc",
      "--config",
      configPath,
      "--resolve-plugins-relative-to",
      ROOT,
      "--format",
      "json",
      ...files,
    ],
    { cwd: treeRoot },
  );

  if (result.status !== 0 && !result.stdout) {
    console.error("lint-ratchet: eslint failed to run");
    console.error((result.stderr || "").trim());
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    console.error("lint-ratchet: eslint returned unparsable output");
    console.error((result.stdout || "").slice(0, 2000));
    console.error((result.stderr || "").slice(0, 2000));
    process.exit(1);
  }

  const counts = new Map();
  for (const entry of report) {
    const errors = entry.messages.filter((message) => message.severity === 2);
    counts.set(entry.filePath, {
      errors: entry.errorCount,
      warnings: entry.warningCount,
      rules: errors.reduce((acc, message) => {
        const rule = message.ruleId || "(fatal)";
        acc[rule] = (acc[rule] || 0) + 1;
        return acc;
      }, {}),
    });
  }
  return counts;
}

function relativeTo(treeRoot, filePath) {
  const relative = path.relative(treeRoot, filePath);
  return (relative.startsWith("..") ? filePath : relative).split(path.sep).join("/");
}

function main() {
  const baseRef = process.argv[2];
  if (!baseRef) {
    console.error("usage: node scripts/lint-ratchet.js <base-ref>   (e.g. origin/main)");
    process.exit(1);
  }
  if (!fs.existsSync(ESLINT_BIN)) {
    console.error(`lint-ratchet: ${ESLINT_BIN} is missing - run npm ci first`);
    process.exit(1);
  }

  const { commit, files } = listChangedJsFiles(baseRef);
  if (files.length === 0) {
    console.log(`lint-ratchet: no changed .js files against ${baseRef} (${commit.slice(0, 7)}), nothing to check`);
    return;
  }

  const headCounts = lint(ROOT, files, path.join(ROOT, ".eslintrc"));
  const head = new Map();
  for (const [filePath, counts] of headCounts) head.set(relativeTo(ROOT, filePath), counts);

  // Base side: a throwaway worktree of the merge base so eslint sees the old file.
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "ducky-lint-base-"));
  const add = git(["worktree", "add", "--detach", worktree, commit]);
  if (add.status !== 0) {
    console.error("lint-ratchet: cannot create the base worktree");
    console.error(add.stderr.trim());
    process.exit(1);
  }

  let exitCode = 0;
  try {
    const baseFiles = files.filter((file) => fs.existsSync(path.join(worktree, file)));
    const baseCounts = baseFiles.length > 0 ? lint(worktree, baseFiles, path.join(worktree, ".eslintrc")) : new Map();
    const base = new Map();
    for (const [filePath, counts] of baseCounts) base.set(relativeTo(worktree, filePath), counts);

    const regressions = [];
    const rows = [];
    for (const file of files) {
      const before = base.get(file) || { errors: 0, warnings: 0, rules: {} };
      const after = head.get(file);
      if (!after) {
        regressions.push(`${file}: was not linted at head (eslint skipped or ignored it)`);
        continue;
      }
      rows.push({ file, before: before.errors, after: after.errors, rules: after.rules });
      if (after.errors > before.errors) {
        const delta = after.errors - before.errors;
        const rules = Object.entries(after.rules)
          .map(([rule, count]) => `${rule} x${count}`)
          .join(", ");
        regressions.push(`${file}: ${before.errors} -> ${after.errors} errors (+${delta}) [${rules}]`);
      }
    }

    console.log(`lint-ratchet: ${files.length} changed .js file(s) against ${baseRef} (merge-base ${commit.slice(0, 7)})`);
    for (const row of rows) {
      const marker = row.after > row.before ? "REGRESSION" : "ok";
      console.log(`  ${marker.padEnd(10)} ${row.file} (${row.before} -> ${row.after} errors)`);
    }

    if (regressions.length > 0) {
      console.error(`\nlint-ratchet: ${regressions.length} file(s) got worse`);
      for (const regression of regressions) console.error(`  - ${regression}`);
      exitCode = 1;
    } else {
      console.log("lint-ratchet: no new eslint errors");
    }
  } finally {
    git(["worktree", "remove", "--force", worktree]);
  }

  process.exit(exitCode);
}

main();
