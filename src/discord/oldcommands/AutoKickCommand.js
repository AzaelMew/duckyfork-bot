const DiscordCommand = require('../../contracts/DiscordCommand');
const config = require("../../../config.json");
const guildConfig = require("../../contracts/guildConfig.js");
const axios = require('axios');

let ini = [];

async function getUsernameFromUUID(uuid) {
  const { data } = await axios.get('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid);
  return data.name;
}

async function getGMembers() {
  try {
    const { data } = await axios.get(guildConfig.ownGuildUrl());

    if (!data.guild || !guildConfig.isOwnGuild(data.guild)) {
      return "This player is not in our guild.";
    }

    let currentNumber = guildConfig.minimumLevel() * 100;

    for (let i = 0; i < data.guild.members.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      try {
        await getActivity(data.guild.members[i].uuid, data.guild.members[i].rank, currentNumber);
      } catch (error) {
        console.log("Error fetching activity for member:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching guild data:", error.message);
    return "An error has occurred.";
  }
}

async function getActivity(uuid, rank, min) {
  try {
    const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?key=${config.minecraft.API.hypixelAPIkey}&uuid=${uuid}`);
    let name = await getUsernameFromUUID(uuid);

    if (guildConfig.isKickExempt(name)) {
      console.log(`${name} is excluded from being kicked.`);
      return;
    }

    if (guildConfig.isProtectedRank(rank)) {
      console.log(`${name} has a privileged rank and will not be kicked.`);
      return;
    }

    let highestLevel = 0;
    for (let profile of Object.values(data.profiles || {})) {
      let level = profile?.members[uuid]?.leveling?.experience || 0;
      if (level > highestLevel) {
        highestLevel = level;
      }
    }

    console.log(`${name}'s highest level: ${highestLevel}, minimum required: ${min}`);

    if (highestLevel < min) {
      ini.push(name);
      console.log(`${name} will be kicked for not meeting the requirements.`);
    } else {
      console.log(`${name} meets the requirements and will not be kicked.`);
    }
  } catch (error) {
    console.error("Error fetching player activity data:", error);
  }
}

class AutoKickCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "mod";
    this.name = 'autokick';
    this.description = 'Kicks people who do not meet the requirements.';
  }

  async onCommand(message) {
    let args = message.content.trim().split(/\s+/);

    if (!guildConfig.matchKeyword(args).forUs) {
      return;
    }

    message.channel.send({
      embeds: [{
        description: `Getting player data`,
        color: 0x47F049
      }]
    });

    console.log("Fetching guild members...");
    ini = [];
    await getGMembers();
    console.log("Members to be kicked:", ini);

    let interval = 750; // Delay between each kick in milliseconds
    for (let index = 0; index < ini.length; index++) {
      let el = ini[index];
      setTimeout(() => {
        console.log(`Kicking member: ${el}`);
        this.sendPromoteMessage(`/g kick ${el} You do not meet the reqs for the guild.`);
      }, index * interval);
    }

    message.channel.send({
      embeds: [{
        description: `Let the purge... **BEGIN!**`,
        color: 0x47F049
      }]
    });
  }
}

module.exports = AutoKickCommand;
