const minecraftCommand = require("../../contracts/minecraftCommand.js");
const guildConfig = require("../../contracts/guildConfig.js");

class ReqsCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'reqs'
    this.aliases = []
    this.description = 'Reqs'
  }

  onCommand(username, message) {
    // Lowest rank first, as the guild's entry requirement leads the line.
    const ranks = guildConfig.rankLadder().slice().reverse()
      .map((entry) => `${entry.name} - Skyblock Level ${entry.level}`)
      .join(' | ')

    this.send(`/gc Rank Requirements; ${ranks}`)
  }
}

module.exports = ReqsCommand
