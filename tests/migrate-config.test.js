/* eslint-env jest */
/**
 * scripts/migrate-config.js - adds the unified config keys to a host config
 * without touching existing values and without printing secrets.
 *
 * The fixture stands in for a real host config.json: old tree (no bridge /
 * features / paths), fake secrets in the places the real file has them.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "scripts", "migrate-config.js");

const FAKE_SECRETS = ["FAKE_WEB_TOKEN", "FAKE_HYPIXEL_KEY", "FAKE_DISCORD_TOKEN"];

function hostConfig() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
  delete config.bridge;
  delete config.features;
  delete config.paths;
  delete config.discord.commands.enabled;
  config.web.token = FAKE_SECRETS[0];
  config.minecraft.API.hypixelAPIkey = FAKE_SECRETS[1];
  config.discord.bot.token = FAKE_SECRETS[2];
  return config;
}

const BASE_ARGS = ["--name", "Sky", "--peer-url", "http://peer.test:3001", "--peer-guild", "aria"];

let directory;
let inputPath;
let outputPath;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "duckyfork-migrate-"));
  inputPath = path.join(directory, "config.json");
  outputPath = path.join(directory, "config.json.new");
  fs.writeFileSync(inputPath, JSON.stringify(hostConfig(), null, 2));
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function run(extra = [], options = {}) {
  return spawnSync(
    process.execPath,
    [SCRIPT, "--in", options.input || inputPath, "--out", options.output || outputPath, ...BASE_ARGS, ...extra],
    { cwd: ROOT, encoding: "utf8" },
  );
}

test("adds every new key, preserves existing values, never touches the input", () => {
  const before = fs.readFileSync(inputPath, "utf8");
  const result = run(["--blacklist-path", "/srv/bot/blacklist.txt", "--peer-rank-rank", "VIP+", "--peer-rank-guild-rank", "Elder"]);

  expect(result.status).toBe(0);
  expect(fs.readFileSync(inputPath, "utf8")).toBe(before);

  expect(result.stderr).not.toContain(FAKE_SECRETS[0]);
  expect(result.stderr).not.toContain(FAKE_SECRETS[1]);
  expect(result.stderr).not.toContain(FAKE_SECRETS[2]);
  expect(result.stdout).not.toContain(FAKE_SECRETS[0]);
  expect(result.stdout).not.toContain(FAKE_SECRETS[1]);
  expect(result.stdout).not.toContain(FAKE_SECRETS[2]);

  const migrated = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const original = JSON.parse(before);

  // Seeded secrets and every pre-existing value are untouched.
  expect(migrated.web.token).toBe(FAKE_SECRETS[0]);
  expect(migrated.minecraft.API.hypixelAPIkey).toBe(FAKE_SECRETS[1]);
  expect(migrated.discord.bot.token).toBe(FAKE_SECRETS[2]);
  expect(migrated.minecraft.bot).toEqual(original.minecraft.bot);
  expect(migrated.verification).toEqual(original.verification);

  // New keys carry the supplied values.
  expect(migrated.bridge.name).toBe("Sky");
  expect(migrated.bridge.peerUrl).toBe("http://peer.test:3001");
  expect(migrated.bridge.peerGuild).toBe("aria");
  expect(migrated.bridge.peerRank).toEqual({ rank: "VIP+", guildRank: "Elder" });
  expect(migrated.bridge.mirrorOnSend).toBe(true);
  expect(migrated.bridge.relayBangCommands).toBe(true);
  expect(migrated.paths.blacklist).toBe("/srv/bot/blacklist.txt");
  expect(migrated.features).toEqual({ retryOnRateLimit: true, imageCompression: true, peerDiscordRelay: true, roleSync: false });
  expect(migrated.discord.commands.enabled).toBe("*");

  expect(result.stdout).toContain("added bridge.name");
  expect(result.stdout).toContain("added paths.blacklist");
});

test("is idempotent and keeps values that already exist", () => {
  expect(run().status).toBe(0);
  const first = fs.readFileSync(outputPath, "utf8");

  // Feed the migrated file back in: nothing may change, everything is "kept".
  const second = run(["--peer-url", "http://other.test:3001"], { input: outputPath, output: `${outputPath}.2` });
  expect(second.status).toBe(0);
  expect(second.stdout).toContain("kept  bridge.peerUrl");
  expect(second.stdout).toContain("already set and left alone");
  expect(fs.readFileSync(`${outputPath}.2`, "utf8")).toBe(first);
});

test("--force replaces an existing managed key", () => {
  expect(run().status).toBe(0);

  const result = run(["--peer-url", "http://other.test:3001", "--force"]);
  expect(result.status).toBe(0);
  const migrated = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  expect(migrated.bridge.peerUrl).toBe("http://other.test:3001");
});

test("--commands-enabled accepts a comma separated list", () => {
  const result = run(["--commands-enabled", "kick, mute ,invite"]);
  expect(result.status).toBe(0);
  const migrated = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  expect(migrated.discord.commands.enabled).toEqual(["kick", "mute", "invite"]);
});

test("refuses to write over its own input", () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--in", inputPath, "--out", inputPath, ...BASE_ARGS],
    { cwd: ROOT, encoding: "utf8" },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("--out must be a different file than --in");
});

test("fails when a required flag is missing", () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--in", inputPath, "--out", outputPath, "--name", "Sky"],
    { cwd: ROOT, encoding: "utf8" },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("--peer-url is required");
  expect(fs.existsSync(outputPath)).toBe(false);
});

test("rejects a boolean flag that is not true/false", () => {
  const result = run(["--mirror-on-send", "yes"]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("--mirror-on-send takes true or false");
});
