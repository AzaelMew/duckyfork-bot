const bridge = require("./bridge.js");

class DiscordCommand {
  constructor(discord) {
    this.discord = discord;
  }

  getArgs(message) {
    const args = message.content.split(" ");

    args.shift();

    return args;
  }

  sendMinecraftMessage(message) {
    if (this.discord.app.minecraft.bot.player !== undefined) {
      this.discord.app.minecraft.bot.chat(message);
      if(message.includes("/g invite")) return

      bridge.postToPeer("/api/command", { message: message });
    }
  }
  sendPromoteMessage(message) {
    if (this.discord.app.minecraft.bot.player !== undefined) {
      this.discord.app.minecraft.bot.chat(message);
    }
  }
  onCommand(message) {
    throw new Error("Command onCommand method is not implemented yet!");
  }
}

module.exports = DiscordCommand;
