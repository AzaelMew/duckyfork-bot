/* eslint-env jest */
/**
 * Sky-equivalence: with a Sky-valued config every replaced peer call must send
 * what the hardcoded copy in origin/main sent - same endpoint, same body shape,
 * same Authorization header, same order relative to the guild chat line.
 *
 * The URLs/headers below are built from the stub config, never from a literal
 * address: the repo must not contain the real peer address.
 *
 * origin/main reference for each call site (literal before this change):
 *   src/contracts/minecraftCommand.js:8   POST http://<peer>:3001/api/command {message}
 *   src/contracts/DiscordCommand.js:8     POST /api/command {message}
 *   src/discord/DiscordManager.js:17      POST /api/message {author, guild:"aria", message, type, guildRank}
 *   src/discord/DiscordManager.js:316     POST /api/message {... type:"Officer" ...}
 *   src/minecraft/MinecraftManager.js:18,99        POST /api/command {message}
 *   src/minecraft/handlers/ChatHandler.js:239,378-507  POST /api/command {message}
 *   src/minecraft/commands/onlineCommand.js:489    POST /api/online {message:"a"}
 *   src/discord/oldcommands/OnlineCommand.js:492   POST /api/online {message:"a"}
 *   src/discord/oldcommands/ListCommand.js:144     POST /api/list {message:"a"}
 */
const fs = require("fs");
const path = require("path");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");

function exampleConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
}

function skyConfig() {
  const config = exampleConfig();
  config.web.token = "test-web-token";
  config.bridge = {
    name: "Sky",
    peerUrl: "http://peer.test:3001",
    peerGuild: "aria",
    mirrorOnSend: true,
    relayBangCommands: true,
    peerRank: { rank: "VIP+", guildRank: "Elder" },
  };
  config.features = { retryOnRateLimit: true, imageCompression: true };
  config.paths = { blacklist: "./data/blacklist.txt" };
  config.discord.commands.enabled = "*";
  return config;
}

let axiosMock;
let config;
let minecraftCommand;
let DiscordCommand;

beforeEach(() => {
  mockConfig = skyConfig();
  config = mockConfig;
  jest.resetModules();
  // eslint-disable-next-line global-require
  axiosMock = require("axios");
  axiosMock.post.mockReset();
  axiosMock.post.mockResolvedValue({ data: {} });
  // eslint-disable-next-line global-require
  minecraftCommand = require("../src/contracts/minecraftCommand.js");
  // eslint-disable-next-line global-require
  DiscordCommand = require("../src/contracts/DiscordCommand.js");

  global.bot = { chat: jest.fn(), _client: { chat: jest.fn() }, player: {}, on: jest.fn(), once: jest.fn(), removeListener: jest.fn() };
});

const EXPECTED = () => ({
  url: `${config.bridge.peerUrl}/api/command`,
  options: { timeout: 5000, headers: { Authorization: config.web.token } },
});

describe("minecraft command mirror (Sky behaviour)", () => {
  it("send() posts /api/command with the same body before chatting, as before", async () => {
    const order = [];
    axiosMock.post.mockImplementation(() => {
      order.push("post");
      return Promise.resolve({ data: {} });
    });
    global.bot.chat.mockImplementation(() => order.push("chat"));

    const command = new minecraftCommand({});
    command.send("/gc hello");

    const expected = EXPECTED();
    expect(axiosMock.post).toHaveBeenCalledWith(expected.url, { message: "/gc hello" }, expected.options);
    expect(global.bot.chat).toHaveBeenCalledWith("/gc hello");
    expect(order).toEqual(["post", "chat"]);
  });

  it("eventSend() also mirrors, warpSend() does not", () => {
    const command = new minecraftCommand({});

    command.eventSend("/gc event");
    expect(axiosMock.post).toHaveBeenCalledTimes(1);
    expect(axiosMock.post.mock.calls[0][1]).toEqual({ message: "/gc event" });

    command.warpSend("/gc warp");
    expect(axiosMock.post).toHaveBeenCalledTimes(1);
    expect(global.bot.chat).toHaveBeenLastCalledWith("/gc warp");
  });
});

describe("discord command mirror (Sky behaviour)", () => {
  it("sendMinecraftMessage chats first and then posts /api/command", () => {
    const order = [];
    axiosMock.post.mockImplementation(() => {
      order.push("post");
      return Promise.resolve({ data: {} });
    });
    global.bot.chat.mockImplementation(() => order.push("chat"));

    const command = new DiscordCommand({ app: { minecraft: { bot: global.bot } } });
    command.sendMinecraftMessage("/gc from discord");

    const expected = EXPECTED();
    expect(axiosMock.post).toHaveBeenCalledWith(expected.url, { message: "/gc from discord" }, expected.options);
    expect(order).toEqual(["chat", "post"]);
  });

  it("does not mirror /g invite, exactly as before", () => {
    const command = new DiscordCommand({ app: { minecraft: { bot: global.bot } } });
    command.sendMinecraftMessage("/g invite SomePlayer");

    expect(global.bot.chat).toHaveBeenCalledWith("/g invite SomePlayer");
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it("sendPromoteMessage never mirrors", () => {
    const command = new DiscordCommand({ app: { minecraft: { bot: global.bot } } });
    command.sendPromoteMessage("/g promote SomePlayer");

    expect(axiosMock.post).not.toHaveBeenCalled();
  });
});

describe("MinecraftManager.onBroadcast mirror (Sky behaviour)", () => {
  it("posts the /gc line with the generateID suffix and chats the same line", async () => {
    // eslint-disable-next-line global-require
    const MinecraftManager = require("../src/minecraft/MinecraftManager.js");
    const manager = new MinecraftManager({ log: { error: jest.fn() } });
    manager.bot = global.bot;

    await manager.onBroadcast({ channel: "guild", username: "Bob", message: "hi" });

    const expected = EXPECTED();
    expect(axiosMock.post).toHaveBeenCalledTimes(1);
    expect(axiosMock.post.mock.calls[0][0]).toBe(expected.url);
    expect(axiosMock.post.mock.calls[0][2]).toEqual(expected.options);
    const body = axiosMock.post.mock.calls[0][1];
    expect(body.message).toMatch(/^\/gc Bob » hi \{[A-Za-z0-9]{10}\}$/);
    expect(global.bot.chat).toHaveBeenCalledTimes(1);
    // origin/main generated the suffix twice (once for the peer, once for the
    // local chat line), so the two lines may differ only in that random id.
    expect(global.bot.chat.mock.calls[0][0]).toMatch(/^\/gc Bob » hi \{[A-Za-z0-9]{10}\}$/);
  });
});

describe("no hardcoded peer left in the tree", () => {
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
  files.push("index.js");

  it("never contains the peer port or a LAN peer address", () => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      return /:3001/.test(source) || /192\.168\.0\.[56]\b/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("builds every peer call from contracts/bridge.js", () => {
    const callSites = [
      ["src/contracts/minecraftCommand.js", 2, "/api/command"],
      ["src/contracts/DiscordCommand.js", 1, "/api/command"],
      ["src/discord/DiscordManager.js", 1, "/api/message"],
      ["src/minecraft/MinecraftManager.js", 1, "/api/command"],
      ["src/minecraft/handlers/ChatHandler.js", 7, "/api/command"],
      ["src/minecraft/commands/onlineCommand.js", 1, "/api/online"],
      ["src/discord/oldcommands/OnlineCommand.js", 1, "/api/online"],
      ["src/discord/oldcommands/ListCommand.js", 1, "/api/list"],
    ];

    for (const [file, count, endpoint] of callSites) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      const calls = source.match(/postToPeer\(/g) || [];
      expect({ file, calls: calls.length }).toEqual({ file, calls: count });
      expect({ file, endpoint: source.includes(`postToPeer("${endpoint}"`) }).toEqual({ file, endpoint: true });
      expect({ file, bridge: /require\("[^"]*bridge\.js"\)/.test(source) }).toEqual({ file, bridge: true });
    }
  });

  it("keeps the /api/online and /api/list bodies unchanged", () => {
    const bodies = [
      ["src/minecraft/commands/onlineCommand.js", 'postToPeer("/api/online", { message: "a" })'],
      ["src/discord/oldcommands/OnlineCommand.js", 'postToPeer("/api/online", { message: "a" })'],
      ["src/discord/oldcommands/ListCommand.js", 'postToPeer("/api/list", { message: "a" })'],
    ];

    for (const [file, needle] of bodies) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect({ file, present: source.includes(needle) }).toEqual({ file, present: true });
    }
  });

  it("takes the guild field of /api/message from config.bridge.peerGuild", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/discord/DiscordManager.js"), "utf8");
    expect(source).toContain("guild: bridge.peerGuild");
    expect(source).not.toContain('guild: "aria"');
  });
});

describe("bot name literals (Sky behaviour)", () => {
  it("uses config.bridge.name where the bot's own name is shown", () => {
    const expectations = [
      ["src/discord/handlers/StateHandler.js", "${bridge.name} Bridge is Online"],
      ["src/discord/handlers/StateHandler.js", "${bridge.name} Bridge is Offline"],
      ["src/discord/DiscordManager.js", "- ${bridge.name}"],
      ["src/discord/DiscordManager.js", "text: bridge.name"],
      ["src/minecraft/handlers/ChatHandler.js", "has joined ${bridge.name}."],
    ];

    for (const [file, needle] of expectations) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect({ file, needle, present: source.includes(needle) }).toEqual({ file, needle, present: true });
    }
  });

  it("no longer hardcodes the Sky name in the guild output paths", () => {
    for (const file of ["src/discord/handlers/StateHandler.js", "src/discord/DiscordManager.js", "src/minecraft/handlers/ChatHandler.js"]) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect({ file, sky: /"Sky"|`Sky | - Sky`|has joined Sky\./.test(source) }).toEqual({ file, sky: false });
    }
  });
});
