// Shared logic for the random-picture commands: !cat/!dog/!neko/!duck in-game
// and their Discord (`oldcommands`) counterparts.
//
// The eight commands only differ in where the picture comes from, where it is
// delivered and whether they have a cooldown, so the STuF encoder, the Imgur
// re-upload, the per-source fetch and the 5 s cooldown live here. Chat text,
// embed layout, file names and API sources are unchanged.
const fs = require("fs");
const axios = require("axios");
const uploader = require("../Imgur/imgurExport.js");

const COOLDOWN_MS = 5000;
const COOLDOWN_MESSAGE = "Please wait 5 seconds before running this command again";
const EMBED_COLOUR = 0x2a2a2a;

// Where each command gets its picture. `pick` mirrors the field each command
// read before: thecatapi returns an array, dog.ceo has a `message` field,
// nekos.best has `results[0]`, random-d.uk a bare `url`.
//
// The two failure texts keep their original punctuation, including the copy
// pasted from the cat command into the duck one ("for cat picture").
const SOURCES = {
  cat: {
    url: "https://api.thecatapi.com/v1/images/search",
    pick: (data) => data[0].url,
    label: "getCatPic",
    noImage: "Failed to get Imgur ID for cat picture, try again in a few seconds",
    failure: "Failed to get Imgur ID for cat picture, try again in a few seconds",
  },
  dog: {
    url: "https://dog.ceo/api/breeds/image/random",
    pick: (data) => data.message,
    label: "getDogPic",
    noImage: "Failed to get Imgur ID for dog picture, try again in a few seconds",
    failure: "Failed to get dog picture",
  },
  neko: {
    url: "https://nekos.best/api/v2/neko",
    pick: (data) => data.results[0].url,
    label: "getCatPic",
    noImage: "Failed to get Imgur ID for cat picture, try again in a few seconds",
    failure: "Failed to get neko picture",
  },
  duck: {
    url: "https://random-d.uk/api/v2/random",
    pick: (data) => data.url,
    label: "getCatPic",
    noImage: "Failed to get Imgur ID for cat picture, try again in a few seconds",
    failure: "Failed to get cat picture",
  },
};

// STuF encoding used by the guild-chat line. Hypixel collapses long URLs, so the
// commands ship the picture as this compact string and the client decodes it.
function charInc(str, int) {
  const charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let incrementedStr = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = charSet.indexOf(char);

    if (index == -1) {
      incrementedStr += char;
    } else {
      let offset = index + int;
      while (offset >= charSet.length) {
        offset -= charSet.length;
      }
      while (offset < 0) {
        offset += charSet.length;
      }
      incrementedStr += charSet[offset];
    }
  }
  return incrementedStr;
}

function decode(string) {
  if (!string.startsWith("l$")) {
    throw new Error("String does not appear to be in STuF");
  }
  const prefix = string[2];
  const suffix = string[3];
  const dotIndices = string
    .slice(4, string.indexOf("|"))
    .split("")
    .map(Number);
  const urlBody = string.slice(string.indexOf("|") + 1);

  const first9 = urlBody.slice(0, 9 - dotIndices.length);
  const then = urlBody.slice(9 - dotIndices.length).replace(/\^/g, ".");

  let url = first9 + then;
  url = charInc(url, -1);

  // Restore the dots in the first part of the URL
  dotIndices.forEach((index) => {
    url = url.slice(0, index) + "." + url.slice(index);
  });

  // Add the prefix back
  if (prefix === "h") {
    url = "http://" + url;
  } else if (prefix === "H") {
    url = "https://" + url;
  }

  // Add the suffix back
  if (suffix === "1") {
    url += ".png";
  } else if (suffix === "2") {
    url += ".jpg";
  } else if (suffix === "3") {
    url += ".jpeg";
  } else if (suffix === "4") {
    url += ".gif";
  }

  return url;
}

function Encode(url) {
  let encoded = "l$";
  if (url.startsWith("http://")) {
    encoded += "h";
    url = url.slice(7); // Remove the 'http://' part
  } else if (url.startsWith("https://")) {
    encoded += "H";
    url = url.slice(8); // Remove the 'https://' part
  }

  if (url.endsWith(".png")) {
    encoded += "1";
    url = url.slice(0, -4); // Remove the '.png' part
  } else if (url.endsWith(".jpg")) {
    encoded += "2";
    url = url.slice(0, -4); // Remove the '.jpg' part
  } else if (url.endsWith(".jpeg")) {
    encoded += "3";
    url = url.slice(0, -5); // Remove the '.jpeg' part
  } else if (url.endsWith(".gif")) {
    encoded += "4";
    url = url.slice(0, -4); // Remove the '.gif' part
  } else {
    encoded += "0";
  }

  const dotIndices = [];
  for (let i = 0; i < url.length && i <= 8; i++) {
    if (url[i] === ".") {
      dotIndices.push(i);
      if (dotIndices.length === 9) break; // Stop after 9 dots
    }
  }

  let first9 = url.substring(0, 9);
  const then = url.substring(9).replace(/\./g, "^");
  first9 = first9.replace(/\./g, "");
  const shifted = charInc(first9 + then, 1);

  encoded += dotIndices.map((index) => index.toString()).join("") + "|";
  encoded += shifted;

  return encoded;
}

// Re-upload the picture to Imgur: Hypixel drops links it does not trust and the
// source APIs are sometimes slow, so everything goes through this host first.
async function upload(imageUrl) {
  try {
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });

    const response = await uploader.uploadBuffer(imageResponse.data);
    return response;
  } catch (error) {
    console.error("Upload Failed", error.message);
    throw error; // Rethrow the error for the caller to handle
  }
}

// Source URL -> Imgur URL. Returns null on any failure, as the per-command copy
// of this function always did.
async function imgurUrl(url, pick) {
  try {
    const response = await axios.get(url);
    const imageUrl = pick(response.data);
    const imageLink = await upload(imageUrl);
    return imageLink.url;
  } catch (error) {
    console.error("imgurID Failed", error.message);
    return null;
  }
}

// Raw picture URL from the source API (no Imgur hop). Rejects on network errors.
async function fetchImage(name) {
  const source = SOURCES[name];
  const response = await axios.get(source.url);
  return source.pick(response.data);
}

// Imgur-hosted picture URL, or the command's original failure text.
async function getImage(name) {
  const source = SOURCES[name];
  try {
    const imageUrl = await imgurUrl(source.url, source.pick);
    return imageUrl || source.noImage;
  } catch (error) {
    console.error(source.label + " Failed", error.message);
    return source.failure;
  }
}

// Milliseconds left on the cooldown, 0 when the command may run.
function cooldownRemaining(lastRunTime, now = Date.now(), cooldownMs = COOLDOWN_MS) {
  const last = parseInt(lastRunTime, 10) || 0;
  const elapsed = now - last;
  return elapsed >= cooldownMs ? 0 : cooldownMs - elapsed;
}

// The cooldown timestamp lives in a file in the working directory that index.js
// creates at boot (lastCalledTime.txt / lastDogCalledTime.txt).
function readLastRun(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, "utf8", (error, fileData) => {
      if (error) return reject(error);
      resolve(parseInt(fileData, 10) || 0);
    });
  });
}

// The write result was never used, so an I/O error stays ignored.
function writeLastRun(filename, time) {
  return new Promise((resolve) => {
    fs.writeFile(filename, time.toString(), () => resolve());
  });
}

// Fetch, then check the cooldown: the original Discord dog command reached
// dog.ceo before looking at the timestamp, so a blocked call still hits the API.
async function fetchWithCooldown(name, filename) {
  const imageUrl = await fetchImage(name);
  const lastRun = await readLastRun(filename);
  const now = Date.now();
  if (cooldownRemaining(lastRun, now) > 0) return COOLDOWN_MESSAGE;
  await writeLastRun(filename, now);
  return imageUrl;
}

// In-game delivery: the STuF line to guild chat plus the bridge image broadcast.
function announceImage(command, username, imageUrl) {
  command.send(`/gc ${Encode(imageUrl)}`);
  command.minecraft.broadcastNewImage({
    username: username,
    image: `${imageUrl}`,
    icon: "https://minotar.net/helm/" + username + ".png",
  });
}

function sendImageEmbed(channel, imageUrl) {
  return channel.send({
    embeds: [
      {
        image: {
          url: imageUrl,
        },
        color: EMBED_COLOUR,
        timestamp: new Date(),
        footer: {
          text: "BOT",
        },
      },
    ],
  });
}

function sendCooldownEmbed(channel) {
  return channel.send({
    embeds: [
      {
        description: COOLDOWN_MESSAGE,
        color: EMBED_COLOUR,
        timestamp: new Date(),
        footer: {
          text: "BOT",
        },
      },
    ],
  });
}

module.exports = {
  COOLDOWN_MS,
  COOLDOWN_MESSAGE,
  SOURCES,
  charInc,
  decode,
  Encode,
  upload,
  imgurUrl,
  fetchImage,
  getImage,
  cooldownRemaining,
  readLastRun,
  writeLastRun,
  fetchWithCooldown,
  announceImage,
  sendImageEmbed,
  sendCooldownEmbed,
};
