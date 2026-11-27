const DiscordCommand = require('../../contracts/DiscordCommand')
const { EIGHT_BALL_ICON, askEightBall } = require('../../contracts/commands/reactions.js')

class EightBallCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = '8ball'
    this.description = '8ball'
  }

  onCommand(message) {
    askEightBall().then(ans => {
        setTimeout(() => {
          this.sendMinecraftMessage(`/gc ${ans}`)

          message.channel.send({
            embeds: [{
              description: ans,
              color: 0x2A2A2A,
              timestamp: new Date(),
              footer: {
                text: "BOT",
              },
              author: {
                name: `The Magic 8 Ball`,
                icon_url: EIGHT_BALL_ICON,
              },
            }],
          })
        }, 1000);
      })
  }
}

module.exports = EightBallCommand
