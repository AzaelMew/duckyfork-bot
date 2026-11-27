/* eslint-env jest */
/**
 * src/minecraft/commands/BlacklistCommand.js - the in-game !blacklist command.
 *
 * The file path comes from config.paths.blacklist, the editor list from
 * guild.blacklistEditors and the UUID from contracts/API/mowojangAPI.getUUID
 * (the same function the join-request check uses, so the stored id is in the
 * format ChatHandler compares against). Player names below are test values.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("../src/contracts/API/mowojangAPI.js");

const { getUUID } = require("../src/contracts/API/mowojangAPI.js");
const config = require("../config.json");
const BlacklistCommand = require("../src/minecraft/commands/BlacklistCommand.js");

const EDITOR = "editor_ign";
const UUID_ONE = "00000000000000000000000000000001";
const UUID_TWO = "00000000000000000000000000000002";

let directory;
let blacklistPath;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "blacklist-command-"));
  blacklistPath = path.join(directory, "blacklist.txt");
  fs.writeFileSync(blacklistPath, "");

  config.paths.blacklist = blacklistPath;
  config.guild.blacklistEditors = [EDITOR];

  getUUID.mockReset();

  global.bot = { chat: jest.fn(), _client: { chat: jest.fn() } };
});

afterEach(() => {
  delete global.bot;
  fs.rmSync(directory, { recursive: true, force: true });
});

function command() {
  const blacklist = new BlacklistCommand({});
  blacklist.send = jest.fn();
  return blacklist;
}

function fileContents() {
  return fs.readFileSync(blacklistPath, "utf-8");
}

test("add, check, remove and check again rewrite config.paths.blacklist", async () => {
  getUUID.mockResolvedValue(UUID_ONE);
  const blacklist = command();

  await blacklist.onCommand(EDITOR, "!blacklist add Player");
  expect(fileContents()).toBe(`${UUID_ONE}\n`);
  expect(blacklist.send).toHaveBeenLastCalledWith(`/oc Player ${UUID_ONE} added to blacklist.`);

  await blacklist.onCommand(EDITOR, "!blacklist check Player");
  expect(blacklist.send).toHaveBeenLastCalledWith("/oc Player is blacklisted.");

  await blacklist.onCommand(EDITOR, "!blacklist remove Player");
  expect(fileContents()).toBe("");
  expect(blacklist.send).toHaveBeenLastCalledWith(`/oc Player ${UUID_ONE} removed from blacklist.`);

  await blacklist.onCommand(EDITOR, "!blacklist check Player");
  expect(blacklist.send).toHaveBeenLastCalledWith("/oc Player is not in the blacklist.");
});

test("remove of a player that is not listed says so and leaves the file alone", async () => {
  fs.writeFileSync(blacklistPath, `${UUID_ONE}\n`);
  getUUID.mockResolvedValue(UUID_TWO);
  const blacklist = command();

  await blacklist.onCommand(EDITOR, "!blacklist remove Player");
  expect(blacklist.send).toHaveBeenLastCalledWith("/oc Player is not in the blacklist.");
  expect(fileContents()).toBe(`${UUID_ONE}\n`);
});

test("an invalid username is reported and never written to the blacklist", async () => {
  getUUID.mockRejectedValue("Invalid username.");
  const blacklist = command();

  await blacklist.onCommand(EDITOR, "!blacklist add Ghost");
  expect(blacklist.send).toHaveBeenLastCalledWith("/oc Ghost is not a valid username.");
  expect(fileContents()).toBe("");

  await blacklist.onCommand(EDITOR, "!blacklist check Ghost");
  expect(blacklist.send).toHaveBeenLastCalledWith("/oc Ghost is not a valid username.");
  expect(fileContents()).toBe("");
});

test("only the configured editors can run it, with an exact name match", async () => {
  getUUID.mockResolvedValue(UUID_ONE);
  const blacklist = command();

  await blacklist.onCommand(`${EDITOR}_two`, "!blacklist add Player");
  await blacklist.onCommand("Azael_Nyan", "!blacklist add Player");
  await blacklist.onCommand("Player", "!blacklist add Player");

  expect(getUUID).not.toHaveBeenCalled();
  expect(blacklist.send).not.toHaveBeenCalled();
  expect(fileContents()).toBe("");

  await blacklist.onCommand(EDITOR.toUpperCase(), "!blacklist add Player");
  expect(blacklist.send).toHaveBeenCalledTimes(1);
});

test("compares whole lines, not substrings of the file", async () => {
  // UUID_ONE starts with UUID_TWO's first 31 characters: a substring check
  // would treat the second player as already listed.
  fs.writeFileSync(blacklistPath, `${UUID_ONE}\n`);
  getUUID.mockResolvedValue(UUID_ONE.slice(0, 31));
  const blacklist = command();

  await blacklist.onCommand(EDITOR, "!blacklist check Player");
  expect(blacklist.send).toHaveBeenLastCalledWith("/oc Player is not in the blacklist.");

  await blacklist.onCommand(EDITOR, "!blacklist add Player");
  expect(fileContents()).toBe(`${UUID_ONE}\n${UUID_ONE.slice(0, 31)}\n`);
});

test("adds a newline before appending when the file does not end with one", async () => {
  fs.writeFileSync(blacklistPath, UUID_ONE);
  getUUID.mockResolvedValue(UUID_TWO);
  const blacklist = command();

  await blacklist.onCommand(EDITOR, "!blacklist add Player");
  expect(fileContents()).toBe(`${UUID_ONE}\n${UUID_TWO}\n`);
});
