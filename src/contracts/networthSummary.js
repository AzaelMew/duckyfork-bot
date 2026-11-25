// Shared networth lookup for the in-game (!nw) and Discord (old) commands.
// Both commands fetch through this module so they use the same APIs and the
// same output; only the delivery (guild chat vs embed) differs.
const { getLatestProfile } = require("../../API/functions/getLatestProfile.js");
const { getMuseum } = require("../../API/functions/getMuseum.js");
const { getUsername } = require("./API/mowojangAPI.js");
const { ProfileNetworthCalculator } = require("skyhelper-networth");

const validName = /^[a-zA-Z0-9_]{2,16}$/;
const validUUID = /^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})$/;

// Errors with a message that is safe to show to users.
class NetworthError extends Error {}

const asNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function numberWithCommas(number) {
  number = asNumber(number);
  if (number < 1) {
    return 0;
  }
  number = number.toFixed(0);
  const decPlaces = 10;
  const abbrev = ["k", "m", "b", "t"];
  for (let i = abbrev.length - 1; i >= 0; i--) {
    const size = Math.pow(10, (i + 1) * 3);
    if (size <= number) {
      number = Math.round((number * decPlaces) / size) / decPlaces;
      if (number == 1000 && i < abbrev.length - 1) {
        number = 1;
        i++;
      }
      number += abbrev[i];
      break;
    }
  }
  return number;
}

function mainNum(x) {
  try {
    x = asNumber(x);
    if (x > 999815672) {
      x = x.toString().split(".")[0];
      x = x.toString().slice(0, -6) + "815672";
    } else {
      x = x.toString().split(".")[0];
    }
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } catch {
    return "API Off";
  }
}

// Fetch and calculate. Returns { username, text } where text uses the Discord
// markers: "˚" starts the message, "¨" separates fields, "\n➣" precedes values.
async function getNetworthSummary(target) {
  if (!validName.test(target) && !validUUID.test(target)) {
    throw new NetworthError("Invalid Minecraft username.");
  }

  const data = await getLatestProfile(target);
  const { profile, profileData, uuid } = data;
  let museum = data.museum;
  if (museum === undefined) {
    try {
      museum = (await getMuseum(profileData.profile_id, uuid)).museum;
    } catch (error) {
      console.warn("[NETWORTH MUSEUM]", error);
      museum = null;
    }
  }

  const username = validUUID.test(target) ? await getUsername(uuid).catch(() => target) : target;
  const calculator = new ProfileNetworthCalculator(profile, museum, profileData.banking?.balance ?? 0);
  const nw = await calculator.getNetworth({ onlyNetworth: true });
  if (nw.noInventory) {
    throw new NetworthError(username + " has Inventory API disabled!");
  }

  const total = asNumber(nw.networth);
  if (total <= 0) {
    throw new NetworthError(username + "'s networth is 0.");
  }

  const purse = asNumber(nw.purse);
  const bank = asNumber(nw.bank ?? profileData.banking?.balance);
  const personalBank = asNumber(nw.personalBank);
  const type = (name) => asNumber(nw.types?.[name]?.total);
  const storage = type("enderchest") + type("storage");

  const text =
    "˚**Total**:\n➣ $" + mainNum(total) +
    "¨ **Purse:**\n➣ $" + numberWithCommas(purse) +
    "¨ **Bank:**\n➣ $" + numberWithCommas(bank) + "/" + numberWithCommas(personalBank) +
    "¨ **Armor:**\n➣ $" + numberWithCommas(type("armor")) +
    "¨ **Equipment:**\n➣ $" + numberWithCommas(type("equipment")) +
    "¨ **Wardrobe:**\n➣ $" + numberWithCommas(type("wardrobe")) +
    "¨ **Inventory:**\n➣ $" + numberWithCommas(type("inventory")) +
    "¨ **Storage:**\n➣ $" + numberWithCommas(storage) +
    "¨ **Pets:**\n➣ $" + numberWithCommas(type("pets")) +
    "¨ **Talis:**\n➣ $" + numberWithCommas(type("accessories")) +
    "¨ **Museum:**\n➣ $" + numberWithCommas(type("museum")) +
    "¨ **Sacks:**\n➣ $" + numberWithCommas(type("sacks"));

  return { username, text };
}

// Guild-chat form of the summary (single line).
const toChatText = (text) =>
  text.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "").replaceAll("¨", "˚");

// Discord embed description form of the summary.
const toEmbedText = (text) => text.replaceAll("¨", "\n").replace("˚", "");

module.exports = { getNetworthSummary, NetworthError, toChatText, toEmbedText, numberWithCommas, mainNum };
