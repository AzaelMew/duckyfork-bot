// Shared !slayer shaping for the in-game and Discord commands.
// Both flavours print the same stats text; they disagree on error wording, so
// the two wordings are exported separately and each command picks its own.
const { getUUIDFromUsername, fetchProfiles, numberWithCommas, errorText } = require("./skyblockProfile.js");

const SLAYER_BOSSES = [
  ["zombie", "Zombie"],
  ["spider", "Spider"],
  ["wolf", "Wolf"],
  ["enderman", "Enderman"],
  ["blaze", "Blaze"],
  ["vampire", "Vampire"],
];

// Text both commands print: "˚" opens the message, "˚ **;" separates the fields
// and "\n➣  " (two spaces) precedes each value.
function formatSlayerStats(profile) {
  const slayer = profile?.slayer;
  const xp = (boss) => slayer?.[boss].xp;
  const total = numberWithCommas(xp("wolf") + xp("zombie") + xp("spider") + xp("enderman") + xp("blaze") + xp("vampire"));

  let text = `˚**Total Slayer EXP**:\n➣  ${total}`;
  for (const [boss, label] of SLAYER_BOSSES) {
    text += `; **${label} level**:\n➣  ${slayer?.[boss].level} - ${numberWithCommas(xp(boss))}xp`;
  }
  return text;
}

// Throws on a proxy/parse failure; the callers turn that into their own error
// line (in-game: "is an Invalid Username", Discord: "[ERROR] <reason>").
async function getSlayerFromUUID(name) {
  const data = await fetchProfiles(name);
  if (data === undefined) {
    return undefined;
  }
  return formatSlayerStats(data.data[0]);
}

async function getSlayerFromUser(username) {
  return await getSlayerFromUUID(await getUUIDFromUsername(username));
}

// In-game wording for the same failures the Discord command prints verbatim.
function slayerErrorText(error) {
  const message = error.message;
  if (message.includes("status code 500")) {
    return "is an Invalid Username";
  }
  if (message.includes("status code 404")) {
    return "has no Skyblock Profiles";
  }
  return error;
}

module.exports = { getSlayerFromUser, getSlayerFromUUID, formatSlayerStats, slayerErrorText, errorText };
