const minecraftCommand = require('../../contracts/minecraftCommand');
const axios = require('axios');
const uploader = require('../../contracts/Imgur/imgurExport');
const { encode: Encode } = require('../../contracts/stuf.js');

async function upload(imageUrl) {
    try {
        // Get the image data from the URL
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        // Upload the image data to Imgur
        const response = await uploader.uploadBuffer(imageResponse.data)
        return response;
    } catch (error) {
        console.error("Upload Failed", error.message);
        throw error; // Rethrow the error for the caller to handle
    }
}

async function imgurID(url) {
    try {
        // Fetch data from the provided URL
        const response = await axios.get(url);
        const imageDataArray = response.data.image; // Array of image data objects

        // Extract the URL of the first image object
        const imageUrl = imageDataArray;

        // Upload the image to Imgur
        const imageLink = await upload(imageUrl);
        return imageLink.url; // Return the uploaded image link
    } catch (error) {
        console.error("imgurID Failed", error.message);
        return null; // or handle error appropriately
    }
}

async function getDogPic() {
    try {
        const imgurIDValue = await imgurID("https://api.animality.xyz/all/bird");
        if (imgurIDValue) {
            return imgurIDValue;
        } else {
            return "Failed to get Imgur ID for dog picture, try again in a few seconds";
        }
    } catch (error) {
        console.error("getDogPic Failed", error.message);
        return "Failed to get dog picture"; // or handle error appropriately
    }
}

class DogCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'bird'
        this.aliases = ["birb","borb"]
        this.description = 'Gives birb'
    }

    async onCommand(username, message) {
        
        let dog = await getDogPic();
        this.send(`/gc ${Encode(dog)}`)
        this.minecraft.broadcastNewImage({ username: username, image: `${dog}`, icon: 'https://minotar.net/helm/' + username+'.png' })
    }
}

module.exports = DogCommand;