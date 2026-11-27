const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction, parseTarget } = require("../../contracts/commands/reactions.js");

class PatCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'pat'
    this.aliases = []
    this.description = 'Replies with `User pat target!` to the user'
  }

  onCommand(username, message) {
    let target = parseTarget(message);
    sendReaction(this, username, 'pat', `/gc ${username} pat ${target}!`, `pat ${target}`)
  }
}

module.exports = PatCommand
