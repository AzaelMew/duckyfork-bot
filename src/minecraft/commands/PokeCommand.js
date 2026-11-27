const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { sendReaction, parseTarget } = require("../../contracts/commands/reactions.js");

class PokeCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'poke'
    this.aliases = []
    this.description = 'User pokes target to summon them'
  }

  onCommand(username, message) {
    let target = parseTarget(message);
    sendReaction(this, username, 'poke', `/gc ${username} has poked ${target}!`, `Has poked ${target}`)
  }
}

module.exports = PokeCommand
