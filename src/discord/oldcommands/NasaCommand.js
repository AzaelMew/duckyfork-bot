const DiscordCommand = require('../../contracts/DiscordCommand')

const config = require("../../../config.json");
const axios = require('axios');
const uploader = require('../../contracts/Imgur/imgurExport');
const { encode: Encode } = require('../../contracts/stuf.js');

const filename = 'lastCalledTime.txt'
let lastRun

async function upload(imageUrl) {
  try {
      // Get the image data from the URL
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageData = Buffer.from(imageResponse.data, 'binary').toString('base64');

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
      const imageDataArray = response.data; // Array of image data objects

      // Extract the URL of the first image object
      const imageUrl = imageDataArray.url;

      // Upload the image to Imgur
      const imageLink = await upload(imageUrl);
      return `${imageLink.url}||${imageDataArray.explanation}`; // Return the uploaded image link
  } catch (error) {
      console.error("imgurID Failed", error.message);
      return null; // or handle error appropriately
  }
}

async function getCatPic() {
  const imgurIDValue = await imgurID("https://api.nasa.gov/planetary/apod?api_key=v7q7rzVro4qWo1LN4slofSqYpblBA6k4Di3c30AE");
  if (imgurIDValue) {
      return imgurIDValue;
  } else {
      return "Failed to get Imgur ID for NASA picture, try again in a few seconds";
  }
}

class NasaCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'nasa'
    this.aliases = ['apod']
    this.description = 'Astronomy Picture of the Day (APOD) from NASA'
  }

  onCommand(message) {
    let args = this.getArgs(message)
    let user = args.shift()

    getCatPic().then(neko => {
      if(neko == "Please wait 5 seconds before running this command again"){
        message.channel.send({
          embeds: [{
              description: "Please wait 5 seconds before running this command again",
              color: 0x2A2A2A,
              timestamp: new Date(),
              footer: {
                  text: "BOT",
              },
          }],
      })
      } else{
        let picture = neko.split("||")[0];
        let explanation = neko.split("||")[1];
        this.sendMinecraftMessage(`/gc ${Encode(picture)}`)
        message.channel.send({
          embeds: [{
              image: {
                  url: picture,
                },
              description: explanation || "No description available for this image.",
              color: 0x2A2A2A,
              timestamp: new Date(),
              footer: {
                  text: "BOT",
              },
          }],
      })
      }
    })
  }
}

module.exports = NasaCommand