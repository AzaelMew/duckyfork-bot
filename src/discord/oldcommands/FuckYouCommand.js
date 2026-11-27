const DiscordCommand = require('../../contracts/DiscordCommand')
const { resolveDiscordTarget, runDiscordReaction } = require('../../contracts/commands/reactions.js')

class FuckYouCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'fuckyou'
        this.aliases = []
        this.description = 'Replies with `Fuck You!` to the user'
    }

    onCommand(message) {
        let target = resolveDiscordTarget(message)
        if (!target) return
        runDiscordReaction(this, message, {
            reaction: 'fuckyou',
            delayMs: 350,
            minecraftText: `/gc ${message.author.globalName} gave the middle finger to ${target.mcuser}!`,
            embedDescription: `${message.author} gave the middle finger to ${target.target}!`,
        })
    }
}
module.exports = FuckYouCommand