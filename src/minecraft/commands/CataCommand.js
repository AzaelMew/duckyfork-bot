const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getDungeonFromUsername } = require("../../contracts/commands/cata.js");

class CatacombsCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'cata'
    this.description = "Says users dungeon stats"
  }

  async onCommand(username, message) {
    

    let args = message.split(" ")
    if (message.endsWith("!cata")) {
      getDungeonFromUsername(username).then(stats => {
        if (stats.includes("[ERROR]")) {
          this.send(`/gc ${stats}`)
        }
        else {
          this.send(`/gc ${username}'s cata: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "").replaceAll("¨", "˚")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${username}'s cata`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replaceAll("˚", "")}` })
        }
      })
    }
    else {
      getDungeonFromUsername(args[1]).then(stats => {
        if (stats.includes("[ERROR]")) {
          this.send(`/gc ${stats}`)
        }
        else {
          this.send(`/gc ${args[1]}'s cata: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${args[1]}'s cata`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replaceAll("˚", "")}` })
        }
      })
    }
  }
}

module.exports = CatacombsCommand
