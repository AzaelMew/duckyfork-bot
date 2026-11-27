const minecraftCommand = require("../../contracts/minecraftCommand.js");
const guildConfig = require("../../contracts/guildConfig.js");

class OverrideCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'override'
    this.aliases = ['o']
    this.description = 'Executes commands as the minecraft bot'
  }

  onCommand(username, message) {
    if (!guildConfig.isOverridePlayer(username)) return;

    message = message.split(" ")
    message.shift()
    message = message.join(" ")

    this.send(`/${message}`)
  }
}

module.exports = OverrideCommand
