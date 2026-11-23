const DiscordCommand = require("../../contracts/DiscordCommand.js");
const { getUUID } = require("../../contracts/API/mowojangAPI.js");
const { clearCommandIgn, getCommandIgn, setCommandIgn } = require("../commandIgn.js");

class IgnCommand extends DiscordCommand {
  constructor(discord) {
    super(discord);
    this.name = "ign";
    this.permission = "all";
    this.description = "View, set or clear your default Minecraft IGN for player lookups.";
  }

  async onCommand(message) {
    const [, ign, extra] = message.content.trim().split(/\s+/);
    const discordId = message.author.id;
    const command = this.prefixCommand(this.name);
    let reply;

    try {
      if (extra || (ign && ign !== "--clear" && !/^[A-Za-z0-9_]{2,16}$/.test(ign))) {
        reply = `Usage: \`${command}\`, \`${command} <IGN>\` or \`${command} --clear\`.`;
      } else if (ign === "--clear") {
        clearCommandIgn(discordId);
        reply = "Your saved IGN preference was cleared. If you have a verified Minecraft account, lookups will use it.";
      } else if (ign) {
        setCommandIgn(discordId, await getUUID(ign));
        reply = `Your default Minecraft IGN is now \`${ign}\`.`;
      } else {
        const current = await getCommandIgn(discordId);
        reply = current
          ? `Your default Minecraft IGN is \`${current}\`.`
          : `Set your default Minecraft IGN with \`${command} <IGN>\`.`;
      }
    } catch (error) {
      if (error === "Invalid username.") {
        reply = `Minecraft account \`${ign}\` was not found.`;
      } else {
        console.error("[IGN]", error);
        reply = "Your default Minecraft IGN could not be accessed. Please try again later.";
      }
    }

    return message.channel.send(reply);
  }
}

module.exports = IgnCommand;
