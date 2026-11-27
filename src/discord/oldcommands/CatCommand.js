const DiscordCommand = require('../../contracts/DiscordCommand')
const {
  getImage,
  Encode,
  COOLDOWN_MESSAGE,
  sendImageEmbed,
  sendCooldownEmbed,
} = require('../../contracts/commands/randomImage.js');

class CatCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'cat'
    this.aliases = ['car', "pussy", "kitty", "kitten", "catto","猫","kass","kissa","kiisu","貓","猫咪","pus","katt","kat","katto","kitty","meow",":3",';3','kotek','kot']
    this.description = 'cat'
  }

  onCommand(message) {
    getImage('cat').then(neko => {
      // The cat command has never had a cooldown, so this branch cannot fire;
      // it is kept so the reply stays identical if a cooldown is ever added.
      if (neko === COOLDOWN_MESSAGE) {
        sendCooldownEmbed(message.channel)
      } else {
        this.sendMinecraftMessage(`/gc ${Encode(neko)}`)
        sendImageEmbed(message.channel, neko)
      }
    })
  }
}

module.exports = CatCommand
