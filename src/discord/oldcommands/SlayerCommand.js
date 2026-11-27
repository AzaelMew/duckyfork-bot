const DiscordCommand = require('../../contracts/DiscordCommand')
const { getSlayerFromUser, errorText } = require('../../contracts/commands/slayer.js');

class SlayerCommand extends DiscordCommand {
    constructor(discord) {
      super(discord)
      this.permission = "all"
      this.name = 'slayer'
      this.aliases = ["slayers"]
      this.description = "Says users slayers"
    }
  
  async onCommand(message) {
    const user = await this.getPlayerTarget(message);
    if (!user) return;
    getSlayerFromUser(user).catch(errorText).then(stats => {
      if (stats.includes("[ERROR]")) {
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
              name: `${user}'s stats`,
              icon_url: 'https://minotar.net/helm/' + user+'.png',
            },
          }],
        })
      }
      else{
        this.sendMinecraftMessage(`/gc ${user}'s slayers: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
        message.channel.send({
          embeds: [{
            description: stats.replaceAll(";", "\n").replaceAll(":","").replaceAll("˚",""),
            color: 0x2A2A2A,
            timestamp: new Date(),
            footer: {
              text: "BOT",
            },
            author: {
              name: `${user}'s slayers`,
              icon_url: 'https://minotar.net/helm/' + user+'.png',
            },
          }],
        })
      }
    })
  }
  }
  
  module.exports = SlayerCommand
