const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { getSkillsFromUsername } = require("../../contracts/commands/skills.js");

function skillsText(sa, levels) {
  return `˚**Skill Avg**:\n➣ ${sa}; **Farm**:\n➣ ${levels.farming}; **Mine**:\n➣ ${levels.mining}; **Comb**:\n➣ ${levels.combat}; **Forage**:\n➣ ${levels.foraging}; **Fish**:\n➣ ${levels.fishing}; **Ench**:\n➣ ${levels.enchanting}; **Alch**:\n➣ ${levels.alchemy}; **Carp**:\n➣ ${levels.carpentry}; **Rune**:\n➣ ${levels.runecrafting}; **Soci**:\n➣ ${levels.social}; **Taming**:\n➣ ${levels.taming}`;
}



class SkillsCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'skills'

    this.description = "Checks user's skills"
  }

  async onCommand(username, message) {
  
    let args = message.split(" ")
    if (message.endsWith("!skills")) {
      getSkillsFromUsername(username).then(skills => {
        if (skills === undefined) return
        if (skills.error) {
          this.send(`/gc ${skills.error}`)
        }
        else {
          const text = skillsText(skills.sa, skills.levels)
          this.send(`/gc ${username}'s skills: ${text.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${username}'s skills`, message: `${text.replaceAll("; ", "\n").replaceAll(":", "").replaceAll("˚","").replace("Skill Avg", "Skill Average").replace("Farm", "Farming").replace("Mine", "Mining").replace("Comb", "Combat").replace("Forage", "Foraging").replace("Fish", "Fishing").replace("Ench", "Enchanting").replace("Alch", "Alchemy").replace("Carp", "Carpentry").replace("Rune", "Runecrafting").replace("Soci", "Social").replace("˚", "")}` })
        }
      })
    }
    else {
      getSkillsFromUsername(args[1]).then(skills => {
        if (skills === undefined) return
        if (skills.error) {
          this.send(`/gc ${skills.error}`)
        }
        else {
          const text = skillsText(skills.sa, skills.levels)
          this.send(`/gc ${args[1]}'s skills: ${text.replaceAll("*", "").replaceAll("\n➣", "").replaceAll("\n", "").replaceAll(";", "˚").replaceAll("¨", "˚")}`)
          this.minecraft.broadcastCommandEmbed({ username: `${args[1]}'s skills`, message: `${text.replaceAll("; ", "\n").replaceAll(":", "").replaceAll("˚","").replace("Skill Avg", "Skill Average").replace("Farm", "Farming").replace("Mine", "Mining").replace("Comb", "Combat").replace("Forage", "Foraging").replace("Fish", "Fishing").replace("Ench", "Enchanting").replace("Alch", "Alchemy").replace("Carp", "Carpentry").replace("Rune", "Runecrafting").replace("Soci", "Social").replace("˚", "")}` })
        }
      })
    }
  }
}

module.exports = SkillsCommand
