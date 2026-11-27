const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction, parseTarget } = require("../../contracts/commands/reactions.js");

class SlapCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'slap'
    this.aliases = []
    this.description = 'Replies with `User has slapped target!` to the user'
  }

  onCommand(username, message) {
    let target = parseTarget(message);
    sendReaction(this, username, 'slap', `/gc ${username} has slapped ${target}!`, `Has slapped ${target}`)
  }
}

module.exports = SlapCommand
