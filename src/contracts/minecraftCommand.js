const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const helperFunctions = require("./helperFunctions.js");
const bridge = require("./bridge.js");

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
    if (bot === undefined && bot._client.chat === undefined) {
      return;
    }
    bridge.postToPeer("/api/command", { message: message });
    
    bot.chat(message);

  }
  warpSend(message, n = 1) {
    if (bot === undefined && bot._client.chat === undefined) {
      return;
    }
    bot.chat(message);
  }
  eventSend(message, n = 1) {
    if (bot === undefined && bot._client.chat === undefined) {
      return;
    }
    bridge.postToPeer("/api/command", { message: message });
    bot.chat(message);
  }
  onCommand(player, message) {
    throw new Error("Command onCommand method is not implemented yet!");
  }

}

module.exports = minecraftCommand;
