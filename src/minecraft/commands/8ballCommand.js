const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { EIGHT_BALL_ICON, askEightBall } = require("../../contracts/commands/reactions.js");

class EightBallCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = '8ball'
    this.description = '8ball'
  }

  onCommand(username, message) {
    askEightBall().then(ans => {
        setTimeout(() => {
            this.send(`/gc ${ans}`)
            this.minecraft.broadcastCommandEmbed3({ username: `The Magic 8 Ball`, message: `${ans}`, icon: EIGHT_BALL_ICON })
        }, 1000);
      })
  }
}

module.exports = EightBallCommand
