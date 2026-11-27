// Shared !skills lookup for the in-game and Discord commands.
// The two commands word the output differently (different "˚" placement, short
// vs long skill names, trailing separator), so only the profile parsing and the
// skill average live here; each command keeps its own text.
const { getUUIDFromUsername, fetchProfiles, round, errorText } = require("./skyblockProfile.js");

// Order the commands print, and the subset the average has always used
// (runecrafting and social are displayed but not averaged).
const SKILL_FIELDS = [
  "farming",
  "mining",
  "combat",
  "foraging",
  "fishing",
  "enchanting",
  "alchemy",
  "carpentry",
  "runecrafting",
  "social",
  "taming",
];
const AVERAGE_FIELDS = ["farming", "mining", "combat", "foraging", "fishing", "enchanting", "alchemy", "taming", "carpentry"];

// { sa, levels } for one profile; levels keeps the proxy names.
function shapeSkills(profile) {
  const levels = {};
  for (const name of SKILL_FIELDS) {
    levels[name] = profile?.skills?.[name].level;
  }
  const total = AVERAGE_FIELDS.reduce((sum, name) => sum + levels[name], 0);
  return { sa: round(total / 9, 1), levels };
}

// { sa, levels } on success, { error: "[ERROR] <reason>" } when the proxy
// rejects, undefined for the skipped account. Callers print their own wording.
async function getSkillsFromUsername(username) {
  try {
    const data = await fetchProfiles(await getUUIDFromUsername(username));
    if (data === undefined) {
      return undefined;
    }
    return shapeSkills(data.data[0]);
  } catch (error) {
    return { error: errorText(error) };
  }
}

module.exports = { getSkillsFromUsername, shapeSkills, SKILL_FIELDS, AVERAGE_FIELDS };
