const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getStatsFromUsername } = require("../../contracts/commands/stats.js");

class StatsCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'stats'

    this.description = "Says users stats"
  }

  async onCommand(username, message) {
    

    let args = message.split(" ")
    if (message.endsWith("!stats")) {
      getStatsFromUsername(username).then(stats => {
        if (stats.includes("[ERROR]")) {
          this.send(`/gc ${stats}`)
        }
        else {
          this.send(`/gc ${username}'s stats: ${stats.replaceAll("*", "").replaceAll("\n➣ ", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${username}'s stats`, message: `${stats.replaceAll(";", "\n").replace("˚", "")}` })
        }
      })
    }
    else {
      if (args[2] != undefined) {
        getStatsFromUsername(args[1], args[2]).then(stats => {
          if (stats.includes("[ERROR]")) {
            this.send(`/gc ${stats}`)
          }
          else {
            this.send(`/gc ${args[1]}'s stats: ${stats.replaceAll("*", "").replaceAll("\n➣ ", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
            this.minecraft.broadcastCommandEmbed({ username: `${args[1]}'s stats`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replace("˚", "")}` })
          }
        })
      }
      else {
        getStatsFromUsername(args[1]).then(stats => {
          if (stats.includes("[ERROR]")) {
            this.send(`/gc ${stats}`)
          }
          else {
            this.send(`/gc ${args[1]}'s stats: ${stats.replaceAll("*", "").replaceAll("\n➣ ", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
            this.minecraft.broadcastCommandEmbed({ username: `${args[1]}'s stats`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replace("˚", "")}` })
          }
        })
      }
    }
  }
}

module.exports = StatsCommand
