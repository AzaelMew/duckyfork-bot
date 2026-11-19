const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const helperFunctions = require("./helperFunctions.js");
const config = require("../../config.json");
const axios = require("axios");

async function apicall(message) {
  try {
    const response = await axios.post('http://192.168.0.6:3001/api/command', { message: message }, { headers: { Authorization: require("../../config.json").web.token } })
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused: Aria is offline');
    } else {
      console.error('An error occurred:', error.message);
    }
  }
}
class minecraftCommand {
  constructor(minecraft) {
    this.minecraft = minecraft;
  }

  getArgs(message) {
    const args = message.split(" ");

    args.shift();

    return args;
  }

  send(message, n = 1) {
    if (bot === undefined && bot._client.chat === undefined) {
      return;
    }
    apicall(message)
    
    bot.chat(message);

  }
  warpSend(message, n = 1) {
    if (bot === undefined && bot._client.chat === undefined) {
      return;
    }
    bot.chat(message);
  }
  eventSend(message, n = 1) {
    if (bot === undefined && bot._client.chat === undefined) {
      return;
    }
    apicall(message)
    bot.chat(message);
  }
  onCommand(player, message) {
    throw new Error("Command onCommand method is not implemented yet!");
  }

}

module.exports = minecraftCommand;
