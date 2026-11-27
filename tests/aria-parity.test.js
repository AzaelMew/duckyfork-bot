/* eslint-env jest */
/**
 * Aria parity: with an Aria-valued config the behaviours that only Aria had
 * must appear, and with a Sky-valued config nothing may change (that direction
 * is covered by tests/sky-equivalence.test.js, which still runs against the
 * Sky stub).
 *
 * Aria's source lives in the read-only snapshot ~/repository/duckyfork-bot-aria;
 * the comments below point at what each behaviour was copied from.
 */
const fs = require("fs");
const path = require("path");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");
const TEST_TOKEN = "test-web-token";

// A host running with features.imageCompression false must boot without sharp.
jest.mock("sharp", () => {
  throw new Error("sharp was loaded eagerly");
});

jest.mock("@discordjs/rest", () => ({
  REST: class {
    setToken() {
      return this;
    }

    put() {
      return Promise.resolve([]);
    }
  },
}));

jest.mock("discord-api-types/v9", () => ({
  Routes: { applicationGuildCommands: () => "guild-commands" },
}));

function exampleConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
}

const ARIA_COMMANDS = [
  "old:autoclaim",
  "old:autokick",
  "old:invite",
  "old:kick",
  "old:mute",
  "old:override",
  "old:relog",
  "old:setrank",
  "old:unmute",
];

function baseConfig() {
  const config = exampleConfig();
  config.web.token = TEST_TOKEN;
  config.bridge = {
    name: "Sky",
    peerUrl: "http://peer.test:3001",
    peerGuild: "aria",
    mirrorOnSend: true,
    relayBangCommands: true,
    peerRank: { rank: "VIP+", guildRank: "Elder" },
  };
  config.features = { retryOnRateLimit: false, imageCompression: true, peerDiscordRelay: true };
  config.paths = { blacklist: "./data/blacklist.txt" };
  config.discord.commands.enabled = "*";
  return config;
}

function skyConfig() {
  return baseConfig();
}

function ariaConfig() {
  const config = baseConfig();
  config.bridge.name = "Aria";
  config.bridge.mirrorOnSend = false;
  config.bridge.relayBangCommands = false;
  config.bridge.peerRank = { rank: "VIP+", guildRank: "BOT" };
  config.features = { retryOnRateLimit: true, imageCompression: false, peerDiscordRelay: false };
  config.discord.commands.enabled = ARIA_COMMANDS.slice();
  return config;
}

function load(config, modulePath) {
  mockConfig = config;
  jest.resetModules();
  // eslint-disable-next-line global-require
  const axiosMock = require("axios");
  axiosMock.post.mockReset();
  axiosMock.post.mockResolvedValue({ data: {} });
  // eslint-disable-next-line global-require
  const loaded = require(path.join(ROOT, modulePath));
  return { loaded, axios: axiosMock };
}

let bot;
let errorSpy;

beforeEach(() => {
  bot = {
    chat: jest.fn(),
    _client: { chat: jest.fn() },
    player: {},
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
  };
  global.bot = bot;
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  jest.restoreAllMocks();
});

describe("features.retryOnRateLimit", () => {
  it("Sky (false): one send, no listener, exactly as before", () => {
    const { loaded, axios } = load(skyConfig(), "src/contracts/minecraftCommand.js");
    const command = new loaded({});

    command.send("/gc hello");

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(bot.once).not.toHaveBeenCalled();
    expect(bot.on).not.toHaveBeenCalled();
    expect(bot.chat).toHaveBeenCalledWith("/gc hello");
  });

  it("Aria (true): retries a rate-limited line", async () => {
    const { loaded, axios } = load(ariaConfig(), "src/contracts/minecraftCommand.js");
    const command = new loaded({});

    command.send("/gc hello");

    expect(bot.once).toHaveBeenCalledTimes(1);
    const listener = bot.once.mock.calls[0][1];

    await listener("You are sending commands too fast! Please slow down.");

    expect(bot.removeListener).toHaveBeenCalledWith("message", listener);
    // The retry is the same line, so it is no longer mirrored to the peer:
    // only the first attempt posts (a retry used to duplicate it there).
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1]).toEqual({ message: "/gc hello" });
    expect(bot.chat).toHaveBeenLastCalledWith("/gc hello");
  }, 10000);

  it("Aria (true): re-sends a repeated line with the {id} suffix", async () => {
    const config = ariaConfig();
    config.minecraft.bot.messageRepeatBypassLength = 24;
    const { loaded, axios } = load(config, "src/contracts/minecraftCommand.js");
    const command = new loaded({});

    command.send("/gc hello");
    const listener = bot.once.mock.calls[0][1];

    await listener("You cannot say the same message twice!");

    // Only the first attempt mirrors to the peer; the retry is local.
    expect(axios.post).toHaveBeenCalledTimes(1);
    // generateID() already returns the braces, so the suffix is a single "{id}".
    expect(bot.chat).toHaveBeenLastCalledWith(expect.stringMatching(/^\/gc hello \{[A-Za-z0-9]{24}\}$/));
  }, 10000);
});

describe("bridge.mirrorOnSend", () => {
  it("Sky (true): MinecraftManager.onBroadcast mirrors with an id and eventSend mirrors", async () => {
    const first = load(skyConfig(), "src/minecraft/MinecraftManager.js");
    const manager = new first.loaded({ log: { error: jest.fn() } });
    manager.bot = bot;

    await manager.onBroadcast({ channel: "guild", username: "Bob", message: "hi" });

    expect(first.axios.post).toHaveBeenCalledTimes(1);
    expect(first.axios.post.mock.calls[0][1].message).toMatch(/^\/gc Bob » hi \{[A-Za-z0-9]{10}\}$/);
    expect(bot.chat.mock.calls[0][0]).toMatch(/^\/gc Bob » hi \{[A-Za-z0-9]{10}\}$/);

    const second = load(skyConfig(), "src/contracts/minecraftCommand.js");
    const command = new second.loaded({});
    command.eventSend("/gc event");
    expect(second.axios.post).toHaveBeenCalledTimes(1);
  });

  it("Aria (false): no mirror and no id in MinecraftManager.onBroadcast", async () => {
    const { loaded, axios } = load(ariaConfig(), "src/minecraft/MinecraftManager.js");
    const manager = new loaded({ log: { error: jest.fn() } });
    manager.bot = bot;

    await manager.onBroadcast({ channel: "guild", username: "Bob", message: "hi" });

    expect(axios.post).not.toHaveBeenCalled();
    expect(bot.chat).toHaveBeenCalledWith("/gc Bob » hi");
  });

  it("Aria (false): eventSend does not mirror, send still does", () => {
    const { loaded, axios } = load(ariaConfig(), "src/contracts/minecraftCommand.js");
    const command = new loaded({});

    command.eventSend("/gc event");
    expect(axios.post).not.toHaveBeenCalled();

    command.send("/gc plain");
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1]).toEqual({ message: "/gc plain" });
  });
});

function expressFixture() {
  return {
    minecraft: { bot, broadcastMessage: jest.fn() },
    log: { error: jest.fn() },
  };
}

function fakeResponse() {
  const response = { statusCode: undefined, body: undefined };
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  response.json = (body) => {
    response.body = body;
    return response;
  };
  return response;
}

describe("ExpressManager.mutechat", () => {
  it("Sky: relays ! commands and posts with the configured peer rank", () => {
    const { loaded } = load(skyConfig(), "src/express/ExpressManager.js");
    const app = expressFixture();
    const manager = new loaded(app);
    const handle = jest.spyOn(manager.inGameCommand, "handle").mockImplementation(() => {});

    const response = fakeResponse();
    manager.mutechat({ body: { author: "Bob", message: "!nw" } }, response);

    expect(handle).toHaveBeenCalledWith("Bob", "!nw");
    expect(app.minecraft.bot.chat).toHaveBeenCalledWith("/gc Bob: !nw");
    expect(app.minecraft.broadcastMessage).toHaveBeenCalledWith({
      fullMessage: "Bob: !nw",
      chat: "Guild",
      chatType: "guild",
      username: "Bob",
      rank: "VIP+",
      guildRank: "Elder",
      message: "!nw",
      color: 0x2a2a2a,
    });
    expect(response.statusCode).toBe(200);
  });

  it("Aria: no ! relay and no Discord payload (the old handler returned early)", () => {
    const { loaded } = load(ariaConfig(), "src/express/ExpressManager.js");
    const app = expressFixture();
    const manager = new loaded(app);
    const handle = jest.spyOn(manager.inGameCommand, "handle").mockImplementation(() => {});

    const response = fakeResponse();
    manager.mutechat({ body: { author: "Bob", message: "!nw" } }, response);

    expect(handle).not.toHaveBeenCalled();
    expect(app.minecraft.bot.chat).toHaveBeenCalledWith("/gc Bob: !nw");
    expect(app.minecraft.broadcastMessage).toHaveBeenCalledWith({
      username: "Bob",
      message: "!nw",
      guildRank: "BOT",
    });
    expect(response.statusCode).toBe(200);
  });
});

describe("discord.commands.enabled", () => {
  it("Sky: every legacy command and every slash command loads", () => {
    const { loaded } = load(skyConfig(), "src/discord/CommandHandler.js");
    const handler = new loaded({});

    expect(handler.oldcommands.size).toBe(43);
    // The slash registration payload is checked separately below; here just
    // prove the legacy loader is unfiltered.
    expect(handler.oldcommands.has("help")).toBe(true);
    expect(handler.oldcommands.has("ign")).toBe(true);
  });

  it("Aria: only the nine legacy commands load, and no slash command is registered", () => {
    mockConfig = ariaConfig();
    jest.resetModules();
    // eslint-disable-next-line global-require
    const { REST } = require("@discordjs/rest");
    const put = jest.spyOn(REST.prototype, "put").mockResolvedValue([]);
    // eslint-disable-next-line global-require
    const Handler = require(path.join(ROOT, "src/discord/CommandHandler.js"));
    const handler = new Handler({});

    expect(handler.oldcommands.size).toBe(9);
    expect([...handler.oldcommands.keys()].sort()).toEqual([
      "autoclaim",
      "autokick",
      "invite",
      "kick",
      "mute",
      "override",
      "relog",
      "setrank",
      "unmute",
    ]);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1].body).toEqual([]);
    put.mockRestore();
  });

  it("a bare name enables both families, a prefixed one only its own", () => {
    const config = ariaConfig();
    config.discord.commands.enabled = ["kick"];
    const { loaded } = load(config, "src/contracts/commandFilter.js");

    expect(loaded.isEnabled("old", "kick")).toBe(true);
    expect(loaded.isEnabled("slash", "kick")).toBe(true);
    expect(loaded.isEnabled("old", "mute")).toBe(false);
  });

  it("DiscordManager registers the same filtered set", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/discord/DiscordManager.js"), "utf8");
    expect(source).toContain('commandFilter.isEnabled("slash", command.name)');
  });
});

describe("features.imageCompression", () => {
  it("loading MessageHandler with Aria's config never requires sharp", () => {
    // jest.mock("sharp") throws if it is required, so reaching this line at all
    // proves the require is lazy.
    expect(() => load(ariaConfig(), "src/discord/handlers/MessageHandler.js")).not.toThrow();
  });

  it("skips compression when the flag is off", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/discord/handlers/MessageHandler.js"), "utf8");
    expect(source).toContain("config.features.imageCompression && buffer.length > COMPRESS_THRESHOLD_BYTES");
    expect(source).not.toMatch(/^const sharp = require/m);
  });
});

describe("Aria's own name in Discord output", () => {
  it("uses config.bridge.name for the bridge state embeds", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/discord/handlers/StateHandler.js"), "utf8");
    expect(source).toContain("${bridge.name} Bridge is Online");
    expect(source).toContain("${bridge.name} Bridge is Offline");

    const { loaded } = load(ariaConfig(), "src/contracts/bridge.js");
    expect(loaded.name).toBe("Aria");
    expect(loaded.peerGuild).toBe("aria");
    expect(loaded.peerUrl).toBe("http://peer.test:3001");
  });
});
