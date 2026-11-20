const DiscordCommand = require('../../contracts/DiscordCommand')

const config = require("../../../config.json");
const axios = require("axios");
const fs = require('fs');

function numberWithCommas(x) {
  if (x > 999815672) {
    x = x.toString().split(".")[0]
    x = x.toString().slice(0, -6) + "815672";
  }
  else {
    x = x.toString().split(".")[0]
  }
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
async function getDungeonFromUsername(username) {
  return await getDungeonFromUUID(await getUUIDFromUsername(username))
}
async function getDungeonFromUUID(name) {
  try {
    if (name == undefined) {
      name = "a"
    }
    if (name == "f03695547707486ab2308518f04102f7") return
    const { data } = await axios.get(`${config.minecraft.API.statsProxyUrl}/v1/profiles/${name}?key=${config.minecraft.API.statsProxyKey}`);
    let lvl = data.data[0].dungeons?.catacombs?.skill?.levelWithProgress || 0
    if(lvl == 50){
      let total = data.data[0].dungeons?.catacombs?.skill?.totalXp;
      let newNum = total - 569809640
      let overflow = newNum/200000000
      lvl = lvl + overflow
    }
    let h = data.data[0].dungeons?.classes?.healer?.levelWithProgress || 0
    let m = data.data[0].dungeons?.classes?.mage?.levelWithProgress || 0
    let a = data.data[0].dungeons?.classes?.archer?.levelWithProgress || 0
    let b = data.data[0].dungeons?.classes?.berserk?.levelWithProgress || 0
    let t = data.data[0].dungeons?.classes?.tank?.levelWithProgress || 0
    let av = ((h + m + b + a + t) / 5)
    if(h == 50){
      let total = data.data[0].dungeons?.classes?.healer?.totalXp;
      let newNum = total - 569809640
      let overflow = newNum/200000000
      h = h + overflow
    }
    if(m == 50){
      let total = data.data[0].dungeons?.classes?.mage?.totalXp;
      let newNum = total - 569809640
      let overflow = newNum/200000000
      m = m + overflow
    }
    if(b == 50){
      let total = data.data[0].dungeons?.classes?.berserk?.totalXp;
      let newNum = total - 569809640
      let overflow = newNum/200000000
      b = b + overflow
    }
    if(a == 50){
      let total = data.data[0].dungeons?.classes?.archer?.totalXp;
      let newNum = total - 569809640
      let overflow = newNum/200000000
      a = a + overflow
    }
    if(t == 50){
      let total = data.data[0].dungeons?.classes?.tank?.totalXp;
      let newNum = total - 569809640
      let overflow = newNum/200000000
      t = t + overflow
    }
    let secrets = data.data[0].talismans.secrets
    let stats = "˚**Cata**:\n➣ " + lvl.toFixed(2) + "˚ **;Average**:\n➣ " + av.toFixed(2) + "˚ **;Archer**:\n➣ " + a.toFixed(2) + "˚ **;Berserk**:\n➣ " + b.toFixed(2) + "˚ **;Healer**:\n➣ " + h.toFixed(2) + "˚ **;Mage**:\n➣ " + m.toFixed(2) + "˚ **;Tank**:\n➣ " + t.toFixed(2) +"˚ **;Secrets**:\n➣ " + secrets
    return stats

  }
  catch (error) {
    return `[ERROR] ${error.response.data.reason}`
  }
}
class CatacombsCommand extends DiscordCommand {
  constructor(discord) {
      super(discord)
    this.permission = "all"

      this.name = 'cata'
      this.description = "Says users dungeon stats"
    }

  onCommand(message) {
  
    let args = this.getArgs(message)
    let user = args.shift()
    getDungeonFromUsername(user).then(stats => {
      if(stats.includes("[ERROR]")){
        this.sendMinecraftMessage(`/gc ${stats}`)
        message.channel.send({
          embeds: [{
            description: stats,
            color: 0x2A2A2A,
            timestamp: new Date(),
            footer: {
              text: "BOT",
            },
            author: {
              name: `${user}'s cata`,
              icon_url: 'https://minotar.net/helm/' + user+'.png',
            },
          }],
        })
      }
      else{
      this.sendMinecraftMessage(`/gc ${user}'s cata: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "").replaceAll("¨", "˚")}`)
      message.channel.send({
        embeds: [{
          description: stats.replaceAll(";", "\n").replaceAll(":","").replaceAll("˚",""),
          color: 0x2A2A2A,
          timestamp: new Date(),
          footer: {
            text: "BOT",
          },
          author: {
            name: `${user}'s cata`,
            icon_url: 'https://minotar.net/helm/' + user+'.png',
          },
        }],
      })
    }
    })
  }
}

module.exports = CatacombsCommand
