/**
 * guildConfig.js - everything that ties this bot to one Hypixel guild.
 *
 * The same code runs Sky (TempestSky), Aria (TempestAria) and Shana (Bakacord);
 * the guild name, the Discord keyword that addresses this bot, the rank ladder
 * and the people exempt from kicks all come from `config.guild` (see
 * docs/config.md). Commands use these helpers instead of string literals.
 */
const fs = require("fs");
const config = require("../../config.json");

function guildSection() {
  return config.guild || {};
}

function guildName() {
  return String(guildSection().name || "");
}

function sameName(a, b) {
  return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
}

/** True when a Hypixel API guild object is this bot's guild. */
function isOwnGuild(guild) {
  if (!guild) return false;
  return sameName(guild.name_lower || guild.name, guildName());
}

/** True for this bot's guild or one of `guild.alliedGuilds`. */
function isMemberGuild(guild) {
  if (!guild) return false;
  if (isOwnGuild(guild)) return true;
  const allied = Array.isArray(guildSection().alliedGuilds) ? guildSection().alliedGuilds : [];
  return allied.some((name) => sameName(guild.name_lower || guild.name, name));
}

/** Hypixel `/v2/guild` URL for this bot's guild, looked up by name. */
function ownGuildUrl() {
  return `https://api.hypixel.net/v2/guild?key=${config.minecraft.API.hypixelAPIkey}&name=${encodeURIComponent(guildName())}`;
}

/**
 * Discord commands that both bots in one server receive (`!override sky ...`)
 * carry a keyword naming the bot. `args` is the whitespace-split message,
 * args[0] being the command itself.
 *
 * Returns { forUs, rest } where rest is the arguments after the command and
 * the keyword (if one was given).
 */
function matchKeyword(args) {
  const section = guildSection();
  const own = String(section.commandKeyword || "").toLowerCase();
  const peers = (Array.isArray(section.peerCommandKeywords) ? section.peerCommandKeywords : []).map((k) =>
    String(k).toLowerCase(),
  );
  const word = args.length > 1 ? String(args[1]).toLowerCase() : undefined;

  if (word !== undefined && own !== "" && word === own) {
    return { forUs: true, rest: args.slice(2), keyword: true };
  }
  if (word !== undefined && peers.includes(word)) {
    return { forUs: false, rest: args.slice(2), keyword: true };
  }
  if (section.requireKeyword === true) {
    return { forUs: false, rest: args.slice(1), keyword: false };
  }
  return { forUs: true, rest: args.slice(1), keyword: false };
}

function readLevelsFile() {
  const file = guildSection().ranks && guildSection().ranks.levelsFile;
  if (!file) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/**
 * The rank ladder from highest to lowest, each { name, level } where level is
 * a SkyBlock level. With `guild.ranks.levelsFile` set, the level of each rank
 * is read from that JSON file (key = lowercased rank name) on every call, so
 * edits to the file apply without a restart.
 */
function rankLadder() {
  const ranks = guildSection().ranks || {};
  const ladder = Array.isArray(ranks.ladder) ? ranks.ladder : [];
  const levels = readLevelsFile();

  return ladder.map((entry) => {
    const key = String(entry.name).toLowerCase();
    const level = levels && levels[key] !== undefined ? levels[key] : entry.level;
    return { name: entry.name, level: Number(level) || 0 };
  });
}

/**
 * Rank for a SkyBlock level: the highest rung whose level is reached; the
 * lowest rung is the default and has no minimum.
 */
function rankForLevel(level) {
  const ladder = rankLadder();
  if (ladder.length === 0) return undefined;
  for (let i = 0; i < ladder.length - 1; i++) {
    if (level >= ladder[i].level) return ladder[i].name;
  }
  return ladder[ladder.length - 1].name;
}

/** Same as rankForLevel, for SkyBlock experience (100 xp per level). */
function rankForExperience(experience) {
  return rankForLevel(experience / 100);
}

/** Level of the lowest rung: the guild's entry requirement. */
function minimumLevel() {
  const ladder = rankLadder();
  return ladder.length === 0 ? 0 : ladder[ladder.length - 1].level;
}

/** A fixed rank for one player UUID (`guild.ranks.overrides`), or undefined. */
function rankOverride(uuid) {
  const overrides = (guildSection().ranks && guildSection().ranks.overrides) || {};
  return typeof uuid === "string" ? overrides[uuid] : undefined;
}

/** Ranks that the auto-claim and kick jobs never touch (staff). */
function protectedRanks() {
  const ranks = guildSection().ranks || {};
  return Array.isArray(ranks.protected) ? ranks.protected : [];
}

function isProtectedRank(rank) {
  return protectedRanks().includes(rank);
}

/** Every rank name, staff first, then the ladder from high to low. */
function allRankNames() {
  return [...protectedRanks(), ...rankLadder().map((entry) => entry.name)];
}

/** Players the inactivity / requirement kicks skip (exact IGN match). */
function isKickExempt(name) {
  const list = Array.isArray(guildSection().kickExempt) ? guildSection().kickExempt : [];
  return list.includes(name);
}

/** Players `!kick` refuses to kick (case-insensitive). */
function isProtectedPlayer(name) {
  const list = Array.isArray(guildSection().protectedPlayers) ? guildSection().protectedPlayers : [];
  return typeof name === "string" && list.some((entry) => sameName(entry, name));
}

/**
 * Players allowed to run the in-game `!override` command (exact IGN, any
 * case). Without the key nobody is allowed.
 */
function isOverridePlayer(name) {
  const list = Array.isArray(guildSection().overridePlayers) ? guildSection().overridePlayers : [];
  return typeof name === "string" && list.some((entry) => sameName(entry, name));
}

/**
 * Players allowed to run the in-game `!blacklist` command (exact IGN, any
 * case). Without the key nobody is allowed.
 */
function isBlacklistEditor(name) {
  const list = Array.isArray(guildSection().blacklistEditors) ? guildSection().blacklistEditors : [];
  return typeof name === "string" && list.some((entry) => sameName(entry, name));
}

module.exports = {
  guildName,
  isOwnGuild,
  isMemberGuild,
  ownGuildUrl,
  matchKeyword,
  rankLadder,
  rankForLevel,
  rankForExperience,
  minimumLevel,
  rankOverride,
  protectedRanks,
  isProtectedRank,
  allRankNames,
  isKickExempt,
  isProtectedPlayer,
  isOverridePlayer,
  isBlacklistEditor,
};
