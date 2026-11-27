const DiscordCommand = require('../../contracts/DiscordCommand')
const { resolveDiscordTarget, runDiscordReaction } = require('../../contracts/commands/reactions.js')

class PokeCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'poke'
        this.aliases = []
        this.description = 'User pokes target to summon them'
    }

    onCommand(message) {
        let target = resolveDiscordTarget(message)
        if (!target) return
        runDiscordReaction(this, message, {
            reaction: 'poke',
            delayMs: 350,
            minecraftText: `/gc ${message.author.globalName} has poked ${target.mcuser}!`,
            embedDescription: `${message.author} has poked ${target.target}!`,
        })
    }
}
module.exports = PokeCommand