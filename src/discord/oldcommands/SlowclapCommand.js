const DiscordCommand = require('../../contracts/DiscordCommand')
const { runDiscordReaction } = require('../../contracts/commands/reactions.js')

class SlowClapCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'slowclap'
        this.aliases = []
        this.description = 'User shall slow clap'
    }

    onCommand(message) {
        runDiscordReaction(this, message, {
            reaction: 'slowclap',
            delayMs: 0,
            minecraftText: `/gc ${message.author.username} is slow clapping!`,
            embedDescription: `${message.author} is slow clapping!`,
        })
    }
}
module.exports = SlowClapCommand