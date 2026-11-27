const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getSlayerFromUser, slayerErrorText } = require("../../contracts/commands/slayer.js");

class SlayerCommand extends minecraftCommand {
    constructor(minecraft) {
      super(minecraft)
  
      this.name = 'slayer'
      this.aliases = ["slayers"]

      this.description = "Says users slayers"
    }
  
    async onCommand(username, message) {
  
      let args = message.split(" ")
      if (message.endsWith("!slayer") || message.endsWith("!slayers")){
        getSlayerFromUser(username).catch(slayerErrorText).then(stats=>{
            this.send(`/gc ${username}'s slayers: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
            this.minecraft.broadcastCommandEmbed({ username: `${username}'s slayers`, message: `${stats.replaceAll(";", "\n").replace("˚", "")}` }) })
    }
      else {
        getSlayerFromUser(args[1]).catch(slayerErrorText).then(stats=>{
            this.send(`/gc ${args[1]}'s slayers: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
            this.minecraft.broadcastCommandEmbed({ username: `${args[1]}'s slayers`, message: `${stats.replaceAll(";", "\n").replaceAll(":", "").replaceAll("˚", "").replace("˚", "")}` })})
      }
    }
  }
  
  module.exports = SlayerCommand
