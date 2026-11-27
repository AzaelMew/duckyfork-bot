// Shared SkyBlock profile lookup for the in-game and Discord stats commands
// (!cata, !kuudra, !skills, !slayer, !stats).
// The IGN -> UUID -> stats proxy flow lives here so each pair uses the same
// address, key and field names; every command keeps its own output text and
// delivery (guild chat vs embed).
const axios = require("axios");
const config = require("../../../config.json");

// The proxy errors on this account and the commands have always answered
// nothing for it instead of printing an error.
const SKIPPED_UUID = "f03695547707486ab2308518f04102f7";

// Level 50 is the display cap for dungeon/skill levels: past it the commands
// show the overflow as a fraction of the next level's XP requirement.
const LEVEL_50_XP = 569809640;
const XP_PER_OVERFLOW_LEVEL = 200000000;

async function getUUIDFromUsername(username) {
  if (!/^[a-zA-Z0-9_]{2,16}$/mg.test(username)) {
    return "Error";
  }
  try {
    const { data } = await axios.get("https://api.mojang.com/users/profiles/minecraft/" + username);
    return data.id;
  } catch {
    const { data } = await axios.get("https://api.ashcon.app/mojang/v2/user/" + username);
    return data.uuid.replace("-", "");
  }
}

// Raw body of GET {statsProxyUrl}/v1/profiles/<uuid> (one entry per SkyBlock
// profile). "a" is the placeholder the commands have always sent when the
// lookup produced no UUID; the proxy answers 404 and the caller prints its
// reason. Returns undefined for SKIPPED_UUID.
async function fetchProfiles(name) {
  if (name == undefined) {
    name = "a";
  }
  if (name == SKIPPED_UUID) {
    return undefined;
  }
  const { data } = await axios.get(`${config.minecraft.API.statsProxyUrl}/v1/profiles/${name}?key=${config.minecraft.API.statsProxyKey}`);
  return data;
}

function levelWithOverflow(level, totalXp) {
  if (level == 50) {
    return level + (totalXp - LEVEL_50_XP) / XP_PER_OVERFLOW_LEVEL;
  }
  return level;
}

// `capped` keeps the >999815672 quirk of the in-game commands; the Discord
// !stats has always printed the plain number.
function numberWithCommas(x, capped = true) {
  if (capped && x > 999815672) {
    x = x.toString().split(".")[0];
    x = x.toString().slice(0, -6) + "815672";
  } else {
    x = x.toString().split(".")[0];
  }
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function round(value, precision) {
  var multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

// The proxy reports its own failures in the body; the commands print that
// reason behind the "[ERROR]" marker they test for.
const errorText = (error) => `[ERROR] ${error.response.data.reason}`;

module.exports = {
  SKIPPED_UUID,
  getUUIDFromUsername,
  fetchProfiles,
  levelWithOverflow,
  numberWithCommas,
  round,
  errorText,
};
