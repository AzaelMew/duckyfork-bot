const DiscordCommand = require('../../contracts/DiscordCommand')
const { normalizeCrop, getNextContest } = require('../../contracts/commands/jacob.js')

class JacobCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'contest'

        this.description = "Tells you when next contest general is, or next specific contest is."
    }

    async onCommand(message) {
        let args = this.getArgs(message)
        let crop = args.shift()
        crop = crop != undefined ? normalizeCrop(crop) : undefined
        getNextContest({ crop }).then(({ embedText, chatText }) => {
            message.channel.send({
                embeds: [{
                    description: embedText,
                    color: 0xcbbeb5,
                    timestamp: new Date(),
                    footer: {
                        text: "BOT",
                    },
                }],
            })
            this.sendMinecraftMessage(`/gc ${chatText}`)
        })
    }
}

module.exports = JacobCommand;
