const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction, parseTarget } = require("../../contracts/commands/reactions.js");

class StabCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'stab'
    this.aliases = []
    this.description = 'Replies with `User has stabbed target!` to the user'
  }

  onCommand(username, message) {
    let target = parseTarget(message);
    sendReaction(this, username, 'stab', `/gc ${username} has stabbed ${target}!`, `Has stabbed ${target}`)
  }
}

module.exports = StabCommand
