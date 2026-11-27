/* eslint-env jest */
/**
 * The reaction commands (pat, poke, slap, nom, slowclap, stab, fuckyou, bonk,
 * 8ball) share one fetch in src/contracts/commands/reactions.js. These tests
 * pin the parts that used to be copied into every command file: the endpoints,
 * the waifu.it authorization header, the 5 s cooldown and the text each surface
 * sends.
 *
 * Every value here is fake. Nothing in this file is a real credential.
 */
const fs = require("fs");
const path = require("path");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");

const FAKE_WAIFU_KEY = "test-waifu-key";
const FAKE_IMAGE = "http://127.0.0.1:3000/image.gif";

function stubConfig() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
  config.minecraft.API.waifuItKey = FAKE_WAIFU_KEY;
  // contracts/bridge.js validates these at require time; 127.0.0.1 keeps the
  // peer target local and the validator quiet.
  config.bridge = { ...config.bridge, name: "Sky", peerUrl: "http://127.0.0.1:3001", peerGuild: "aria" };
  return config;
}

let axiosMock;
let reactions;
let readFileSpy;
let writeFileSpy;

beforeEach(() => {
  mockConfig = stubConfig();
  jest.resetModules();

  // The 5 s cooldown lives in lastCalledTime.txt; the tests must not read or
  // write it in the worktree.
  readFileSpy = jest.spyOn(fs, "readFile").mockImplementation((file, encoding, callback) => callback(null, "0"));
  writeFileSpy = jest.spyOn(fs, "writeFile").mockImplementation((file, data, callback) => {
    if (typeof callback === "function") callback(null);
  });

  // eslint-disable-next-line global-require
  axiosMock = require("axios");
  axiosMock.get.mockReset();
  axiosMock.get.mockResolvedValue({ data: { url: FAKE_IMAGE } });

  // eslint-disable-next-line global-require
  reactions = require("../src/contracts/commands/reactions.js");
});

afterEach(() => {
  readFileSpy.mockRestore();
  writeFileSpy.mockRestore();
  jest.restoreAllMocks();
});

describe("getReaction", () => {
  it("sends the waifu.it token from config.minecraft.API.waifuItKey", async () => {
    const endpoints = [
      ["stab", "https://waifu.it/api/v4/stab"],
      ["fuckyou", "https://waifu.it/api/v4/midfing"],
      ["bonk", "https://waifu.it/api/v4/bonk"],
    ];

    for (const [reaction, endpoint] of endpoints) {
      axiosMock.get.mockClear();
      axiosMock.get.mockResolvedValue({ data: { url: FAKE_IMAGE } });

      await expect(reactions.getReaction(reaction)).resolves.toBe(FAKE_IMAGE);

      expect(axiosMock.get).toHaveBeenCalledTimes(1);
      const [url, options] = axiosMock.get.mock.calls[0];
      expect(url).toBe(endpoint);
      expect(Object.keys(options)).toEqual(["headers"]);
      expect(Object.keys(options.headers)).toEqual(["Authorization"]);
      expect(options.headers.Authorization).toBe(FAKE_WAIFU_KEY);
    }
  });

  it("keeps the otakugifs calls headerless", async () => {
    await expect(reactions.getReaction("pat")).resolves.toBe(FAKE_IMAGE);

    const [call] = axiosMock.get.mock.calls;
    expect(call).toEqual(["https://api.otakugifs.xyz/gif?reaction=pat"]);
  });

  it("slowclap still picks one of its two endpoints at random", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.1);
    await reactions.getReaction("slowclap");
    expect(axiosMock.get.mock.calls[0][0]).toBe("https://api.otakugifs.xyz/gif?reaction=slowclap");

    axiosMock.get.mockClear();
    jest.spyOn(Math, "random").mockReturnValue(0.9);
    await reactions.getReaction("slowclap");
    expect(axiosMock.get.mock.calls[0][0]).toBe("https://api.otakugifs.xyz/gif?reaction=clap");
  });

  it("answers with the cooldown text instead of an url inside the 5 s window", async () => {
    readFileSpy.mockImplementation((file, encoding, callback) => callback(null, String(Date.now())));

    await expect(reactions.getReaction("pat")).resolves.toBe(reactions.COOLDOWN_MESSAGE);
    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it("rejects a response without an url", async () => {
    axiosMock.get.mockResolvedValue({ data: {} });

    await expect(reactions.getReaction("pat")).rejects.toBe("Invalid data format or no image URL found");
  });

  it("only knows the reactions it has an endpoint for", () => {
    expect(Object.keys(reactions.SOURCES).sort()).toEqual([
      "bonk",
      "fuckyou",
      "nom",
      "pat",
      "poke",
      "slap",
      "slowclap",
      "stab",
    ]);
    expect(() => reactions.getReaction("boop")).toThrow('Unknown reaction "boop"');
  });
});

describe("targets", () => {
  it("parseTarget takes everything after the command word", () => {
    expect(reactions.parseTarget("!pat Bob Smith")).toBe("Bob Smith");
    expect(reactions.parseTarget("!nom")).toBe("");
  });

  it("resolveDiscordTarget swaps a mention for the mentioned name", () => {
    const message = {
      content: "!pat <@42>",
      mentions: { users: { first: () => ({ id: "42", globalName: "Bob" }) } },
    };

    expect(reactions.resolveDiscordTarget(message)).toEqual({ target: "<@42>", mcuser: "Bob" });
  });

  it("resolveDiscordTarget is null without an argument", () => {
    expect(reactions.resolveDiscordTarget({ content: "!pat" })).toBeNull();
  });
});

describe("8ball", () => {
  it("answers from the shared list", async () => {
    const answer = await reactions.askEightBall();
    expect(reactions.EIGHT_BALL_ANSWERS).toContain(answer);
    expect(reactions.EIGHT_BALL_ANSWERS.length).toBe(21);
  });
});

describe("command wrappers", () => {
  it("in-game !pat keeps its guild line and embed", async () => {
    // eslint-disable-next-line global-require
    const PatCommand = require("../src/minecraft/commands/PatCommand.js");
    const broadcastFuckEmbed = jest.fn();
    const command = new PatCommand({ broadcastFuckEmbed });
    command.send = jest.fn();

    command.onCommand("Alice", "!pat Bob");
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(axiosMock.get.mock.calls[0][0]).toBe("https://api.otakugifs.xyz/gif?reaction=pat");
    expect(command.send).toHaveBeenCalledWith("/gc Alice pat Bob!");
    expect(broadcastFuckEmbed).toHaveBeenCalledWith({ username: "Alice", message: "pat Bob", url: FAKE_IMAGE });
  });

  it("discord !pat keeps its embed and 350 ms guild line", async () => {
    // eslint-disable-next-line global-require
    const PatCommand = require("../src/discord/oldcommands/PatCommand.js");
    const send = jest.fn();
    const command = new PatCommand({ app: { minecraft: { bot: { player: {} } } } });
    command.sendMinecraftMessage = jest.fn();

    command.onCommand({
      content: "!pat Bob",
      author: { globalName: "Alice", toString: () => "Alice" },
      channel: { send },
    });

    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(send).toHaveBeenCalledWith({
      embeds: [
        {
          description: "Alice pat Bob!",
          image: { url: FAKE_IMAGE },
          color: 0x2a2a2a,
          timestamp: expect.any(Date),
          footer: { text: "BOT" },
        },
      ],
    });
    expect(command.sendMinecraftMessage).toHaveBeenCalledWith("/gc Alice pat Bob!");
  });

  it("discord !pat answers with the cooldown embed and no guild line", async () => {
    readFileSpy.mockImplementation((file, encoding, callback) => callback(null, String(Date.now())));

    // eslint-disable-next-line global-require
    const PatCommand = require("../src/discord/oldcommands/PatCommand.js");
    const send = jest.fn();
    const command = new PatCommand({ app: { minecraft: { bot: { player: {} } } } });
    command.sendMinecraftMessage = jest.fn();

    command.onCommand({
      content: "!pat Bob",
      author: { globalName: "Alice", toString: () => "Alice" },
      channel: { send },
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(send).toHaveBeenCalledWith({
      embeds: [
        {
          description: reactions.COOLDOWN_MESSAGE,
          color: 0x2a2a2a,
          timestamp: expect.any(Date),
          footer: { text: "BOT" },
        },
      ],
    });
    expect(command.sendMinecraftMessage).not.toHaveBeenCalled();
  });

  it("no reaction command keeps its own copy of the fetch", () => {
    const inGame = [
      "8ballCommand.js",
      "FuckYouCommand.js",
      "NomCommand.js",
      "PatCommand.js",
      "PokeCommand.js",
      "SlapCommand.js",
      "SlowclapCommand.js",
      "StabCommand.js",
      "bonkCommand.js",
    ];
    const discord = [
      "8ballCommand.js",
      "BonkCommand.js",
      "FuckYouCommand.js",
      "NomCommand.js",
      "PatCommand.js",
      "PokeCommand.js",
      "SlapCommand.js",
      "SlowclapCommand.js",
      "StabCommand.js",
    ];
    const paths = [
      ...inGame.map((file) => path.join("src", "minecraft", "commands", file)),
      ...discord.map((file) => path.join("src", "discord", "oldcommands", file)),
    ];

    for (const file of paths) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect({ file, axios: source.includes("axios") }).toEqual({ file, axios: false });
      expect({ file, shared: source.includes("contracts/commands/reactions.js") }).toEqual({ file, shared: true });
    }
  });
});
