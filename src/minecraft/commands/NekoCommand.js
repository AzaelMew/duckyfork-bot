const minecraftCommand = require('../../contracts/minecraftCommand');
const { getImage, announceImage } = require('../../contracts/commands/randomImage.js');

class NekoCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'neko'
        this.aliases = ['catgirl']
        this.description = 'Gives catgirl'
    }

    async onCommand(username, message) {
        const cat = await getImage('neko');
        announceImage(this, username, cat);
    }
}

module.exports = NekoCommand;
