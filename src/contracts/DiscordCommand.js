const bridge = require("./bridge.js");
const commandFilter = require("./commandFilter.js");
const { getCommandIgn } = require("../discord/commandIgn.js");

class DiscordCommand {
  constructor(discord) {
    this.discord = discord;
  }

  getArgs(message) {
    const args = message.content.split(" ");

    args.shift();

    return args;
  }

  prefixCommand(name) {
    return `${commandFilter.getPrefix()}${name}`;
  }

  async getPlayerTarget(message) {
    const [command, explicit] = message.content.trim().split(/\s+/);
    return explicit || this.getDefaultPlayerTarget(message, `${command} <IGN>`);
  }

  async getDefaultPlayerTarget(message, example) {
    let reply;
    try {
      const ign = await getCommandIgn(message.author.id);
      if (ign) return ign;

      reply = `Enter a Minecraft IGN, for example \`${example}\`.`;
      if (commandFilter.isEnabled("old", "ign")) {
        reply += ` Save your IGN with \`${this.prefixCommand("ign")} <IGN>\`.`;
      }
    } catch (error) {
      console.error("[IGN]", error);
      reply = "Your default Minecraft IGN could not be loaded. Enter an IGN to run this command.";
    }

    await message.channel.send(reply);
    return null;
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
