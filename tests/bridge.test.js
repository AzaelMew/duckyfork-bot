/* eslint-env jest */
/**
 * src/contracts/bridge.js - the single peer-call contract.
 *
 * The config is mocked so the tests can use a non-LAN peer URL and a fake
 * token; no real address or token appears in the repository.
 */
const fs = require("fs");
const path = require("path");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const EXAMPLE_PATH = path.join(__dirname, "..", "config.example.json");
const TEST_TOKEN = "test-web-token";

function exampleConfig() {
  return JSON.parse(fs.readFileSync(EXAMPLE_PATH, "utf8"));
}

function skyConfig(overrides) {
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
  config.features = { retryOnRateLimit: true, imageCompression: true };
  config.paths = { blacklist: "./data/blacklist.txt" };
  config.discord.commands.enabled = "*";
  return Object.assign(config, overrides || {});
}

function loadBridge(overrides) {
  mockConfig = skyConfig(overrides);
  jest.resetModules();
  // Requiring after resetModules gives the same axios mock instance that
  // bridge.js itself receives.
  // eslint-disable-next-line global-require
  const axiosMock = require("axios");
  // eslint-disable-next-line global-require
  const bridge = require("../src/contracts/bridge.js");
  axiosMock.post.mockReset();
  return { bridge, axios: axiosMock };
}

let errorSpy;

beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("bridge config", () => {
  it("exports the bot name from config.bridge.name", () => {
    const { bridge } = loadBridge();
    expect(bridge.name).toBe("Sky");
  });

  it("throws a clear error when bridge.peerGuild is missing", () => {
    const config = skyConfig();
    delete config.bridge.peerGuild;
    expect(() => loadBridge({ bridge: config.bridge })).toThrow(/config\.bridge\.peerGuild is required/);
  });

  it("throws a clear error when bridge.name is missing", () => {
    const config = skyConfig();
    delete config.bridge.name;
    expect(() => loadBridge({ bridge: config.bridge })).toThrow(/config\.bridge\.name is required/);
  });

  it("throws a clear error when bridge.peerUrl is missing", () => {
    const config = skyConfig();
    delete config.bridge.peerUrl;
    expect(() => loadBridge({ bridge: config.bridge })).toThrow(/config\.bridge\.peerUrl is required/);
  });

  it("throws a clear error when web.token is missing", () => {
    const config = skyConfig();
    delete config.web.token;
    expect(() => loadBridge({ web: config.web })).toThrow(/config\.web\.token is required/);
  });

  it("throws when bridge.peerUrl is not an absolute url", () => {
    const config = skyConfig();
    config.bridge = Object.assign({}, config.bridge, { peerUrl: "peer.test" });
    expect(() => loadBridge({ bridge: config.bridge })).toThrow(/not an absolute URL/);
  });

  it("warns but does not throw for the example placeholder peer", () => {
    const config = skyConfig();
    config.bridge = Object.assign({}, config.bridge, { peerUrl: "http://PEER_HOST:3001" });
    expect(() => loadBridge({ bridge: config.bridge })).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("placeholder"));
  });
});

describe("postToPeer", () => {
  it("posts the body to peerUrl + path with the config token", async () => {
    const { bridge, axios } = loadBridge();
    axios.post.mockResolvedValue({ data: { success: true } });

    const response = await bridge.postToPeer("/api/command", { message: "/gc hi" });

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith("http://peer.test:3001/api/command", { message: "/gc hi" }, {
      headers: { Authorization: TEST_TOKEN },
    });
    expect(response).toEqual({ data: { success: true } });
  });

  it("does not double the slash when peerUrl ends with one", async () => {
    const config = skyConfig();
    config.bridge = Object.assign({}, config.bridge, { peerUrl: "http://peer.test:3001/" });
    const { bridge, axios } = loadBridge({ bridge: config.bridge });
    axios.post.mockResolvedValue({ data: {} });

    await bridge.postToPeer("/api/message", { message: "x" });

    expect(axios.post.mock.calls[0][0]).toBe("http://peer.test:3001/api/message");
  });

  it("logs an offline peer on ECONNREFUSED and resolves instead of throwing", async () => {
    const { bridge, axios } = loadBridge();
    const error = new Error("connect ECONNREFUSED");
    error.code = "ECONNREFUSED";
    axios.post.mockRejectedValue(error);

    await expect(bridge.postToPeer("/api/command", { message: "x" })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("Connection refused: aria is offline");
  });

  it("logs other errors with their message", async () => {
    const { bridge, axios } = loadBridge();
    axios.post.mockRejectedValue(new Error("socket hang up"));

    await expect(bridge.postToPeer("/api/command", { message: "x" })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("An error occurred:", "socket hang up");
  });

  it("refuses a relative endpoint path without calling axios", async () => {
    const { bridge, axios } = loadBridge();

    await expect(bridge.postToPeer("api/command", { message: "x" })).resolves.toBeUndefined();
    expect(axios.post).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[bridge] postToPeer needs an absolute endpoint path, got:", "api/command");
  });
});
