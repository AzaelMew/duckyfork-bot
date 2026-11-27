const DiscordCommand = require('../../contracts/DiscordCommand')
const { getLocationFromUsername } = require('../../contracts/commands/playerLookup.js');

// Discord-only fallback: when the name itself cannot be resolved the channel
// gets this sentence instead of the generic "Error".
async function lookupLocation(username) {
    try {
        return await getLocationFromUsername(username, {
            onApiError: (error) => console.error('Error getting location from UUID:', error.message),
        })
    } catch (error) {
        console.error('Error getting location from username:', error.message);
        return "Couldn't find player by the name of " + username;
    }
}

class StalkCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"

        this.name = 'stalk'
        this.description = `Checks user's location`
    }

    async onCommand(message) {
        const user = await this.getPlayerTarget(message);
        if (!user) return;
        try {
            lookupLocation(user).then(location => {
                if (location == "Player is Offline") {
                    message.channel.send({
                        embeds: [{
                            description: "is currently offline.",
                            color: 0xFF0000,
                            timestamp: new Date(),
                            footer: {
                                text: "BOT",
                            },
                            author: {
                                name: `${user}`,
                                icon_url: 'https://minotar.net/helm/' + user + '.png',
                            },
                        }],
                    })
                }
                else if (location == "Player doesn't exist") {
                    message.channel.send({
                        embeds: [{
                            description: "does not exist",
                            color: 0xFF0000,
                            timestamp: new Date(),
                            footer: {
                                text: "BOT",
                            },
                            author: {
                                name: `${user}`,
                                icon_url: 'https://minotar.net/helm/' + user + '.png',
                            },
                        }],
                    })
                }
                else if (location != "Player is Offline") {
                    message.channel.send({
                        embeds: [{
                            description: location,
                            color: 0xcbbeb5,
                            timestamp: new Date(),
                            footer: {
                                text: "BOT",
                            },
                            author: {
                                name: `${user}'s location`,
                                icon_url: 'https://minotar.net/helm/' + user + '.png',
                            },
                        }],
                    })
                }
            })
        }
        catch {
            message.channel.send({
                embeds: [{
                    description: `Error`,
                    color: 0xFF0000
                }]
            })
        }
    }
}

module.exports = StalkCommand
