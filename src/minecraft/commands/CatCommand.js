const minecraftCommand = require('../../contracts/minecraftCommand');
const { getImage, announceImage } = require('../../contracts/commands/randomImage.js');

class CatCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'cat'
    this.aliases = ['car', "pussy", "kitty", "kitten", "catto","猫","kass","kissa","kiisu","貓","猫咪","pus","katt","kat","katto","kitty","meow",":3",';3','kotek','kot']
    this.description = 'Gives cat'
  }

  async onCommand(username, message) {
    const cat = await getImage('cat');
    announceImage(this, username, cat);
  }
}

module.exports = CatCommand;
