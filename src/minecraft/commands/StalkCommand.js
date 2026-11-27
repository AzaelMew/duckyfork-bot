const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getLocationFromUsername } = require("../../contracts/commands/playerLookup.js");

class StalkCommand extends minecraftCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'stalk'
        this.description = `Checks user's location`
    }

    onCommand(username, message) {

        let args = message.split(" ")
        let newusername = args[1]
        getLocationFromUsername(newusername, { apiErrorText: "Player doesn't exist" }).then(location => {
            this.send(`/gc ${newusername}'s location: ${location}`)
        })
    }
}

module.exports = StalkCommand
