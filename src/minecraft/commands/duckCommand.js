const minecraftCommand = require('../../contracts/minecraftCommand');
const { getImage, announceImage } = require('../../contracts/commands/randomImage.js');

class CatCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = "duck";
        this.aliases = ["ducky", "ducks", "duckysougly", "duckysolucky"];
        this.description = "Random image of a ducks.";
        this.options = [];
    }

    async onCommand(username, message) {
        const cat = await getImage('duck');
        announceImage(this, username, cat);
    }
}

module.exports = CatCommand;
