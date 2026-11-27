const DiscordCommand = require('../../contracts/DiscordCommand')
const { resolveDiscordTarget, runDiscordReaction } = require('../../contracts/commands/reactions.js')

class BonkCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'bonk'
        this.aliases = []
        this.description = 'Stabs specified user'
    }

    onCommand(message) {
        let target = resolveDiscordTarget(message)
        if (!target) return
        runDiscordReaction(this, message, {
            reaction: 'bonk',
            delayMs: 350,
            minecraftText: `/gc ${message.author.globalName} bonked ${target.mcuser}!`,
            embedDescription: `${message.author} bonked ${target.target}!`,
        })
    }
}
module.exports = BonkCommand