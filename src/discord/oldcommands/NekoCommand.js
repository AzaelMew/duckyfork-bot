const DiscordCommand = require('../../contracts/DiscordCommand')
const {
  getImage,
  Encode,
  sendImageEmbed,
} = require('../../contracts/commands/randomImage.js');

class NekoCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'neko'
    this.description = 'neko'
  }

  onCommand(message) {
    getImage('neko').then(neko => {
      this.sendMinecraftMessage(`/gc ${Encode(neko)}`)
      sendImageEmbed(message.channel, neko)
    })
  }
}

module.exports = NekoCommand
