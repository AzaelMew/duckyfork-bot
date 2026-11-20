const minecraftCommand = require('../../contracts/minecraftCommand');
const axios = require('axios');
const uploader = require('../../contracts/Imgur/imgurExport');

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

function charInc(str, int) {
  const charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let incrementedStr = '';
  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    let index = charSet.indexOf(char);

    if (index == -1) {
      incrementedStr += char;
    } else {
      let offset = index + int
      while(offset >= charSet.length){
        offset -= charSet.length
      }
      while(offset < 0){
        offset += charSet.length
      }
      let nextChar = charSet[offset];
      incrementedStr += nextChar;
    }
  }
  return incrementedStr;
}
function Encode(url) {
  let encoded = "l$"
  if (url.startsWith('http://')) {
    encoded += 'h';
    url = url.slice(7); // Remove the 'http://' part
  } else if (url.startsWith('https://')) {
    encoded += 'H';
    url = url.slice(8); // Remove the 'https://' part
  }

  if (url.endsWith('.png')) {
    encoded += '1';
    url = url.slice(0, -4); // Remove the '.png' part
  } else if (url.endsWith('.jpg')) {
    encoded += '2';
    url = url.slice(0, -4); // Remove the '.jpg' part
  } else if (url.endsWith('.jpeg')) {
    encoded += '3';
    url = url.slice(0, -5); // Remove the '.jpeg' part
  } else if (url.endsWith('.gif')) {
    encoded += '4';
    url = url.slice(0, -4); // Remove the '.gif' part
  } else {
    encoded += '0';
  }

  let dotIndices = [];
  for (let i = 0; (i < url.length) && (i <= 8); i++) {
    if (url[i] === '.') {
      dotIndices.push(i);
      if (dotIndices.length === 9) break; // Stop after 9 dots
    }
  }

  let first9 = url.substring(0, 9)
  let then = url.substring(9).replace(/\./g, '^');
  first9 = first9.replace(/\./g, '');
  let shifted = charInc(first9 + then, 1)

  encoded += dotIndices.map(index => index.toString()).join('') + '|';
  encoded += shifted


  return encoded;
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