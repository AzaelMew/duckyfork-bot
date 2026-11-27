// Shared !cata shaping for the in-game and Discord commands.
// Both flavours print the same text; only the delivery differs.
const { getUUIDFromUsername, fetchProfiles, levelWithOverflow, errorText } = require("./skyblockProfile.js");

// Text both commands print: "˚" opens the message, "˚ **;" separates the
// fields and "\n➣ " precedes each value. The wrappers re-cut it for guild chat
// and for the embed.
function formatCataStats(profile) {
  const dungeons = profile?.dungeons;
  const classes = dungeons?.classes;

  const cata = levelWithOverflow(dungeons?.catacombs?.skill?.levelWithProgress || 0, dungeons?.catacombs?.skill?.totalXp);

  const healer = classes?.healer?.levelWithProgress || 0;
  const mage = classes?.mage?.levelWithProgress || 0;
  const archer = classes?.archer?.levelWithProgress || 0;
  const berserk = classes?.berserk?.levelWithProgress || 0;
  const tank = classes?.tank?.levelWithProgress || 0;
  // The average is taken before the 50+ overflow is added, as it always was.
  const average = (healer + mage + berserk + archer + tank) / 5;

  const h = levelWithOverflow(healer, classes?.healer?.totalXp);
  const m = levelWithOverflow(mage, classes?.mage?.totalXp);
  const b = levelWithOverflow(berserk, classes?.berserk?.totalXp);
  const a = levelWithOverflow(archer, classes?.archer?.totalXp);
  const t = levelWithOverflow(tank, classes?.tank?.totalXp);

  const secrets = profile.talismans.secrets;

  return "˚**Cata**:\n➣ " + cata.toFixed(2) + "˚ **;Average**:\n➣ " + average.toFixed(2) + "˚ **;Archer**:\n➣ " + a.toFixed(2) + "˚ **;Berserk**:\n➣ " + b.toFixed(2) + "˚ **;Healer**:\n➣ " + h.toFixed(2) + "˚ **;Mage**:\n➣ " + m.toFixed(2) + "˚ **;Tank**:\n➣ " + t.toFixed(2) + "˚ **;Secrets**:\n➣ " + secrets;
}

// Stats text for one UUID: "[ERROR] <reason>" when the proxy rejects, nothing
// for the skipped account, the text above otherwise.
async function getDungeonFromUUID(name) {
  try {
    const data = await fetchProfiles(name);
    if (data === undefined) {
      return undefined;
    }
    return formatCataStats(data.data[0]);
  } catch (error) {
    return errorText(error);
  }
}

async function getDungeonFromUsername(username) {
  return await getDungeonFromUUID(await getUUIDFromUsername(username));
}

module.exports = { getDungeonFromUsername, getDungeonFromUUID, formatCataStats };
