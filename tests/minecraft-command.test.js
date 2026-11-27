/* eslint-env jest */
/**
 * src/contracts/minecraftCommand.js - the retry listener.
 *
 * `send()` registers a one-shot listener for Hypixel's rate-limit / repeat
 * answers and retries the line. The attempt counter must survive the retry
 * (otherwise the 5-attempt limit never fires and the bot retries forever) and
 * only the first attempt may mirror the line to the peer (otherwise every
 * retry duplicates it on the other side).
 */
const { EventEmitter } = require("events");

jest.mock("../src/contracts/bridge.js", () => ({
  enabled: true,
  name: "Sky",
  peerGuild: "aria",
  peerUrl: "http://peer.test:3001",
  postToPeer: jest.fn(),
}));

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const RATE_LIMIT_MESSAGE = "You are sending commands too fast! Please slow down.";
const REPEAT_MESSAGE = "You cannot say the same message twice!";
const FAILURE_MESSAGE = "/gc Command failed to send message after 5 attempts. Please try again later.";

function commandConfig() {
  return {
    features: { retryOnRateLimit: true },
    bridge: { mirrorOnSend: true },
    minecraft: { bot: { messageRepeatBypassLength: 6 } },
  };
}

function load() {
  mockConfig = commandConfig();
  jest.resetModules();
  // eslint-disable-next-line global-require
  const bridge = require("../src/contracts/bridge.js");
  bridge.postToPeer.mockReset();
  // eslint-disable-next-line global-require
  const Command = require("../src/contracts/minecraftCommand.js");
  return { Command, bridge };
}

let bot;
let logSpy;
let errorSpy;

beforeEach(() => {
  bot = new EventEmitter();
  bot.chat = jest.fn();
  bot._client = { chat: jest.fn() };
  bot.player = {};
  global.bot = bot;
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  logSpy.mockRestore();
  errorSpy.mockRestore();
  jest.restoreAllMocks();
  delete global.bot;
});

describe("minecraftCommand.send retry limit", () => {
  it("stops after 5 attempts and mirrors the line to the peer only once", async () => {
    const { Command, bridge } = load();
    jest.useFakeTimers();
    const command = new Command({});

    command.send("/gc hello");

    expect(bot.chat).toHaveBeenCalledTimes(1);
    expect(bridge.postToPeer).toHaveBeenCalledTimes(1);
    expect(bridge.postToPeer).toHaveBeenCalledWith("/api/command", { message: "/gc hello" });

    for (let attempt = 0; attempt < 4; attempt++) {
      bot.emit("message", RATE_LIMIT_MESSAGE);
      await jest.advanceTimersByTimeAsync(300);
    }

    // Four sends of the line plus the local "failed after 5 attempts" notice.
    expect(bot.chat).toHaveBeenCalledTimes(5);
    expect(bot.chat).toHaveBeenLastCalledWith(FAILURE_MESSAGE);
    // A retry is the same line: it must not be posted to the peer again.
    expect(bridge.postToPeer).toHaveBeenCalledTimes(1);

    // No listener is left behind, so a further rate-limit answer is ignored.
    bot.emit("message", RATE_LIMIT_MESSAGE);
    await jest.advanceTimersByTimeAsync(1000);

    expect(bot.chat).toHaveBeenCalledTimes(5);
    expect(bridge.postToPeer).toHaveBeenCalledTimes(1);
  });

  it("does not reset the counter when the repeat message forces the {id} suffix", async () => {
    const { Command, bridge } = load();
    jest.useFakeTimers();
    const command = new Command({});

    command.send("/gc hello");

    for (let attempt = 0; attempt < 4; attempt++) {
      bot.emit("message", REPEAT_MESSAGE);
      await jest.advanceTimersByTimeAsync(300);
    }

    expect(bot.chat).toHaveBeenCalledTimes(5);
    expect(bot.chat).toHaveBeenLastCalledWith(FAILURE_MESSAGE);
    expect(bot.chat.mock.calls[1][0]).toMatch(/^\/gc hello \{[a-z0-9]{6}\}$/);
    expect(bridge.postToPeer).toHaveBeenCalledTimes(1);
  });

  it("only mirrors when n is 1", () => {
    const { Command, bridge } = load();
    const command = new Command({});

    command.send("/gc hello", 3);

    expect(bot.chat).toHaveBeenCalledWith("/gc hello");
    expect(bridge.postToPeer).not.toHaveBeenCalled();
  });
});
