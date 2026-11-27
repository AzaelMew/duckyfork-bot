// Shared player lookup for the in-game and Discord !stalk and !seen commands.
//
// Both pairs of commands resolve a name the same way and query the same Hypixel
// endpoints; only the strings a failed lookup prints differ (and how !seen
// renders the logout time), so those are parameters. Delivery of the result -
// guild chat versus embed - stays in the command wrappers.
const config = require("../../../config.json");
const axios = require("axios");

// The bot's own account: status and seen lookups for it are skipped on purpose.
const SKIPPED_UUID = "f03695547707486ab2308518f04102f7";

// Minecraft name -> UUID. "Error" is returned for names that cannot exist (the
// command wrappers relied on that literal), while a failure of both APIs
// throws, exactly as before. Only the first dash is stripped from the ashcon
// uuid, as in the old code; Hypixel accepts both forms.
async function getUUIDFromUsername(username) {
  if (!(/^[a-zA-Z0-9_]{2,16}$/mg.test(username))) {
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

// Pure: a Hypixel /v2/status session -> the location text both bots print.
function locationFromSession(session) {
  if (session.online !== true) {
    return "Player is Offline";
  }

  switch (session.gameType) {
    case "SKYBLOCK":
      switch (session.mode) {
        case "garden": return "Garden";
        case "dynamic": return "Private Island";
        case "hub": return "The Hub";
        case "rift": return "The Rift";
        case "mining_1": return "Gold Mines";
        case "mining_2": return "Deep Caverns";
        case "mining_3": return "Dwarven Mines";
        case "foraging_1": return "The Park";
        case "foraging_2": return "Galatea";
        case "combat_1": return "Spider's Den";
        case "crimson_isle": return "Crimson Isle";
        case "combat_3": return "The End";
        case "farming_1": return "The Barn";
        case "crystal_hollows": return "Crystal Hollows";
        case "winter": return "Jerry's Workshop";
        case "dungeon": return "Dungeons";
        case "dungeon_hub": return "Dungeon Hub";
        case "fishing_1": return "Backwater Bayou";
        default: return "Unknown Skyblock Location";
      }

    case "PROTOTYPE":
      return "Prototype Lobby";

    case "MAIN":
      return "Main Lobby";

    case "BEDWARS":
      switch (session.mode) {
        case "LOBBY": return "Bedwars Lobby";
        case "BEDWARS_EIGHT_ONE": return "Solo Bedwars";
        case "BEDWARS_EIGHT_TWO": return "Duo Bedwars";
        case "BEDWARS_FOUR_THREE": return "3's Bedwars";
        case "BEDWARS_FOUR_FOUR": return "4's Bedwars";
        case "BEDWARS_TWO_FOUR": return "4v4 Bedwars";
        default: return "Unknown Bedwars Mode";
      }

    case "SKYWARS":
      switch (session.mode) {
        case "LOBBY": return "Skywars Lobby";
        case "solo_normal": return "Skywars Solo Normal";
        case "teams_normal": return "Skywars Teams Normal";
        case "solo_insane": return "Skywars Solo Insane";
        case "teams_insane": return "Skywars Teams Insane";
        default: return "Unknown Skywars Mode";
      }

    case "MURDER_MYSTERY":
      return "Murder Mystery Lobby";

    case "HOUSING":
      return session.mode === "base" ? "Someone's Housing" : "Housing Lobby";

    case "ARCADE":
      return "Arcade Lobby";

    case "BUILD_BATTLE":
      return "Build Battle Lobby";

    case "DUELS":
      return session.mode === "LOBBY" ? "Duels Lobby" : "Duels Game";

    case "TNTGAMES":
      switch (session.mode) {
        case "TNTRUN": return "TNT Run";
        case "TNTTAG": return "TNT Tag";
        case "LOBBY": return "TNT Games Lobby";
        default: return "Unknown TNT Game Mode";
      }

    case "SMP":
      return "Hypixel SMP";

    default:
      return "Unknown Game Type";
  }
}

// `options.apiErrorText` is what a failed status request prints (the in-game
// command says "Player doesn't exist", Discord says "Error"), and
// `options.onApiError` receives the error so Discord can log it.
async function getLocationFromUUID(uuid, options = {}) {
  const { apiErrorText = "Error", onApiError } = options;

  if (uuid === SKIPPED_UUID) {
    return undefined;
  }

  try {
    const { data } = await axios.get(`https://api.hypixel.net/v2/status?key=${config.minecraft.API.hypixelAPIkey}&uuid=` + uuid);
    return locationFromSession(data.session);
  } catch (error) {
    if (onApiError) {
      onApiError(error);
    }

    return apiErrorText;
  }
}

async function getLocationFromUsername(username, options) {
  return getLocationFromUUID(await getUUIDFromUsername(username), options);
}

// "1m 36s " style duration, unchanged from the copies this replaces (including
// its rounding quirks, which the fixtures in tests/lookup-shared.test.js lock).
function timeSince(t1, t2) {
  let secondsDiff = (t1 - t2) / 1000;
  let minutesDiff = secondsDiff / 60;
  let hoursDiff = minutesDiff / 60;
  let daysDiff = hoursDiff / 24;
  let yearsDiff = daysDiff / 365.25;

  if (secondsDiff > 60 * Math.floor(minutesDiff)) {
    secondsDiff -= 60 * Math.floor(minutesDiff);
  }

  if (minutesDiff > 60 * Math.floor(hoursDiff)) {
    minutesDiff -= 60 * Math.floor(hoursDiff);
  }

  if (hoursDiff > 24 * Math.floor(daysDiff)) {
    hoursDiff -= 24 * Math.floor(daysDiff);
  }

  if (daysDiff > 365.25 * Math.floor(yearsDiff)) {
    daysDiff -= 365.25 * Math.floor(yearsDiff);
  }

  Math.floor(secondsDiff) === 0
    ? (secondsDiff = "")
    : (secondsDiff = `${Math.floor(secondsDiff)}s `);
  Math.floor(minutesDiff) === 0
    ? (minutesDiff = "")
    : (minutesDiff = `${Math.floor(minutesDiff)}m `);
  Math.floor(hoursDiff) === 0
    ? (hoursDiff = "")
    : (hoursDiff = `${Math.floor(hoursDiff)}h `);
  Math.floor(daysDiff) === 0
    ? (daysDiff = "")
    : (daysDiff = `${Math.floor(daysDiff)}d `);
  Math.floor(yearsDiff) === 0
    ? (yearsDiff = "")
    : (yearsDiff = `${Math.floor(yearsDiff)}y `);

  return yearsDiff + daysDiff + hoursDiff + minutesDiff + secondsDiff;
}

// Raw Hypixel /v2/player payload (throws on a failed request, as before).
async function fetchPlayer(uuid) {
  const { data } = await axios.get(`https://api.hypixel.net/v2/player?key=${config.minecraft.API.hypixelAPIkey}&uuid=${uuid}`);
  return data;
}

// Pure (given `now`): a Hypixel player object -> the "seen" sentence.
// `options.format` is "discord" for a <t:...:F> timestamp, otherwise the UTC
// date string the in-game command speaks.
function describeSeen(player, options = {}) {
  const now = options.now ?? Date.now();

  if (player.lastLogout == null) {
    return "Api is Disabled";
  }

  if (player.lastLogin > player.lastLogout) {
    const onlineFor = timeSince(now, player.lastLogin).toString().trim();
    return `Has been online for ${onlineFor}`;
  }

  const offlineFor = timeSince(now, player.lastLogout).toString().trim();
  const lastSeen =
    options.format === "discord"
      ? `<t:${player.lastLogout.toString().slice(0, -3)}:F>`
      : new Date(player.lastLogout).toUTCString();
  return `Has been offline for ${offlineFor}, \nThey last logged out ${lastSeen}`;
}

module.exports = {
  SKIPPED_UUID,
  getUUIDFromUsername,
  locationFromSession,
  getLocationFromUUID,
  getLocationFromUsername,
  timeSince,
  fetchPlayer,
  describeSeen,
};
