const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction } = require("../../contracts/commands/reactions.js");

class SlowClapCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'slowclap'
    this.aliases = []
    this.description = 'Replies with User is `Slowclapping`'
  }

  onCommand(username) {
    sendReaction(this, username, 'slowclap', `/gc ${username} is slowclapping!`, `is slow clapping`)
  }
}

module.exports = SlowClapCommand
