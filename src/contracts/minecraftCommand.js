const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const helperFunctions = require("./helperFunctions.js");
const bridge = require("./bridge.js");
const config = require("../../config.json");

// Hypixel answers a guild line with these two messages when it does not deliver
// it. The rate-limit listener below retries the line (Aria's behaviour, kept
// behind config.features.retryOnRateLimit) instead of losing it.
const RATE_LIMIT_MESSAGE = "You are sending commands too fast! Please slow down.";
const REPEAT_MESSAGE = "You cannot say the same message twice!";
const RETRY_ATTEMPTS = 5;

class minecraftCommand {
  constructor(minecraft) {
    this.minecraft = minecraft;
  }

  getArgs(message) {
    const args = message.split(" ");

    args.shift();

    return args;
  }

  send(message, n = 1) {
    if (typeof bot === "undefined" || bot?._client?.chat === undefined) {
      return;
    }
    // Only the first attempt mirrors the line to the peer: every retry sends
    // the same line again, so re-posting it would duplicate it on the peer.
    if (n === 1) {
      bridge.postToPeer("/api/command", { message: message });
    }

    // Keep the bot this line was sent on: a reconnect replaces global.bot, and
    // the listener and its cleanup timer must stay on the old one.
    const client = bot;
    let listener;

    if (config.features.retryOnRateLimit) {
      listener = async (msg) => {
        if (msg.toString().includes(RATE_LIMIT_MESSAGE) && !msg.toString().includes(":")) {
          client.removeListener("message", listener);
          n++;

          if (n >= RETRY_ATTEMPTS) {
            return this.warpSend("/gc Command failed to send message after 5 attempts. Please try again later.");
          }

          await delay(250);

          return this.send(message, n);
        } else if (msg.toString().includes(REPEAT_MESSAGE) === true && msg.toString().includes(":") === false) {
          client.removeListener("message", listener);
          n++;

          if (n >= RETRY_ATTEMPTS) {
            return this.warpSend("/gc Command failed to send message after 5 attempts. Please try again later.");
          }

          await delay(250);

          return this.send(
            `${message} ${helperFunctions.generateID(config.minecraft.bot.messageRepeatBypassLength)}`,
            n,
          );
        }
      };

      client.once("message", listener);
    }

    client.chat(message);

    if (listener !== undefined) {
      setTimeout(() => {
        client.removeListener("message", listener);
      }, 500);
    }
  }
  warpSend(message, n = 1) {
    if (typeof bot === "undefined" || bot?._client?.chat === undefined) {
      return;
    }
    bot.chat(message);
  }
  eventSend(message, n = 1) {
    if (typeof bot === "undefined" || bot?._client?.chat === undefined) {
      return;
    }
    // Sky mirrors event lines to the peer as well; Aria only mirrors from
    // send() (config.bridge.mirrorOnSend false).
    if (config.bridge.mirrorOnSend) {
      bridge.postToPeer("/api/command", { message: message });
    }
    bot.chat(message);
  }
  onCommand(player, message) {
    throw new Error("Command onCommand method is not implemented yet!");
  }

}

module.exports = minecraftCommand;
