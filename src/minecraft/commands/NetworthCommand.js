const minecraftCommand = require("../../contracts/minecraftCommand.js");
const {
  getNetworthSummary,
  NetworthError,
  toChatText,
  toEmbedText
} = require("../../contracts/networthSummary.js");

class NetworthCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft);
    this.name = "networth";
    this.aliases = ["nw"];
    this.description = "Checks user's networth";
    this.options = [{ name: "username", description: "Minecraft username", required: false }];
  }

  async onCommand(player, message) {
    try {
      const target = this.getArgs(message)[0] || player;
      const { username, text } = await getNetworthSummary(target);

      this.send("/gc " + username + "'s networth: " + toChatText(text));

      if (typeof this.minecraft.broadcastCommandEmbed === "function") {
        try {
          await this.minecraft.broadcastCommandEmbed({
            username: username + "'s networth",
            message: toEmbedText(text)
          });
        } catch (error) {
          console.error("[NETWORTH DISCORD ERROR]", error);
        }
      }
    } catch (error) {
      if (error instanceof NetworthError) return this.send("/gc " + error.message);
      console.error("[NETWORTH ERROR]", error);
      // Avoid exposing raw API errors or sending oversized chat messages.
      this.send("/gc [ERROR] Could not calculate networth. Please try again later.");
    }
  }
}

module.exports = NetworthCommand;
