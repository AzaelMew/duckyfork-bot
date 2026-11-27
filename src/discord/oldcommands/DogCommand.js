const DiscordCommand = require('../../contracts/DiscordCommand')
const {
  fetchWithCooldown,
  COOLDOWN_MESSAGE,
  sendImageEmbed,
  sendCooldownEmbed,
} = require('../../contracts/commands/randomImage.js');

const filename = 'lastDogCalledTime.txt'

class DogCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'dog'
    this.description = 'dog'
  }

  onCommand(message) {
    fetchWithCooldown('dog', filename).then(neko => {
      if (neko === COOLDOWN_MESSAGE) {
        sendCooldownEmbed(message.channel)
      } else {
        sendImageEmbed(message.channel, neko)
      }
    })
  }
}

module.exports = DogCommand
