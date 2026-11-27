const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction, parseTarget } = require("../../contracts/commands/reactions.js");

class BonkCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'bonk'
    this.aliases = []
    this.description = 'Replies with `User bonked target!` to the user'
  }

  onCommand(username, message) {
    let target = parseTarget(message);
    sendReaction(this, username, 'bonk', `/gc ${username} bonked ${target}!`, `bonked ${target}`)
  }
}

module.exports = BonkCommand
