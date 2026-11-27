const DiscordCommand = require('../../contracts/DiscordCommand')
const { resolveDiscordTarget, runDiscordReaction } = require('../../contracts/commands/reactions.js')

class SlapCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'slap'
        this.aliases = []
        this.description = 'Slaps specified user'
    }

    onCommand(message) {
        let target = resolveDiscordTarget(message)
        if (!target) return
        runDiscordReaction(this, message, {
            reaction: 'slap',
            delayMs: 350,
            minecraftText: `/gc ${message.author.globalName} slapped ${target.mcuser}!`,
            embedDescription: `${message.author} has slapped ${target.target}!`,
        })
    }
}
module.exports = SlapCommand