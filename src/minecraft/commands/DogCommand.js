const minecraftCommand = require('../../contracts/minecraftCommand');
const { getImage, announceImage } = require('../../contracts/commands/randomImage.js');

class DogCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'dog'
        this.description = 'Gives dog'
    }

    async onCommand(username, message) {
        const dog = await getImage('dog');
        announceImage(this, username, dog);
    }
}

module.exports = DogCommand;
