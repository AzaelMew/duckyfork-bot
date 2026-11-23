/* eslint-env jest */
const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const { Collection } = require("discord.js");
const CommandHandler = require("../src/discord/CommandHandler.js");
const IgnCommand = require("../src/discord/oldcommands/IgnCommand.js");
const NetworthCommand = require("../src/discord/oldcommands/NetworthCommand.js");
const RenderCommand = require("../src/discord/oldcommands/RenderCommand.js");

jest.mock("axios");
jest.mock("../config.json", () => {
  const config = jest.requireActual("../config.example.json");
  return {
    ...config,
    discord: { ...config.discord, commands: { ...config.discord.commands, prefix: "!" } },
  };
});
jest.mock("../src/Logger.js", () => ({ webMessage: jest.fn() }));
jest.mock("../src/contracts/bridge.js", () => ({ postToPeer: jest.fn() }));
jest.mock("prismarine-nbt", () => ({
  parse: (buffer, callback) => callback(null, {}),
  simplify: () => ({ i: [] }),
}));
jest.mock("skyhelper-networth", () => ({
  ProfileNetworthCalculator: class {
    async getNetworth() {
      return { networth: 42 };
    }
  },
}));

const root = process.cwd();
const callerId = "1001";
const savedUuid = "saved-uuid";
const otherUuid = "other-uuid";
const minecraft = { bot: {} };
let directory;
let handler;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "duckyfork-ign-"));
  process.chdir(directory);
  axios.get.mockReset();

  handler = Object.create(CommandHandler.prototype);
  handler.prefix = "!";
  const commands = [IgnCommand, NetworthCommand, RenderCommand].map((Command) => new Command({ app: { minecraft } }));
  handler.oldcommands = new Collection(commands.map((command) => [command.name, command]));
});

afterEach(() => {
  process.chdir(root);
  fs.rmSync(directory, { recursive: true, force: true });
});

function run(content, id = callerId) {
  return new Promise((resolve) => {
    handler.handle({ content, author: { id }, channel: { send: resolve } });
  });
}

function mockProfiles() {
  const profile = {
    selected: true,
    cute_name: "Apple",
    profile_id: "test-profile",
    members: { [savedUuid]: {}, [otherUuid]: {} },
  };
  const inventory = { inv_contents: { data: "AA==" } };
  const alternateProfile = {
    cute_name: "Mango",
    profile_id: "alternate-profile",
    selected: false,
    members: { [savedUuid]: { inventory }, [otherUuid]: { inventory } },
  };
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/ExampleIGN")) return { data: { id: savedUuid, name: "ExampleIGN" } };
    if (url.endsWith("/RenamedIGN")) return { data: { id: savedUuid, name: "RenamedIGN" } };
    if (url.endsWith("/OtherPlayer") || url.endsWith(`/${otherUuid}`)) return { data: { id: otherUuid, name: "OtherPlayer" } };
    if (url.endsWith(`/${savedUuid}`)) return { data: { id: savedUuid, name: "RenamedIGN" } };
    if (url.includes("/skyblock/profiles?")) return { data: { profiles: [profile, alternateProfile] } };
    if (url.includes("/skyblock/museum?")) return { data: { members: {} } };
    throw new Error(`Unexpected request: ${url}`);
  });
}

it("looks up the saved account for !nw and lets an explicit IGN override it", async () => {
  mockProfiles();
  expect(await run("!ign ExampleIGN")).toContain("ExampleIGN");
  expect(await run("!ign")).toContain("RenamedIGN");

  // The preference persists independently of command instances.
  handler.oldcommands.set("networth", new NetworthCommand({ app: { minecraft } }));
  const own = await run("!nw  ");
  expect(own.embeds[0].author.name).toBe("RenamedIGN's networth");
  expect(own.embeds[0].description).toContain("$42");
  const other = await run("!nw   OtherPlayer");
  expect(other.embeds[0].author.name).toBe("OtherPlayer's networth");
});

it("keeps preferences isolated and falls back to the existing verified account after clearing", async () => {
  mockProfiles();
  fs.mkdirSync("data");
  fs.writeFileSync("data/linked.json", JSON.stringify({ [callerId]: otherUuid }));
  expect(await run("!ign")).toContain("OtherPlayer");

  await run("!ign ExampleIGN");
  const calls = axios.get.mock.calls.length;
  expect(await run("!nw", "1002")).toContain("Save your IGN with `!ign <IGN>`");
  expect(axios.get).toHaveBeenCalledTimes(calls);

  await run("!ign --clear");
  expect(await run("!ign")).toContain("OtherPlayer");
  expect(JSON.parse(fs.readFileSync("data/linked.json", "utf8"))).toEqual({ [callerId]: otherUuid });
});

it("renders the saved player's slot and honors explicit player and profile syntax", async () => {
  mockProfiles();
  await run("!ign ExampleIGN");
  const own = await run("!render 3");
  expect(own.embeds[0].author.name).toBe("RenamedIGN");

  const ownProfile = await run("!render --me Mango 3");
  expect(ownProfile.embeds[0].author.name).toBe("RenamedIGN");
  expect(ownProfile.embeds[0].description).toContain("does not have an item in slot 3");
  const other = await run("!render OtherPlayer Mango 3");
  expect(other.embeds[0].author.name).toBe("OtherPlayer");
  expect(other.embeds[0].description).toContain("does not have an item in slot 3");
});
