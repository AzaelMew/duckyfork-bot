#!/usr/bin/env node
/**
 * migrate-config.js - add the unified (Sky + Aria) config keys to a host
 * config.json without touching anything that is already there.
 *
 * The bot's real config.json on a host contains Discord tokens, the Hypixel API
 * key and the bridge token. This script exists so nobody has to open that file
 * by hand: it copies it, adds the keys the unified codebase needs
 * (bridge.*, features.*, paths.blacklist, discord.commands.enabled) and leaves
 * every existing value exactly as it was.
 *
 * Usage:
 *   node scripts/migrate-config.js --in config.json --out config.json.new \
 *     --name Sky --peer-url http://PEER_HOST:3001 --peer-guild aria \
 *     [--mirror-on-send true|false] [--relay-bang true|false] \
 *     [--blacklist-path /path/to/blacklist.txt] \
 *     [--commands-enabled "*"|autoclaim,autokick,...] \
 *     [--image-compression true|false] [--retry-on-rate-limit true|false] \
 *     [--peer-rank-rank VIP+] [--peer-rank-guild-rank Elder] \
 *     [--stats-proxy-url http://STATS_PROXY_HOST:3000] \
 *     [--secrets-file /path/to/secrets.json] \
 *     [--guild-file /path/to/guild.json] [--guild-data-path <path>] \
 *     [--help-image <path>] [--force]
 *
 * --guild-file is a JSON file holding the whole `guild` section (guild name,
 * Discord keyword, rank ladder, kick-exempt players, schedules; see
 * docs/config.md). It replaces a missing `guild` section, or one whose name
 * is still the GUILD_NAME placeholder; an existing real section is kept unless
 * --force is given.
 *
 * --secrets-file is a JSON object that maps dotted config key paths to values:
 *   {"minecraft.API.waifuItKey": "...", "minecraft.API.statsProxyKey": "..."}
 * It exists so a key value never has to appear in argv or shell history. The
 * file is only read; values from it are never printed, echoed or logged. A key
 * that still holds a config.example.json placeholder is replaced by the
 * supplied value even without --force; an existing real value is kept.
 *
 * Behaviour:
 *   - --in is never written to; --out must be a different file.
 *   - A key that already exists keeps its value ("kept") unless --force is
 *     given ("set") or the value is still the example placeholder.
 *   - Missing keys are added from the arguments, the secrets file or, when
 *     neither supplies them, from config.example.json.
 *   - Only key paths are printed. Values - supplied or existing - never are.
 *   - The result is validated with scripts/check-config.js before it is
 *     reported as usable.
 *
 * Exit codes: 0 = writable config produced, 1 = refused or invalid.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { checkConfigFile } = require("./check-config.js");

const ROOT = path.resolve(__dirname, "..");
const EXAMPLE_PATH = path.join(ROOT, "config.example.json");

const USAGE = `Usage:
  node scripts/migrate-config.js --in <config.json> --out <config.json.new> \\
    --name <Sky|Aria> --peer-url <http://host:port> --peer-guild <name> \\
    [--mirror-on-send true|false] [--relay-bang true|false] \\
    [--blacklist-path <path>] [--commands-enabled "*"|name,name] \\
    [--image-compression true|false] [--retry-on-rate-limit true|false] \\
    [--peer-discord-relay true|false] \\
    [--peer-rank-rank <rank>] [--peer-rank-guild-rank <guildRank>] \\
    [--stats-proxy-url <http://host:port>] [--secrets-file <path.json>] \\
    [--guild-file <guild.json>] [--guild-data-path <path>] [--help-image <path>] [--force]

--secrets-file takes a JSON object of dotted key paths to values, so API keys
never appear in argv or shell history:
  {"minecraft.API.waifuItKey": "...", "minecraft.API.statsProxyKey": "..."}

Prints key paths only, never values. See docs/config.md.`;

const FLAGS = {
  "--in": "input",
  "--out": "output",
  "--name": "name",
  "--peer-url": "peerUrl",
  "--peer-guild": "peerGuild",
  "--mirror-on-send": "mirrorOnSend",
  "--relay-bang": "relayBangCommands",
  "--blacklist-path": "blacklistPath",
  "--commands-enabled": "commandsEnabled",
  "--image-compression": "imageCompression",
  "--retry-on-rate-limit": "retryOnRateLimit",
  "--peer-discord-relay": "peerDiscordRelay",
  "--peer-rank-rank": "peerRankRank",
  "--peer-rank-guild-rank": "peerRankGuildRank",
  "--stats-proxy-url": "statsProxyUrl",
  "--secrets-file": "secretsFile",
  "--guild-file": "guildFile",
  "--guild-data-path": "guildDataPath",
  "--help-image": "helpImage",
};

const FLAG_NAMES = Object.fromEntries(Object.entries(FLAGS).map(([flag, key]) => [key, flag]));

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

function parseBoolean(raw, flag) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  fail(`${flag} takes true or false`);
  return undefined;
}

function parseArgs(argv) {
  const options = { force: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument === "--force") {
      options.force = true;
      continue;
    }

    const key = FLAGS[argument];
    if (key === undefined) {
      fail(`unknown argument ${argument}\n\n${USAGE}`);
    }

    const value = argv[++i];
    if (value === undefined || value.startsWith("--")) {
      fail(`${argument} needs a value`);
    }

    if (["mirrorOnSend", "relayBangCommands", "imageCompression", "retryOnRateLimit", "peerDiscordRelay"].includes(key)) {
      options[key] = parseBoolean(value, argument);
    } else {
      options[key] = value;
    }
  }

  return options;
}

function readJsonFile(file, label) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    fail(`${label}: cannot read ${file} (${error.code || error.message})`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${label}: ${file} is not valid JSON (${error.message})`);
  }
  return undefined;
}

function getPath(object, keyPath) {
  let current = object;
  for (const part of keyPath.split(".")) {
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function setPath(object, keyPath, value) {
  const parts = keyPath.split(".");
  let current = object;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    } else if (typeof current[part] !== "object" || Array.isArray(current[part])) {
      fail(`cannot add ${keyPath}: ${parts.slice(0, i + 1).join(".")} is not an object`);
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Credentials and the stats proxy address. Their values are only ever read
// from --secrets-file (or --stats-proxy-url for the URL), never from argv.
const MANAGED_API_PATHS = ["minecraft.API.waifuItKey", "minecraft.API.statsProxyUrl", "minecraft.API.statsProxyKey"];

function readSecretsFile(file) {
  const secrets = readJsonFile(file, "secrets");

  if (secrets === null || typeof secrets !== "object" || Array.isArray(secrets)) {
    fail("--secrets-file must contain a JSON object that maps key paths to values");
  }

  for (const keyPath of Object.keys(secrets)) {
    if (!MANAGED_API_PATHS.includes(keyPath)) {
      // Only the offending key path is printed, never a value, and the list of
      // managed paths is not interpolated (CodeQL reads an array of "api key"
      // names as sensitive data once it reaches a log call).
      fail(`--secrets-file: ${keyPath} is not a key path this script manages; see docs/config.md`);
    }
    const value = secrets[keyPath];
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(`--secrets-file: ${keyPath} must be a non-empty string`);
    }
  }

  // A file holding API keys should not be readable by other users. Only the
  // path is printed.
  try {
    if ((fs.statSync(file).mode & 0o077) !== 0) {
      console.warn(`warn  --secrets-file ${file} is accessible by other users; chmod 600 it`);
    }
  } catch (error) {
    // The file was already read successfully, so this is not fatal.
  }

  return secrets;
}

// A value that is still the config.example.json placeholder may be replaced by
// a supplied one even without --force; a real value is kept.
function isPlaceholder(value, exampleValue) {
  if (sameValue(value, exampleValue)) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.includes("STATS_PROXY_HOST")) return true;
  return /^[A-Z][A-Z0-9_]*$/.test(trimmed);
}

function commandsValue(raw) {
  const value = raw.trim();
  if (value === "*") return "*";
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (names.length === 0) {
    fail("--commands-enabled needs \"*\" or a comma-separated list of command names");
  }
  return names;
}

function buildManagedKeys(options, example, secrets) {
  const supplied = (value, fallback) => (value === undefined ? fallback : value);
  const origin = (value) => (value === undefined ? "default" : "supplied");

  const fromSecrets = (keyPath, fallback) => {
    if (secrets && Object.prototype.hasOwnProperty.call(secrets, keyPath)) {
      return { value: secrets[keyPath], origin: "supplied" };
    }
    return { value: fallback, origin: "default" };
  };

  const waifuItKey = fromSecrets("minecraft.API.waifuItKey", example.minecraft.API.waifuItKey);
  const statsProxyKey = fromSecrets("minecraft.API.statsProxyKey", example.minecraft.API.statsProxyKey);
  const statsProxyUrl =
    options.statsProxyUrl === undefined
      ? fromSecrets("minecraft.API.statsProxyUrl", example.minecraft.API.statsProxyUrl)
      : { value: options.statsProxyUrl, origin: "supplied" };

  const entries = [
    ["bridge.name", options.name, "supplied"],
    ["bridge.peerUrl", options.peerUrl, "supplied"],
    ["bridge.peerGuild", options.peerGuild, "supplied"],
    ["bridge.mirrorOnSend", supplied(options.mirrorOnSend, example.bridge.mirrorOnSend), origin(options.mirrorOnSend)],
    [
      "bridge.relayBangCommands",
      supplied(options.relayBangCommands, example.bridge.relayBangCommands),
      origin(options.relayBangCommands),
    ],
    ["bridge.peerRank.rank", supplied(options.peerRankRank, example.bridge.peerRank.rank), origin(options.peerRankRank)],
    [
      "bridge.peerRank.guildRank",
      supplied(options.peerRankGuildRank, example.bridge.peerRank.guildRank),
      origin(options.peerRankGuildRank),
    ],
    [
      "features.retryOnRateLimit",
      supplied(options.retryOnRateLimit, example.features.retryOnRateLimit),
      origin(options.retryOnRateLimit),
    ],
    [
      "features.imageCompression",
      supplied(options.imageCompression, example.features.imageCompression),
      origin(options.imageCompression),
    ],
    [
      "features.peerDiscordRelay",
      supplied(options.peerDiscordRelay, example.features.peerDiscordRelay),
      origin(options.peerDiscordRelay),
    ],
    ["paths.blacklist", supplied(options.blacklistPath, example.paths.blacklist), origin(options.blacklistPath)],
    ["paths.guildData", supplied(options.guildDataPath, example.paths.guildData), origin(options.guildDataPath)],
    ["paths.helpImage", supplied(options.helpImage, example.paths.helpImage), origin(options.helpImage)],
    [
      "discord.commands.enabled",
      options.commandsEnabled === undefined ? example.discord.commands.enabled : commandsValue(options.commandsEnabled),
      origin(options.commandsEnabled),
    ],
    // The fourth element marks a key whose value is a credential or a host
    // address: a placeholder there is replaced by a supplied value without
    // --force, because a host config that still holds the placeholder cannot
    // work.
    ["minecraft.API.waifuItKey", waifuItKey.value, waifuItKey.origin, true],
    ["minecraft.API.statsProxyUrl", statsProxyUrl.value, statsProxyUrl.origin, true],
    ["minecraft.API.statsProxyKey", statsProxyKey.value, statsProxyKey.origin, true],
  ];

  return entries;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(USAGE);
    return;
  }

  for (const key of ["input", "output", "name", "peerUrl", "peerGuild"]) {
    if (options[key] === undefined || String(options[key]).trim().length === 0) {
      fail(`${FLAG_NAMES[key]} is required\n\n${USAGE}`);
    }
  }

  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);

  if (!fs.existsSync(inputPath)) {
    fail(`--in ${options.input} does not exist`);
  }

  const inputReal = fs.realpathSync(inputPath);
  const outputReal = fs.existsSync(outputPath) ? fs.realpathSync(outputPath) : path.resolve(outputPath);
  if (inputReal === outputReal) {
    fail("--out must be a different file than --in; the input config is never overwritten");
  }

  const example = readJsonFile(EXAMPLE_PATH, "schema");
  const config = readJsonFile(inputPath, "config");
  const secrets = options.secretsFile === undefined ? undefined : readSecretsFile(options.secretsFile);

  const report = { added: [], kept: [], replaced: [], defaults: [], differs: [], replacedPlaceholders: [] };

  for (const [keyPath, value, origin, apiKey] of buildManagedKeys(options, example, secrets)) {
    const existing = getPath(config, keyPath);
    const exampleValue = getPath(example, keyPath).value;
    const placeholder = existing.found && apiKey === true && isPlaceholder(existing.value, exampleValue);

    if (existing.found && !options.force && !(placeholder && origin === "supplied")) {
      report.kept.push(keyPath);
      if (!sameValue(existing.value, value)) {
        report.differs.push(keyPath);
      }
      continue;
    }

    if (existing.found) {
      report.replaced.push(keyPath);
      if (placeholder) report.replacedPlaceholders.push(keyPath);
    } else {
      report.added.push(keyPath);
    }
    if (origin === "default") {
      report.defaults.push(keyPath);
    }
    setPath(config, keyPath, value);
  }

  if (options.guildFile !== undefined) {
    const guild = readJsonFile(options.guildFile, "guild");
    if (guild === null || typeof guild !== "object" || Array.isArray(guild)) {
      fail("--guild-file must contain the guild section as a JSON object");
    }
    const existing = getPath(config, "guild");
    const placeholder = existing.found && getPath(config, "guild.name").value === example.guild.name;
    if (existing.found && !options.force && !placeholder) {
      report.kept.push("guild");
      if (!sameValue(existing.value, guild)) report.differs.push("guild");
    } else {
      (existing.found ? report.replaced : report.added).push("guild");
      if (placeholder) report.replacedPlaceholders.push("guild");
      config.guild = guild;
    }
  } else if (!getPath(config, "guild").found) {
    console.log("note  guild: not in the config and no --guild-file given; the bot will boot with the GUILD_NAME placeholder");
  }

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

  for (const entry of report.kept) console.log(`kept  ${entry}`);
  for (const entry of report.replaced) console.log(`set   ${entry}`);
  for (const entry of report.added) console.log(`added ${entry}`);
  for (const entry of report.replacedPlaceholders) {
    console.log(`note  ${entry}: held the config.example.json placeholder, replaced by the supplied value`);
  }
  for (const entry of report.differs) {
    console.log(`note  ${entry}: already set and left alone (--force would replace it with the supplied value)`);
  }
  for (const entry of report.defaults) {
    console.log(`note  ${entry}: not supplied on the command line, took the config.example.json value`);
  }

  const result = checkConfigFile(outputPath);

  for (const warning of result.warnings) console.warn(`warn  ${warning}`);

  if (result.problems.length > 0) {
    console.error(`\nFAIL  ${result.problems.length} problem(s) in the written file:`);
    for (const problem of result.problems) console.error(`  - ${problem}`);
    fail("the written config is not usable; do not deploy it");
  }

  console.log("");
  console.log(
    `OK    wrote ${options.output} (${report.added.length} added, ${report.replaced.length} replaced, ${report.kept.length} kept)`,
  );
  console.log("      review it, then move it over config.json on the host and restart the bot");
}

main();
