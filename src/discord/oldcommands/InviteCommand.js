const DiscordCommand = require('../../contracts/DiscordCommand')

const config = require("../../../config.json");
const guildConfig = require("../../contracts/guildConfig.js");
const axios = require("axios");
let user = null


// Sky and Aria share one Discord server: an !invite without a keyword goes to
// whichever of the two guilds has fewer members (config.guild.invite). With no
// peerGuildId configured the bot always invites.
async function shouldInvite(){
  const invite = config.guild.invite;
  if (!invite.guildId || !invite.peerGuildId) {
    return true
  }
  try {
    const own = await axios.get(`https://api.hypixel.net/v2/guild?key=${config.minecraft.API.hypixelAPIkey}&id=${invite.guildId}`);
    const peer = await axios.get(`https://api.hypixel.net/v2/guild?key=${config.minecraft.API.hypixelAPIkey}&id=${invite.peerGuildId}`);
    const ownMembers = own.data.guild.members.length;
    const peerMembers = peer.data.guild.members.length;
    return ownMembers < peerMembers || (ownMembers === peerMembers && invite.winsTie === true)
  } catch (error) {
    console.error('Error fetching guild data:', error.message);
    return false;
  }
}
class InviteCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "commander"

    this.name = 'invite'
    this.aliases = ['i', 'inv']
    this.description = 'Invites the given user to the guild'
  }

  onCommand(message) {
    let args = message.content.trim().split(/\s+/);

    if (args.length < 2) {
      return;
    }
    const target = guildConfig.matchKeyword(args);
    if (target.keyword && !target.forUs) {
      return;
    }
    if (target.keyword){
      user = target.rest[0]
      this.sendMinecraftMessage(`/g invite ${user ? user : ''}`)
    } else {
      user = args[1]
      shouldInvite().then((invite) => {
        if (invite){
          this.sendMinecraftMessage(`/g invite ${user ? user : ''}`)
        }
      });
    }
    
  

    
    
  }
}

module.exports = InviteCommand
