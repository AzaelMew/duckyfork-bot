// Shared !kuudra shaping for the in-game and Discord commands.
// Both flavours print the same text; only the delivery differs.
const { getUUIDFromUsername, fetchProfiles, errorText } = require("./skyblockProfile.js");

// Text both commands print: "¨ **;" separates the fields and "\n➣ " precedes
// each value. The wrappers re-cut it for guild chat and for the embed.
function formatKuudraStats(profile) {
  const crimson = profile?.crimson;
  let faction = crimson.factions.selected_faction;
  if (faction == "mages") {
    faction = "Mage";
  } else if (faction == "barbarians") {
    faction = "Barbarian";
  } else {
    faction = "None";
  }
  const mage = crimson.factions.mages_reputation;
  const barbarian = crimson.factions.barbarians_reputation;
  const tiers = crimson.kuudra_completed_tiers;

  return "**Current Faction**:\n➣ " + faction + "¨ **;Mage Reputation**:\n➣ " + mage.toFixed(0) + "¨ **;Barbarian Reputation**:\n➣ " + barbarian.toFixed(0) + "¨ **;Basic**:\n➣ " + tiers.none.toFixed(0) + "¨ **;Hot**:\n➣ " + tiers.hot.toFixed(0) + "¨ **;Burning**:\n➣ " + tiers.burning.toFixed(0) + "¨ **;Fiery**:\n➣ " + tiers.fiery.toFixed(0) + "¨ **;Infernal**:\n➣ " + tiers.infernal.toFixed(0);
}

// Stats text for one UUID: "[ERROR] <reason>" when the proxy rejects, nothing
// for the skipped account, the text above otherwise.
async function getKuudraFromUUID(name) {
  try {
    const data = await fetchProfiles(name);
    if (data === undefined) {
      return undefined;
    }
    return formatKuudraStats(data.data[0]);
  } catch (error) {
    return errorText(error);
  }
}

async function getKuudraFromUsername(username) {
  return await getKuudraFromUUID(await getUUIDFromUsername(username));
}

module.exports = { getKuudraFromUsername, getKuudraFromUUID, formatKuudraStats };
