const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { getUsername } = require("../contracts/API/mowojangAPI.js");

const directory = path.join("data", "command-igns");

function readIfPresent(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

function setCommandIgn(discordId, uuid) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, discordId);
  const temporaryFile = path.join(directory, randomUUID());
  try {
    fs.writeFileSync(temporaryFile, uuid);
    fs.renameSync(temporaryFile, file);
  } finally {
    fs.rmSync(temporaryFile, { force: true });
  }
}

function clearCommandIgn(discordId) {
  fs.rmSync(path.join(directory, discordId), { force: true });
}

async function getCommandIgn(discordId) {
  const savedUuid = readIfPresent(path.join(directory, discordId));
  if (savedUuid) {
    try {
      return await getUsername(savedUuid);
    } catch (error) {
      if (error !== "Invalid UUID.") throw error;
    }
  }

  const verifiedUuid = JSON.parse(readIfPresent("data/linked.json") ?? "{}")[discordId];
  return verifiedUuid && verifiedUuid !== savedUuid ? getUsername(verifiedUuid) : null;
}

module.exports = { setCommandIgn, clearCommandIgn, getCommandIgn };
