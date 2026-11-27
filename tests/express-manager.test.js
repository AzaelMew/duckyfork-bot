/* eslint-env jest */
/**
 * src/express/ExpressManager.js - the peer-bridge HTTP API.
 *
 * The middleware methods are called directly with fake req/res objects, so no
 * port is opened. The fake app has no minecraft bot: every handler must answer
 * instead of throwing (the handlers used to call a nonexistent this.app.log).
 */
const fs = require("fs");
const path = require("path");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");
const TEST_TOKEN = "test-web-token";

function exampleConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
}

function apiConfig() {
  const config = exampleConfig();
  config.web = Object.assign({}, config.web, { enabled: true, token: TEST_TOKEN });
  config.bridge = {
    name: "Sky",
    peerUrl: "http://peer.test:3001",
    peerGuild: "aria",
    mirrorOnSend: true,
    relayBangCommands: true,
    peerRank: { rank: "VIP+", guildRank: "Elder" },
  };
  config.features = Object.assign({}, config.features, { retryOnRateLimit: true, peerDiscordRelay: true });
  config.paths = { blacklist: "./data/blacklist.txt" };
  config.discord.commands.enabled = "*";
  return config;
}

function loadManager() {
  mockConfig = apiConfig();
  jest.resetModules();
  // eslint-disable-next-line global-require
  const ExpressManager = require("../src/express/ExpressManager.js");
  return new ExpressManager({ minecraft: { bot: undefined } });
}

function fakeRequest(overrides) {
  return Object.assign(
    {
      ip: "127.0.0.1",
      originalUrl: "/api/mute",
      path: "/api/mute",
      headers: {},
      query: {},
      body: {},
    },
    overrides || {},
  );
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

let logSpy;
let errorSpy;

beforeEach(() => {
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  jest.restoreAllMocks();
});

describe("ExpressManager.authenticate", () => {
  it("rejects a token supplied only as ?key= without the Authorization header", () => {
    const manager = loadManager();
    const next = jest.fn();
    const response = fakeResponse();

    manager.authenticate(fakeRequest({ query: { key: TEST_TOKEN } }), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ success: false, reason: "Invalid or Missing Authentication" });
  });

  it("accepts the token in the Authorization header", () => {
    const manager = loadManager();
    const next = jest.fn();
    const response = fakeResponse();

    manager.authenticate(fakeRequest({ headers: { authorization: TEST_TOKEN } }), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
  });

  it("rejects a missing or wrong token", () => {
    const manager = loadManager();

    for (const headers of [{}, { authorization: "wrong" }]) {
      const next = jest.fn();
      const response = fakeResponse();

      manager.authenticate(fakeRequest({ headers }), response, next);

      expect(next).not.toHaveBeenCalled();
      expect(response.statusCode).toBe(401);
    }
  });
});

describe("ExpressManager.validateBody", () => {
  it("calls next() for a valid /api/mute body", () => {
    const manager = loadManager();
    const next = jest.fn();
    const response = fakeResponse();

    manager.validateBody(fakeRequest({ path: "/api/mute", body: { username: "Bob", duration: 3600 } }), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
  });

  it("answers 400 for a /api/mute body without a duration", () => {
    const manager = loadManager();
    const next = jest.fn();
    const response = fakeResponse();

    manager.validateBody(fakeRequest({ path: "/api/mute", body: { username: "Bob" } }), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ success: false, reason: "Malformed Body" });
  });

  it("calls next() for a valid /api/mutechat body", () => {
    const manager = loadManager();
    const next = jest.fn();
    const response = fakeResponse();

    manager.validateBody(fakeRequest({ path: "/api/mutechat", body: { author: "Bob", message: "hi" } }), response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
  });

  it("answers 400 for /api/mutechat without a message", () => {
    const manager = loadManager();
    const next = jest.fn();
    const response = fakeResponse();

    manager.validateBody(fakeRequest({ path: "/api/mutechat", body: { author: "Bob" } }), response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });
});

describe("ExpressManager handlers without a minecraft bot", () => {
  it("answers 409 from /api/command instead of throwing", () => {
    const manager = loadManager();
    const response = fakeResponse();

    manager.command(fakeRequest({ path: "/api/command", body: { message: "/gc hi" } }), response);

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({ success: false, reason: "Minecraft client is unavailable at this time" });
  });

  it("answers 409 from /api/mute", () => {
    const manager = loadManager();
    const response = fakeResponse();

    manager.mute(fakeRequest({ body: { username: "Bob", duration: 1 } }), response);

    expect(response.statusCode).toBe(409);
  });

  it("answers 500 from the async handlers instead of leaving the request hanging", async () => {
    const manager = loadManager();
    const response = fakeResponse();

    await expect(manager.online(fakeRequest({ path: "/api/online" }), response)).resolves.toBe(response);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ success: false, reason: "An error occurred while processing the request." });
  });
});
