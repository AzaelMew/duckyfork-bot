const fs = require('fs');
const minecraftCommand = require("../../contracts/minecraftCommand.js");
const config = require("../../../config.json");
const guildConfig = require("../../contracts/guildConfig.js");
const { getUUID } = require("../../contracts/API/mowojangAPI.js");

// One UUID per line; ignore blank lines and stray whitespace so a lookup can
// never match part of a line.
function blacklistedIDs(contents) {
    return contents.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

class BlacklistCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'blacklist'

        this.description = 'Blacklists user'
    }

    async onCommand(username, message) {
        if (!guildConfig.isBlacklistEditor(username)) {
            return
        }
        let args = message.split(" ")
        let uuid
        try {
            uuid = await getUUID(args[2])
        } catch (error) {
            if (error === "Invalid username.") {
                this.send(`/oc ${args[2]} is not a valid username.`)
            } else {
                this.send(`/oc ${args[2]} could not be looked up.`)
            }
            return
        }
        try {
            let blacklist = fs.readFileSync(config.paths.blacklist, 'utf-8');
            let ids = blacklistedIDs(blacklist);
            if (args[1] == "add") {
                if (!ids.includes(uuid)) {
                    this.send(`/oc ${args[2]} ${uuid} added to blacklist.`)
                    let separator = blacklist.length > 0 && !blacklist.endsWith("\n") ? "\n" : "";
                    fs.writeFileSync(config.paths.blacklist, `${blacklist}${separator}${uuid}\n`, 'utf-8');
                }
                else{
                    this.send(`/oc ${args[2]} is already in the blacklist.`)
                }
            }
            else if (args[1] == "remove") {
                const index = ids.indexOf(uuid);
                if (index > -1) {
                    ids.splice(index, 1);

                    // write the updated blacklist back to the file
                    fs.writeFileSync(config.paths.blacklist, ids.map((id) => `${id}\n`).join(""), 'utf-8');
                    this.send(`/oc ${args[2]} ${uuid} removed from blacklist.`)
                }
                else {
                    this.send(`/oc ${args[2]} is not in the blacklist.`)
                }
            }
            else if (args[1] == "check"){
                if (!ids.includes(uuid)){
                    this.send(`/oc ${args[2]} is not in the blacklist.`)
                }
                else{
                    this.send(`/oc ${args[2]} is blacklisted.`)
                }
            }
        } catch (error) {
            console.error("Error updating the blacklist:", error);
            this.send(`/oc Could not update the blacklist for ${args[2]}.`)
        }
    }
}

module.exports = BlacklistCommand
