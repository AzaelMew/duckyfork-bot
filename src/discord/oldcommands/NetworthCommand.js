const DiscordCommand = require("../../contracts/DiscordCommand.js");
const {
  getNetworthSummary,
  NetworthError,
  toChatText,
  toEmbedText
} = require("../../contracts/networthSummary.js");

class NetworthCommand extends DiscordCommand {
  constructor(discord) {
    super(discord);
    this.permission = "all";

    this.name = "networth";
    this.aliases = ["nw"];
    this.description = `Checks user's networth`;
  }

  async onCommand(message) {
    const user = await this.getPlayerTarget(message);
    if (!user) return;

    const reply = (name, description) =>
      message.channel.send({
        embeds: [
          {
            description,
            color: 0x2a2a2a,
            timestamp: new Date(),
            footer: { text: "BOT" },
            author: {
              name: `${name}'s networth`,
              icon_url: "https://minotar.net/helm/" + name + ".png"
            }
          }
        ]
      });

    try {
      const { username, text } = await getNetworthSummary(user);
      this.sendMinecraftMessage(`/gc ${username}'s networth: ${toChatText(text)}`);
      await reply(username, toEmbedText(text));
    } catch (error) {
      let description = "[ERROR] Could not calculate networth. Please try again later.";
      if (error instanceof NetworthError) description = "[ERROR] " + error.message;
      else console.error("[NETWORTH ERROR]", error);
      this.sendMinecraftMessage(`/gc ${description}`);
      await reply(user, description);
    }
  }
}

module.exports = NetworthCommand;
