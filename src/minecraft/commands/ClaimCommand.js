const minecraftCommand = require("../../contracts/minecraftCommand.js");
const config = require("../../../config.json");
const axios = require("axios");
const guildConfig = require("../../contracts/guildConfig.js");

let rank

function numberWithCommas(x) {
    x = x.toString().split(".")[0]
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function round(value, precision) {
    var multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
}
async function getStatsFromUsername(username, profile) {
    return await getStatsFromUUID(await getUUIDFromUsername(username), profile)
}
async function getUUIDFromUsername(username) {
    if (!(/^[a-zA-Z0-9_]{2,16}$/mg.test(username))) {
        return "Error"
    }
    else {
        try {
            const { data } = await axios.get('https://api.mojang.com/users/profiles/minecraft/' + username)
            let uuid = data.id
            let user = username
            return uuid
        } catch {
            const { data } = await axios.get('https://api.ashcon.app/mojang/v2/user/' + username)
            let uuid = data.uuid.replace("-","");
            let user = username
            return uuid
        }

    }
}
async function getStatsFromUUID(name, profile) {
    try {
        if (name == undefined) {
            name = "a"
        }
        if (profile == undefined) {
            profile = "b"
        }
        const override = guildConfig.rankOverride(name)
        if (override !== undefined) {
            rank = override
            return rank
        }
        const { data } = await axios.get(`${config.minecraft.API.statsProxyUrl}/v2/profiles/${name}?key=${config.minecraft.API.statsProxyKey}`)

        console.log(data)
        let newlvl = 0
        for (b = 0; b < Object.keys(data.data).length; b++) {
            if (newlvl < data.data[b].sblevel) {
                newlvl = data.data[b].sblevel
            }
        }
        console.log(newlvl)
        rank = guildConfig.rankForLevel(newlvl)
        return rank

    }
    catch (error) {
        return `[ERROR] ${error.response.data.reason}`
    }

}

class ClaimCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'claim'
        this.description = "Claims ranks"
    }
    async onCommand(username, message) {
        let args = message.split(" ")
        getStatsFromUsername(username, args[1]).then(rank => {
            if (!guildConfig.rankLadder().some((entry) => entry.name === rank)) {
                return
            }
            this.warpSend(`/g setrank ${username} ${rank}`)
            setTimeout(() => {
                this.send(`/gc ${username}'s rank has been set to ${rank}! If this is wrong, make sure you're on your main profile, and APIs are on!`)
            }, 1000);
        })
    }
}
module.exports = ClaimCommand