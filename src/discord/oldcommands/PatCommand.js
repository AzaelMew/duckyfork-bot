const DiscordCommand = require('../../contracts/DiscordCommand')
const { resolveDiscordTarget, runDiscordReaction } = require('../../contracts/commands/reactions.js')

class PatCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'pat'
        this.aliases = []
        this.description = 'Pats specified user'
    }

    onCommand(message) {
        let target = resolveDiscordTarget(message)
        if (!target) return
        runDiscordReaction(this, message, {
            reaction: 'pat',
            delayMs: 350,
            minecraftText: `/gc ${message.author.globalName} pat ${target.mcuser}!`,
            embedDescription: `${message.author} pat ${target.target}!`,
        })
    }
}
module.exports = PatCommand