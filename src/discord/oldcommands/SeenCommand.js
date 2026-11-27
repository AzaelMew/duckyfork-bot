const DiscordCommand = require('../../contracts/DiscordCommand');
const { SKIPPED_UUID, getUUIDFromUsername, fetchPlayer, describeSeen } = require('../../contracts/commands/playerLookup.js');

// Cache system
const cache = {}; // { [uuid]: { data, timestamp } }
const cacheDuration = 5 * 60 * 1000; // 5 minutes

async function getSeenFromUUID(uuid) {
    try {
        if (!uuid) {
            uuid = "a";
        }
        if (uuid === SKIPPED_UUID) return;

        const now = Date.now();

        let data;

        try {
            data = await fetchPlayer(uuid);

            if (data.success === false) {
                console.log(`API failure for UUID ${uuid}, trying to use cached data...`);
                // If cached, use it
                if (cache[uuid] && (now - cache[uuid].timestamp < cacheDuration)) {
                    data = cache[uuid].data;
                } else {
                    return "API unavailable and no cached data.";
                }
            } else {
                // Only update cache if success is true
                cache[uuid] = {
                    data: data,
                    timestamp: now
                };
            }
        } catch (error) {
            console.log(`Request error for UUID ${uuid}, trying to use cached data...`);
            if (cache[uuid] && (now - cache[uuid].timestamp < cacheDuration)) {
                data = cache[uuid].data;
            } else {
                return "API unavailable and no cached data.";
            }
        }

        return describeSeen(data.player ?? {}, { format: "discord" });

    } catch (error) {
        return "never logged into Hypixel";
    }
}

async function getSeenFromUsername(username) {
    return await getSeenFromUUID(await getUUIDFromUsername(username));
}

class SeenCommand extends DiscordCommand {
    constructor(discord) {
        super(discord);
        this.permission = "all";

        this.name = 'seen';
        this.description = `Shows user's last logout date`;
    }

    async onCommand(message) {
        const user = await this.getPlayerTarget(message);
        if (!user) return;
        getSeenFromUsername(user).then(stats => {
            message.channel.send({
                embeds: [{
                    description: stats,
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
            });
        });
    }
}

module.exports = SeenCommand;
