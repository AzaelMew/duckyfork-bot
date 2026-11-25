const DiscordCommand = require('../../contracts/DiscordCommand')

const config = require("../../../config.json");
const guildConfig = require("../../contracts/guildConfig.js");
const axios = require("axios");
let kickables = []

function toMilli(days){
  return days * 86400000;
};
async function getGMembers(message) {
  try {
    // Fetch guild data and handle errors
    const { data } = await axios.get(guildConfig.ownGuildUrl());

    if (!data.guild) {
      console.log("Guild data not found.");
      return;
    }

    if (!guildConfig.isOwnGuild(data.guild)) {
      console.log("This player is not in our guild.");
      return;
    }

    const members = data.guild.members;

    if (!Array.isArray(members)) {
      console.log("Guild members data is not an array.");
      return;
    }

    console.log("Number of guild members:", members.length);

    kickables = [];

    for (let i = 0; i < members.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      try {
        await getActivity(members[i].uuid, message, members[i].rank);
      } catch (error) {
        console.log("Error in getActivity:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching guild data:", error);
  }
};
async function getActivity(uuid, message, rank) {
  try {
    const { data } = await axios.get(`https://api.hypixel.net/v2/player?uuid=${uuid}&key=${config.minecraft.API.hypixelAPIkey}`);
    let lastLogin = data.player.lastLogin;

    if (guildConfig.isKickExempt(data.player.displayname)) {
      console.log(`${data.player.displayname} is excluded from being kicked.`);
      return;
    }

    if (guildConfig.isProtectedRank(rank)) {
      console.log(`${data.player.displayname} has a privileged rank and will not be kicked.`);
      return;
    }

    if (new Date().getTime() - lastLogin > toMilli(config.guild.inactiveKick.days)) {
      kickables.push(data.player.displayname);
      console.log(`${data.player.displayname} will be kicked due to inactivity.`);
      console.log("Kickables:", kickables);
    } else {
      console.log(`${data.player.displayname} will not be kicked.`);
    }

    return kickables;
  } catch (error) {
    console.error("Error fetching player data:", error);
    return [];
  }
};
class InactiveCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "commander"

    this.name = 'kickinactive'
    this.description = 'Kicks inactive people.'
  }

  onCommand(message) {
    let args = message.content.trim().split(/\s+/);

    if (!guildConfig.matchKeyword(args).forUs) {
      return;
    }

    kickables = []
    getGMembers(message).then(kickabes => {
      let interval = 750; // how much time should the delay between two iterations be (in milliseconds)?
      for (let index = 0; index < (kickables).length; ++index) {
        let el = kickables[index]
        setTimeout(() => {
          this.sendMinecraftMessage(`/g kick ${el} Kicked due to inactivity, you're free to re apply once you're active.`)
        }, index * interval);
      };
    })
    message.channel.send({
      embeds: [{
        description: `Kicking inactive users...`,
        color: 0x47F049
      }]
    })
  }
}
module.exports = InactiveCommand