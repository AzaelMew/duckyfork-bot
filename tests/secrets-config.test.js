/* eslint-env jest */
/**
 * Secrets live in config, not in source.
 *
 * The stats proxy used to be called with a literal LAN address and a literal
 * `?key=<hex>` query value, and the waifu.it calls sent a literal
 * `Authorization: "<token>"` header. origin/main built each request by string
 * concatenation; these tests assert the config-driven code produces exactly the
 * same request with the same (fake) values.
 *
 * Every value here is fake: `http://localhost:3000`, `test-stats-key`,
 * `test-waifu-key`. Nothing in this file is or was a real credential.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");

// Fake UUID, not a real player and not a credential.
const FAKE_UUID = "0123456789abcdef0123456789abcdef";
const FAKE_STATS_URL = "http://localhost:3000";
const FAKE_STATS_KEY = "test-stats-key";
const FAKE_WAIFU_KEY = "test-waifu-key";

function stubConfig() {
  // Everything the tested modules do not read keeps the config.example.json
  // value; only the three keys under test, the bridge token and a local peer
  // address are set here.
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
  config.web.token = "test-web-token";
  // contracts/bridge.js validates these at require time; 127.0.0.1 keeps the
  // request targets local (nothing here talks to a peer).
  config.bridge = { ...config.bridge, name: "Sky", peerUrl: "http://127.0.0.1:3001", peerGuild: "aria" };
  config.minecraft.API.waifuItKey = FAKE_WAIFU_KEY;
  config.minecraft.API.statsProxyUrl = FAKE_STATS_URL;
  config.minecraft.API.statsProxyKey = FAKE_STATS_KEY;
  return config;
}

// The profile shape the stats commands read; every field is a number so the
// formatter cannot throw before the request assertion.
function fakeProfile() {
  const level = (value) => ({ level: value });
  return {
    name: "Strawberry",
    networth: { networth: 1000000 },
    skills: {
      farming: level(30),
      mining: level(30),
      combat: level(30),
      foraging: level(30),
      fishing: level(30),
      enchanting: level(30),
      alchemy: level(30),
      taming: level(30),
      carpentry: level(30),
    },
    dungeons: { catacombs: { skill: { levelWithProgress: 20, totalXp: 0 } } },
    slayer: {
      wolf: { xp: 0 },
      zombie: { xp: 0 },
      spider: { xp: 0 },
      enderman: { xp: 0 },
      blaze: { xp: 0 },
      vampire: { xp: 0 },
    },
    sblevel: 100,
    talismans: { mp: 100 },
  };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve)).then(() => new Promise((resolve) => setImmediate(resolve)));
}

// origin/main built this URL as:
//   'http://<lan host>:3000/v1/profiles/' + name + '?key=<literal hex>'
// so the expected value is the same concatenation with the fake config values.
function expectedProxyUrl(version) {
  return FAKE_STATS_URL + "/" + version + "/profiles/" + FAKE_UUID + "?key=" + FAKE_STATS_KEY;
}

let axiosMock;

beforeEach(() => {
  mockConfig = stubConfig();
  jest.resetModules();
  // eslint-disable-next-line global-require
  axiosMock = require("axios");
  axiosMock.get.mockReset();
  axiosMock.post.mockReset();
  axiosMock.post.mockResolvedValue({ data: {} });

  global.bot = { chat: jest.fn(), _client: { chat: jest.fn() }, player: {}, on: jest.fn(), once: jest.fn(), removeListener: jest.fn() };
});

describe("stats proxy call sites read config.minecraft.API", () => {
  it("minecraft !stats requests the same /v1/profiles URL and query as before", async () => {
    axiosMock.get.mockImplementation((url) => {
      if (url.includes("mojang") || url.includes("ashcon")) return Promise.resolve({ data: { id: FAKE_UUID } });
      return Promise.resolve({ data: { data: [fakeProfile()] } });
    });

    // eslint-disable-next-line global-require
    const StatsCommand = require("../src/minecraft/commands/StatsCommand.js");
    const command = new StatsCommand({ broadcastCommandEmbed: jest.fn() });
    command.onCommand("Strawberry", "!stats");

    await flush();

    const proxyCall = axiosMock.get.mock.calls.map((call) => call[0]).find((url) => url.startsWith(FAKE_STATS_URL + "/"));
    expect(proxyCall).toBe(expectedProxyUrl("v1"));
  });

  it("discord !stats requests the same /v1/profiles URL and query as before", async () => {
    axiosMock.get.mockImplementation((url) => {
      if (url.includes("mojang") || url.includes("ashcon")) return Promise.resolve({ data: { id: FAKE_UUID } });
      return Promise.resolve({ data: { data: [fakeProfile()] } });
    });

    // eslint-disable-next-line global-require
    const StatsCommand = require("../src/discord/oldcommands/StatsCommand.js");
    const command = new StatsCommand({ app: { minecraft: { bot: global.bot } } });
    command.onCommand({ content: "!stats Strawberry", channel: { send: jest.fn() } });

    await flush();

    const proxyCall = axiosMock.get.mock.calls.map((call) => call[0]).find((url) => url.startsWith(FAKE_STATS_URL + "/"));
    expect(proxyCall).toBe(expectedProxyUrl("v1"));
  });

  it("networth keeps the /v2/ path it used on origin/main", async () => {
    // The v2 call site is the one that differs between commands, so the version
    // segment is asserted separately from the rest of the URL.
    const source = fs.readFileSync(path.join(ROOT, "src/discord/oldcommands/NetworthCommand.js"), "utf8");
    expect(source).toContain("/v2/profiles/${name}?key=${config.minecraft.API.statsProxyKey}");
    expect(source).toContain("config.minecraft.API.statsProxyUrl");
  });
});

describe("waifu.it call sites read config.minecraft.API.waifuItKey", () => {
  let readFileSpy;
  let writeFileSpy;

  beforeEach(() => {
    // The waifu commands keep a 5 s cooldown in lastCalledTime.txt; the tests
    // must not write into the worktree.
    readFileSpy = jest.spyOn(fs, "readFile").mockImplementation((file, encoding, callback) => callback(null, "0"));
    writeFileSpy = jest.spyOn(fs, "writeFile").mockImplementation((file, data, callback) => {
      if (typeof callback === "function") callback(null);
    });
  });

  afterEach(() => {
    readFileSpy.mockRestore();
    writeFileSpy.mockRestore();
  });

  it("minecraft !bonk sends the config token as the Authorization header", () => {
    axiosMock.get.mockResolvedValue({ data: { url: "http://127.0.0.1:3000/image.gif" } });

    // eslint-disable-next-line global-require
    const BonkCommand = require("../src/minecraft/commands/bonkCommand.js");
    const command = new BonkCommand({ broadcastFuckEmbed: jest.fn() });
    command.onCommand("Alice", "!bonk Bob");

    const [url, options] = axiosMock.get.mock.calls[0];
    expect(url).toBe("https://waifu.it/api/v4/bonk");
    expect(options).toEqual({ headers: { Authorization: mockConfig.minecraft.API.waifuItKey } });
  });

  it("discord !stab sends the config token as the Authorization header", () => {
    jest.useFakeTimers();
    axiosMock.get.mockResolvedValue({ data: { url: "http://127.0.0.1:3000/image.gif" } });

    // eslint-disable-next-line global-require
    const StabCommand = require("../src/discord/oldcommands/StabCommand.js");
    const command = new StabCommand({ app: { minecraft: { bot: global.bot } } });
    command.onCommand({
      content: "!stab Bob",
      author: { globalName: "Alice", toString: () => "Alice" },
      channel: { send: jest.fn() },
    });

    const [url, options] = axiosMock.get.mock.calls[0];
    expect(url).toBe("https://waifu.it/api/v4/stab");
    expect(options).toEqual({ headers: { Authorization: mockConfig.minecraft.API.waifuItKey } });

    jest.clearAllTimers();
    jest.useRealTimers();
  });
});

describe("the tree itself carries no stats proxy address or api key", () => {
  const files = [];
  const collect = (directory) => {
    for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(relative);
      else if (entry.name.endsWith(".js")) files.push(relative);
    }
  };
  collect("src");
  collect("API");
  collect("tests");
  files.push("index.js");

  it("has no LAN stats-proxy address and no literal Authorization header", () => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      return /192[.]168[.]0[.][0-9]+/.test(source) || /Authorization:[ \t]*["'][^"']{8,}["']/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("has no literal ?key=<long value> in a request URL", () => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      return /[?&](key|token|apikey)=[0-9A-Za-z_-]{16,}/.test(source);
    });

    expect(offenders).toEqual([]);
  });
});

describe("migrate-config.js --secrets-file", () => {
  const waifuValue = "fake-waifu-value";
  const proxyKeyValue = "fake-proxy-key-value";

  let directory;
  let inputPath;
  let outputPath;
  let secretsPath;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "duckyfork-secrets-"));
    inputPath = path.join(directory, "config.json");
    outputPath = path.join(directory, "config.json.new");
    secretsPath = path.join(directory, "secrets.json");

    const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
    delete config.bridge;
    delete config.features;
    delete config.paths;
    delete config.discord.commands.enabled;
    config.web.token = "fake-web-token";
    // Still the example placeholder: must be replaced by the supplied value.
    config.minecraft.API.statsProxyKey = "STATS_PROXY_KEY";
    // A real value already on the host: must be kept.
    config.minecraft.API.waifuItKey = "existing-real-value";
    delete config.minecraft.API.statsProxyUrl;

    fs.writeFileSync(inputPath, JSON.stringify(config, null, 2));
    fs.writeFileSync(
      secretsPath,
      JSON.stringify({
        "minecraft.API.waifuItKey": waifuValue,
        "minecraft.API.statsProxyUrl": FAKE_STATS_URL,
        "minecraft.API.statsProxyKey": proxyKeyValue,
      }),
      { mode: 0o600 },
    );
    fs.chmodSync(secretsPath, 0o600);
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function run() {
    return spawnSync(
      process.execPath,
      [
        path.join(ROOT, "scripts", "migrate-config.js"),
        "--in",
        inputPath,
        "--out",
        outputPath,
        "--name",
        "Sky",
        "--peer-url",
        "http://127.0.0.1:3001",
        "--peer-guild",
        "aria",
        "--secrets-file",
        secretsPath,
      ],
      { cwd: ROOT, encoding: "utf8" },
    );
  }

  it("adds the supplied values, keeps real ones and prints no value", () => {
    const result = run();
    expect(result.status).toBe(0);

    const migrated = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    expect(migrated.minecraft.API.waifuItKey).toBe("existing-real-value");
    expect(migrated.minecraft.API.statsProxyUrl).toBe(FAKE_STATS_URL);
    expect(migrated.minecraft.API.statsProxyKey).toBe(proxyKeyValue);

    for (const secret of [waifuValue, proxyKeyValue, "existing-real-value", "fake-web-token"]) {
      expect(result.stdout).not.toContain(secret);
      expect(result.stderr).not.toContain(secret);
    }

    expect(result.stdout).toContain("kept  minecraft.API.waifuItKey");
    expect(result.stdout).toContain("added minecraft.API.statsProxyUrl");
    expect(result.stdout).toContain("set   minecraft.API.statsProxyKey");
  });

  it("refuses a secrets file with an unmanaged key path", () => {
    fs.writeFileSync(secretsPath, JSON.stringify({ "minecraft.API.notAKey": "x" }), { mode: 0o600 });

    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("minecraft.API.notAKey is not a key path this script manages");
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});
