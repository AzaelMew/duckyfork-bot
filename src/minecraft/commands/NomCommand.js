const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction } = require("../../contracts/commands/reactions.js");

class NomCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'nom'
    this.aliases = []
    this.description = 'Replies with User is `nom`ing'
  }

  onCommand(username) {
    sendReaction(this, username, 'nom', `/gc ${username}: "nom nom nom" `, `"nom nom nom"`)
  }
}

module.exports = NomCommand
