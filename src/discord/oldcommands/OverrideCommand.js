const DiscordCommand = require('../../contracts/DiscordCommand')

const guildConfig = require("../../contracts/guildConfig.js");

class OverrideCommand extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.name = 'override'
    this.aliases = ['o']
    this.permission = "mod"
    this.description = 'Executes commands as the minecraft bot'
  }

  onCommand(message) {
    let args = message.content.trim().split(/\s+/);
    const target = guildConfig.matchKeyword(args);
    if (!target.forUs) {
      return;
    }

    // Everything after the command and this bot's keyword
    args = target.rest;
    if (args.length == 0) {
      return message.reply(`No command specified`);
    }

    let command = args.join(' ');

    this.sendPromoteMessage(`/${command}`);

    message.reply(`\`/${command}\` has been executed in ${guildConfig.guildName()}`);
}
}

module.exports = OverrideCommand
