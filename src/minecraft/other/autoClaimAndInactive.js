const minecraftCommand = require("../../contracts/minecraftCommand.js");
const config = require("../../../config.json");
const guildConfig = require("../../contracts/guildConfig.js");
const axios = require("axios");
const eventBOT = new minecraftCommand(bot);
const schedule = require('node-schedule');
let ini = []
let kickables = []

// Inactive
function toMilli(days){
  return days * 86400000;
};
async function getInactive() {
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
        await getActivity(members[i].uuid, members[i].rank);
      } catch (error) {
        console.log("Error in getActivity:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching guild data:", error);
  }
};
async function getActivity(uuid, rank) {
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
// Autoclaim
async function getUsernameFromUUID(uuid) {
  const { data } = await axios.get('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid)
  let username = data.name
  return username
}
async function getRoles() {
  try {
    const { data } = await axios.get(guildConfig.ownGuildUrl())
    try {
      if (!guildConfig.isOwnGuild(data.guild)) {
        let ret = "This player is not in our guild."
        return ret
      }
    }
    catch {
      let ret = "Please confirm the name of the player you're trying to look up."
      return ret
    }
    ini = []
    for (let i = 0; i < data.guild.members.length + 1; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (i <= data.guild.members.length - 1) {
        let newData = data.guild.members[i];
        let expValue = Object.values(newData.expHistory)

        let total = expValue[0] + expValue[1] + expValue[2] + expValue[3] + expValue[4] + expValue[5] + expValue[6]
        let xp = total
        try {
          getRank(data.guild.members[i].uuid, data.guild.members[i].rank, xp)
        }
        catch {
          console.log("Well something fucked up..")
        }
      }
      else if (i == data.guild.members.length) {
        for (let s = 0; s < 100; s++) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  }
  catch (error) {
    let e = error.message
    if (e.includes("status code 500")) {
      return "Error has occured"
    }
    if (e.includes("status code 404")) {
      return "Error has occured"
    }
    else {
      return error
    }
  }
}
async function getRank(uuid, rank, xp) {
  const { data } = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?key=${config.minecraft.API.hypixelAPIkey}&uuid=${uuid}`)
  let name = await getUsernameFromUUID(uuid)
  let newlvl = 0
  for (let b = 0; b < Object.keys(data.profiles).length; b++) {
    if(newlvl < data.profiles[b]?.members[uuid]?.leveling?.experience){
      newlvl = data.profiles[b]?.members[uuid]?.leveling?.experience
    }
  }

  if (guildConfig.isProtectedRank(rank)) return;
  const target = guildConfig.rankForExperience(newlvl)
  if (target === undefined || rank == target) return
  ini.push(`${name} ${target}`)
}


// Schedule the tasks (cron syntax, host local time) from config.guild.
if (config.guild.autoClaim.enabled) {
  schedule.scheduleJob(config.guild.autoClaim.cron, () => {
    getRoles().then(a => {
      let interval = 750; // how much time should the delay between two iterations be (in milliseconds)?
      for (let index = 0; index < ini.length; ++index) {
        let el = ini[index]
        setTimeout(() => {
          eventBOT.warpSend(`/g setrank ${el}`)
        }, index * interval);
      }
    })
  });
}
if (config.guild.inactiveKick.enabled) {
  schedule.scheduleJob(config.guild.inactiveKick.cron, () => {
    kickables = []
    getInactive().then(() => {
      let interval = 750; // how much time should the delay between two iterations be (in milliseconds)?
      for (let index = 0; index < (kickables).length; ++index) {
        let el = kickables[index]
        setTimeout(() => {
          eventBOT.warpSend(`/g kick ${el} Kicked due to inactivity, you're free to re apply once you're active.`)
        }, index * interval);
      };
    })
  });
}
