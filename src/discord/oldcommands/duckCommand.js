const DiscordCommand = require('../../contracts/DiscordCommand')
const {
  getImage,
  sendImageEmbed,
} = require('../../contracts/commands/randomImage.js');

class DuckCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = "duck";
        this.aliases = ["ducky", "ducks", "duckysougly", "duckysolucky"];
        this.description = "Random image of a ducks.";
        this.options = [];
    }

    onCommand(message) {
        getImage('duck').then(cat => {
          sendImageEmbed(message.channel, cat)
        })
    }
}

module.exports = DuckCommand;
