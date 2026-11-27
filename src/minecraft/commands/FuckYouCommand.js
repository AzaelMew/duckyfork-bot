const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction, parseTarget } = require("../../contracts/commands/reactions.js");

class FuckYouCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'fuckyou'
    this.aliases = []
    this.description = 'Replies with `Fuck You!` to the user'
  }

  onCommand(username, message) {
    let target = parseTarget(message);
    sendReaction(this, username, 'fuckyou', `/gc ${username}: Fuck you ${target}!`, `Fuck you ${target}`)
  }
}

module.exports = FuckYouCommand
