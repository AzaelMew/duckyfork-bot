const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { normalizeCrop, getNextContest } = require("../../contracts/commands/jacob.js");

class JacobCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'contest'

        this.description = "Tells you when next contest general is, or next specific contest is."
    }

    async onCommand(username, message) {
        let args = message.split(" ")
        let crop = args[1] != undefined ? normalizeCrop(args[1]) : undefined
        getNextContest({ crop }).then(({ embedText, chatText }) => {
            this.minecraft.broadcastCommandEmbed2({ message: embedText })
            this.send(`/gc ${chatText}`)
        })
    }
}

module.exports = JacobCommand
