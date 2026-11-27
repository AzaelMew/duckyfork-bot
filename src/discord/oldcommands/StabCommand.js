const DiscordCommand = require('../../contracts/DiscordCommand')
const { resolveDiscordTarget, runDiscordReaction } = require('../../contracts/commands/reactions.js')

class StabCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'stab'
        this.aliases = []
        this.description = 'Stabs specified user'
    }

    onCommand(message) {
        let target = resolveDiscordTarget(message)
        if (!target) return
        runDiscordReaction(this, message, {
            reaction: 'stab',
            delayMs: 350,
            getReactionOptions: { onData: console.log },
            minecraftText: `/gc ${message.author.globalName} stabbed ${target.mcuser}!`,
            embedDescription: `${message.author} has stabbed ${target.target}!`,
        })
    }
}
module.exports = StabCommand