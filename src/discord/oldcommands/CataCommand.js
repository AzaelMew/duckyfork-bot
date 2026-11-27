const DiscordCommand = require('../../contracts/DiscordCommand')
const { getDungeonFromUsername } = require('../../contracts/commands/cata.js');

class CatacombsCommand extends DiscordCommand {
  constructor(discord) {
      super(discord)
    this.permission = "all"

      this.name = 'cata'
      this.description = "Says users dungeon stats"
    }

  async onCommand(message) {
    const user = await this.getPlayerTarget(message);
    if (!user) return;
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
