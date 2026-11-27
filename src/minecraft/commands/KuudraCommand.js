const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getKuudraFromUsername } = require("../../contracts/commands/kuudra.js");

class KuudraCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'kuudra'
    this.description = "Says users kuudra stats"
  }

  async onCommand(username, message) {
    

    let args = message.split(" ")
    if (message.endsWith("!kuudra")) {
        getKuudraFromUsername(username).then(stats => {
        if (stats.includes("[ERROR]")) {
          this.send(`/gc ${stats}`)
        }
        else {
          this.send(`/gc ${username}'s kuudra: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "").replaceAll("¨", "˚")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${username}'s kuudra`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replace("˚", "").replaceAll("¨", "")}` })
        }
      })
    }
    else {
        getKuudraFromUsername(args[1]).then(stats => {
        if (stats.includes("[ERROR]")) {
          this.send(`/gc ${stats}`)
        }
        else {
          this.send(`/gc ${args[1]}'s kuudra: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "").replaceAll("¨", "˚")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${args[1]}'s kuudra`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replace("˚", "").replaceAll("¨", "")}` })
        }
      })
    }
  }
}

module.exports = KuudraCommand
