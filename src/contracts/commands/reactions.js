// Shared reaction lookup for the in-game (src/minecraft/commands) and Discord
// (src/discord/oldcommands) reaction commands: pat, poke, slap, nom, slowclap,
// stab, fuckyou, bonk and 8ball.
//
// Every one of those commands used to carry its own copy of the same
// axios.get + 5 second cooldown (lastCalledTime.txt) and the 8ball answers were
// duplicated verbatim. The endpoints, the cooldown, the embed skeleton and the
// answers live here; the command classes keep only their own output text.
const fs = require("fs");
const axios = require("axios");
const config = require("../../../config.json");

// The cooldown is global: every reaction command reads and writes the same
// file, so a command run within 5 s of any other command gets this string back
// instead of an image url. The in-game commands do not special-case it (the
// text ends up as the embed image url, as before); the Discord ones answer
// with a cooldown embed instead.
const COOLDOWN_MESSAGE = "Please wait 5 seconds before running this command again";
const COOLDOWN_FILE = "lastCalledTime.txt";
const COOLDOWN_MS = 5000;

// reaction -> { urls, random?, authorization? }. `urls` holds more than one
// entry only for slowclap, which picked one of the two at random.
// `authorization` marks the waifu.it endpoints, which take the token from
// config.minecraft.API.waifuItKey.
const SOURCES = {
  pat: { urls: ["https://api.otakugifs.xyz/gif?reaction=pat"] },
  poke: { urls: ["https://api.otakugifs.xyz/gif?reaction=poke"] },
  slap: { urls: ["https://api.otakugifs.xyz/gif?reaction=slap"] },
  nom: { urls: ["https://api.otakugifs.xyz/gif?reaction=nom"] },
  slowclap: {
    urls: ["https://api.otakugifs.xyz/gif?reaction=slowclap", "https://api.otakugifs.xyz/gif?reaction=clap"],
    random: true,
  },
  stab: { urls: ["https://waifu.it/api/v4/stab"], authorization: true },
  fuckyou: { urls: ["https://waifu.it/api/v4/midfing"], authorization: true },
  bonk: { urls: ["https://waifu.it/api/v4/bonk"], authorization: true },
};

// Embed colour and footer used by every Discord reaction answer.
const EMBED_COLOR = 0x2a2a2a;
const EMBED_FOOTER = "BOT";

const EIGHT_BALL_ICON =
  "https://cdn.discordapp.com/attachments/1045517755044085762/1084545786886504508/mlfaJuO.png";

const EIGHT_BALL_ANSWERS = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful.",
  "No way.",
  "Maybe",
  "No.",
  "Depends on the mood of the RNGesus",
  "No",
  "Yes",
];

function pickUrl(source) {
  // slowclap picked url[Math.round(Math.random())] - keep the same pick so the
  // two endpoints stay equally likely.
  if (source.random) return source.urls[Math.round(Math.random())];
  return source.urls[0];
}

function requestOptions(source) {
  if (!source.authorization) return undefined;
  return { headers: { Authorization: config.minecraft.API.waifuItKey } };
}

// Resolves the reaction gif url, or COOLDOWN_MESSAGE when another reaction ran
// less than 5 s ago. Rejects with the axios error, or with a string when the
// response has no url.
function getReaction(name, options) {
  const source = SOURCES[name];
  if (!source) throw new Error(`Unknown reaction "${name}"`);

  const onData = options && options.onData;

  return new Promise((resolve, reject) => {
    try {
      const url = pickUrl(source);
      const headers = requestOptions(source);
      const request = headers === undefined ? axios.get(url) : axios.get(url, headers);

      request
        .then((response) => {
          const data = response.data;
          if (typeof onData === "function") onData(data);

          fs.readFile(COOLDOWN_FILE, "utf8", (err, fileData) => {
            if (err) reject(err);

            const lastRunTime = parseInt(fileData) || 0;
            const currentTime = new Date().getTime();
            const cooldownPassed = currentTime - lastRunTime >= COOLDOWN_MS;

            if (cooldownPassed) {
              fs.writeFile(COOLDOWN_FILE, currentTime.toString(), () => {
                if (data.url) {
                  resolve(data.url);
                } else {
                  reject("Invalid data format or no image URL found");
                }
              });
            } else {
              resolve(COOLDOWN_MESSAGE);
            }
          });
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject(error);
    }
  });
}

// The target of `!pat Bob Smith` is everything after the command word.
function parseTarget(message) {
  return message.split(" ").slice(1).join(" ");
}

// Discord-side target: null when the command was sent without an argument (the
// command then does nothing), otherwise the raw text for the embed and the text
// for guild chat, where a <@id> mention became the mentioned user's name.
function resolveDiscordTarget(message) {
  const args = message.content.split(" ");
  args.shift();
  const user = args.shift();

  const target = parseTarget(message.content);
  if (!user) return null;

  let mcuser = target;
  if (message?.mentions?.users?.first()) {
    mcuser = target.replace(`<@${message.mentions.users.first().id}>`, message.mentions.users.first().globalName);
  }

  return { target, mcuser };
}

// In-game delivery: the guild line plus the same line as an embed through the
// bridge. The resolved value is passed on unchanged, even when it is
// COOLDOWN_MESSAGE - the in-game commands always sent their line.
function sendReaction(command, username, reaction, guildMessage, embedMessage) {
  return getReaction(reaction).then((url) => {
    command.send(guildMessage);
    command.minecraft.broadcastFuckEmbed({ username: username, message: embedMessage, url: url });
    return url;
  });
}

function cooldownEmbed() {
  return {
    description: COOLDOWN_MESSAGE,
    color: EMBED_COLOR,
    timestamp: new Date(),
    footer: {
      text: EMBED_FOOTER,
    },
  };
}

function reactionEmbed(description, imageUrl) {
  return {
    description: description,
    image: {
      url: imageUrl,
    },
    color: EMBED_COLOR,
    timestamp: new Date(),
    footer: {
      text: EMBED_FOOTER,
    },
  };
}

// Discord delivery: guild chat after `delayMs` (350 for the commands that name
// a target, none for nom/slowclap) and the embed right away. On cooldown only
// the cooldown embed is sent and guild chat is left alone.
function runDiscordReaction(command, message, options) {
  return getReaction(options.reaction, options.getReactionOptions).then((result) => {
    if (result === COOLDOWN_MESSAGE) {
      message.channel.send({
        embeds: [cooldownEmbed()],
      });
      return result;
    }

    if (options.delayMs) {
      setTimeout(() => {
        command.sendMinecraftMessage(options.minecraftText);
      }, options.delayMs);
    } else {
      command.sendMinecraftMessage(options.minecraftText);
    }

    message.channel.send({
      embeds: [reactionEmbed(options.embedDescription, result)],
    });
    return result;
  });
}

async function askEightBall() {
  const index = Math.floor(Math.random() * Math.floor(EIGHT_BALL_ANSWERS.length));
  return EIGHT_BALL_ANSWERS[index];
}

module.exports = {
  COOLDOWN_MESSAGE,
  EIGHT_BALL_ANSWERS,
  EIGHT_BALL_ICON,
  SOURCES,
  askEightBall,
  getReaction,
  parseTarget,
  resolveDiscordTarget,
  runDiscordReaction,
  sendReaction,
};
