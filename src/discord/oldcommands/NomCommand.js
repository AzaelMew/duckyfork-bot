const DiscordCommand = require('../../contracts/DiscordCommand')
const { runDiscordReaction } = require('../../contracts/commands/reactions.js')

class NomCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'nom'
        this.aliases = []
        this.description = 'Replies with User is `nom`ing'
    }

    onCommand(message) {
        runDiscordReaction(this, message, {
            reaction: 'nom',
            delayMs: 0,
            minecraftText: `/gc ${message.author.username}: "nom nom nom" `,
            embedDescription: `${message.author}: "nom nom nom" `,
        })
    }
}
module.exports = NomCommand