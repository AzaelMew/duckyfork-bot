//Yonko yonked this
const DiscordCommand = require('../../contracts/DiscordCommand')
const { getKuudraFromUsername } = require('../../contracts/commands/kuudra.js');

class KuudraCommand extends DiscordCommand {
  constructor(discord) {
      super(discord)
    this.permission = "all"

      this.name = 'kuudra'
      this.description = "Says users kuudra stats"
    }

  async onCommand(message) {
    const user = await this.getPlayerTarget(message);
    if (!user) return;
    getKuudraFromUsername(user).then(stats => {
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
              name: `${user}'s kuudra`,
              icon_url: 'https://minotar.net/helm/' + user+'.png',
            },
          }],
        })
      }
      else{
      this.sendMinecraftMessage(`/gc ${user}'s kuudra: ${stats.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "").replaceAll("¨", "˚")}`)
      message.channel.send({
        embeds: [{
          description: stats.replaceAll(";", "\n").replaceAll(":","").replaceAll("˚",""),
          color: 0x2A2A2A,
          timestamp: new Date(),
          footer: {
            text: "BOT",
          },
          author: {
            name: `${user}'s kuudra`,
            icon_url: 'https://minotar.net/helm/' + user+'.png',
          },
        }],
      })
    }
    })
  }
}

module.exports = KuudraCommand
