const DiscordCommand = require('../../contracts/DiscordCommand')

const config = require("../../../config.json");
const guildConfig = require("../../contracts/guildConfig.js");
const axios = require("axios");

let ini = []
async function getUsernameFromUUID(uuid) {
  const { data } = await axios.get('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid)
  let username = data.name
  return username
}
async function getGMembers() {
  try {
    const { data } = await axios.get(guildConfig.ownGuildUrl())
    try {
      if (!guildConfig.isOwnGuild(data.guild)) {
        let ret = "This player is not in our guild."
        return ret
      }
    }
    catch {
      let ret = "Please confirm the name of the player you're trying to look up."
      return ret
    }
    ini = []
    for (let i = 0; i < data.guild.members.length + 1; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (i <= data.guild.members.length - 1) {
        let newData = data.guild.members[i];
        let expValue = Object.values(newData.expHistory)

        let total = expValue[0] + expValue[1] + expValue[2] + expValue[3] + expValue[4] + expValue[5] + expValue[6]
        let xp = total
        try {
          getActivity(data.guild.members[i].uuid, data.guild.members[i].rank, xp)
        }
        catch {
          console.log("Well something fucked up..")
        }
      }
      else if (i == data.guild.members.length) {
        for (let s = 0; s < 100; s++) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  }
  catch (error) {
    let e = error.message
    if (e.includes("status code 500")) {
      return "Error has occured"
    }
    if (e.includes("status code 404")) {
      return "Error has occured"
    }
    else {
      return error
    }
  }
}
async function getActivity(uuid, rank, xp) {
  const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?key=${config.minecraft.API.hypixelAPIkey}&uuid=${uuid}`)
  let name = await getUsernameFromUUID(uuid)
  let newlvl = 0
  for (let b = 0; b < Object.keys(data.profiles).length; b++) {
    if(newlvl < data.profiles[b]?.members[uuid]?.leveling?.experience){
      newlvl = data.profiles[b]?.members[uuid]?.leveling?.experience
    }
  }

  if (guildConfig.isProtectedRank(rank)) return;
  const target = guildConfig.rankForExperience(newlvl)
  if (target === undefined || rank == target) return
  ini.push(`${name} ${target}`)
}

class AutoclaimCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "mod"

    this.name = 'autoclaim'
    this.description = 'Kicks inactive people.'
  }

  onCommand(message) {
    let args = message.content.trim().split(/\s+/);

    if (!guildConfig.matchKeyword(args).forUs) {
      return;
    }
    getGMembers().then(a => {
      let interval = 750; // how much time should the delay between two iterations be (in milliseconds)?
      for (let index = 0; index < ini.length; ++index) {
        let el = ini[index]
        setTimeout(() => {
          this.sendPromoteMessage(`/g setrank ${el}`)
        }, index * interval);
      }
    })
    message.channel.send({
      embeds: [{
        description: `Checking skyblock levels...`,
        color: 0x47F049
      }]
    })
  }
}
module.exports = AutoclaimCommand
