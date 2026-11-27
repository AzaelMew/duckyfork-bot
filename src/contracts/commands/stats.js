// Shared !stats shaping for the in-game and Discord commands.
// Both print the same lines for a profile; the in-game command can also ask for
// a named SkyBlock profile, and only that one keeps the >999815672 networth
// quirk and shows magical power only on the fallback branch.
const { getUUIDFromUsername, fetchProfiles, numberWithCommas, round, levelWithOverflow } = require("./skyblockProfile.js");

// Numbers behind the printed line for one SkyBlock profile.
function shapeStats(player, capNetworth = true) {
  const level = (skill) => player?.skills?.[skill].level;
  const sa = round(
    (level("farming") + level("mining") + level("combat") + level("foraging") + level("fishing") + level("enchanting") + level("alchemy") + level("taming") + level("carpentry")) / 9,
    1,
  );
  const catacombs = player.dungeons?.catacombs?.skill;
  const cata = levelWithOverflow(catacombs?.levelWithProgress || 0, catacombs?.totalXp);
  const xp = (boss) => player?.slayer?.[boss].xp;

  return {
    skyblockLevel: player?.sblevel.toString().split(".")[0],
    sa,
    slayer: numberWithCommas(xp("wolf") + xp("zombie") + xp("spider") + xp("enderman") + xp("blaze") + xp("vampire")),
    cata,
    networth: numberWithCommas(player.networth.networth, capNetworth),
    magicalPower: player?.talismans?.mp,
  };
}

// Format both commands print. `profileName` is the explicitly requested profile
// ("**On Bob:**" prefix, no magical power); without it the fallback line is the
// first profile plus its magical power.
function formatStats(player, options = {}) {
  const { profileName, magicalPower = false, capNetworth = true } = options;
  const stats = shapeStats(player, capNetworth);

  if (profileName !== undefined) {
    return `**On ${profileName}:** \n**Skyblock Level:** \n➣ ${stats.skyblockLevel}; **Skill Avg:** \n➣ ${stats.sa}; **Slayer:** \n➣ ${stats.slayer}; **Cata:** \n➣ ${stats.cata.toFixed(2)}; **Networth:** \n➣ $${stats.networth};`;
  }

  return `˚**Skyblock Level:** \n➣ ${stats.skyblockLevel}; **Skill Avg:** \n➣ ${stats.sa}; **Slayer:** \n➣ ${stats.slayer}; **Cata:** \n➣ ${stats.cata.toFixed(2)}; **Networth:** \n➣ $${stats.networth};${magicalPower ? ` **Magical Power:** \n➣ ${stats.magicalPower}` : ""}`;
}

// Stats text for one UUID: the requested profile when `profile` matches one of
// them, otherwise the first profile. Nothing for the skipped account.
async function getStatsFromUUID(name, profile, options = {}) {
  if (profile == undefined) {
    profile = "a";
  }
  const data = await fetchProfiles(name);
  if (data === undefined) {
    return undefined;
  }
  console.log(data);

  const profiles = data.data;
  const keys = Object.keys(profiles);
  for (let i = 0; i < keys.length; i++) {
    if (profiles[i].name.toLowerCase() == profile.toLowerCase()) {
      return formatStats(profiles[i], { profileName: profile, capNetworth: options.capNetworth });
    }
    if (i == keys.length - 1) {
      return formatStats(profiles[0], { magicalPower: true, capNetworth: options.capNetworth });
    }
  }
  return undefined;
}

async function getStatsFromUsername(username, profile, options = {}) {
  return await getStatsFromUUID(await getUUIDFromUsername(username), profile, options);
}

module.exports = { getStatsFromUsername, getStatsFromUUID, formatStats, shapeStats };
