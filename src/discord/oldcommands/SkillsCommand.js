const DiscordCommand = require('../../contracts/DiscordCommand')
const { getSkillsFromUsername } = require('../../contracts/commands/skills.js');

function skillsText(sa, levels) {
  let skills = `**Skill Avg**:\n➣ ${sa}; **Farm**:\n➣ ${levels.farming}; **Mine**:\n➣ ${levels.mining}; **Comb**:\n➣ ${levels.combat}; **Forage**:\n➣ ${levels.foraging}; **Fish**:\n➣ ${levels.fishing}; **Ench**:\n➣ ${levels.enchanting}; **Alch**:\n➣ ${levels.alchemy}; **Carp**:\n➣ ${levels.carpentry}; **Rune**:\n➣ ${levels.runecrafting}; **Soci**:\n➣ ${levels.social}; **Taming**:\n➣ ${levels.taming}; `;
  return skills.replace(/\*\*(\w+)/g, '**˚$1');
}



class SkillsCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'skills'
    this.description = `Checks user's skills`
  }

  async onCommand(message) {
    const user = await this.getPlayerTarget(message);
    if (!user) return;
    getSkillsFromUsername(user).then(data => {
      if (data === undefined) return
      if(data.error){
        this.sendMinecraftMessage(`/gc ${data.error}`)
        message.channel.send({
          embeds: [{
            description: data.error,
            color: 0x2A2A2A,
            timestamp: new Date(),
            footer: {
              text: "BOT",
            },
            author: {
              name: `${user}'s skills`,
              icon_url: 'https://minotar.net/helm/' + user+'.png',
            },
          }],
        })
      }
      else{
      const skills = skillsText(data.sa, data.levels)
      this.sendMinecraftMessage(`/gc ${user}'s skills: ${skills.replaceAll(";", "").replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "")}`)
      message.channel.send({
        embeds: [{
          description: skills.replaceAll("; ", "\n").replaceAll(":","").replaceAll("˚","").replaceAll("¨", "\n").replace("˚", "").replace("Skill Avg","Skill Average").replace("Farm","Farming").replace("Mine","Mining").replace("Comb","Combat").replace("Forage","Foraging").replace("Fish","Fishing").replace("Ench","Enchanting").replace("Alch","Alchemy").replace("Carp","Carpentry").replace("Rune","Runecrafting").replace("Soci","Social"),
          color: 0x2A2A2A,
          timestamp: new Date(),
          footer: {
            text: "BOT",
          },
          author: {
            name: `${user}'s skills`,
            icon_url: 'https://minotar.net/helm/' + user+'.png',
          },
        }],
      })
    }
    })
  }
}

module.exports = SkillsCommand
