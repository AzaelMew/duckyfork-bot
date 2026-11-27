const DiscordCommand = require('../../contracts/DiscordCommand')
const { getStatsFromUsername } = require('../../contracts/commands/stats.js');

class StatsCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'stats'
    this.description = `Checks user's stats`
  }

  async onCommand(message) {
    const user = await this.getPlayerTarget(message);
    if (!user) return;
    
    getStatsFromUsername(user, undefined, { capNetworth: false }).then(stats => {
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
      else {
        this.sendMinecraftMessage(`/gc ${user}'s stats: ${stats.replaceAll("*", "").replaceAll("\n➣ ", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
        message.channel.send({
          embeds: [{
            description: stats.replaceAll("; ", "\n").replaceAll(":","").replaceAll("˚",""),
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
    })
  }
}
module.exports = StatsCommand
