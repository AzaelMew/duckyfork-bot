const DiscordCommand = require('../../contracts/DiscordCommand')

const config = require("../../../config.json");
const axios = require("axios");
const nbt = require('prismarine-nbt');
const Canvas = require('canvas');
const uploader = require('../../contracts/Imgur/imgurExport');
const { url } = require('inspector');
const util = require('util');
const { encode: Encode } = require('../../contracts/stuf.js');
Canvas.registerFont('./src/contracts/Fonts/MinecraftRegular-Bmg3.ttf', { family: 'Minecraft' });
Canvas.registerFont('./src/contracts/Fonts/minecraft-bold.otf', { family: 'MinecraftBold' });
Canvas.registerFont('./src/contracts/Fonts/2_Minecraft-Italic.otf', { family: 'MinecraftItalic' });
Canvas.registerFont('./src/contracts/Fonts/unifont.ttf', { family: 'MinecraftUnicode' });
const RGBA_COLOR = {
    0: 'rgba(0,0,0,1)',
    1: 'rgba(0,0,170,1)',
    2: 'rgba(0,170,0,1)',
    3: 'rgba(0,170,170,1)',
    4: 'rgba(170,0,0,1)',
    5: 'rgba(170,0,170,1)',
    6: 'rgba(255,170,0,1)',
    7: 'rgba(170,170,170,1)',
    8: 'rgba(85,85,85,1)',
    9: 'rgba(85,85,255,1)',
    a: 'rgba(85,255,85,1)',
    b: 'rgba(85,255,255,1)',
    c: 'rgba(255,85,85,1)',
    d: 'rgba(255,85,255,1)',
    e: 'rgba(255,255,85,1)',
    f: 'rgba(255,255,255,1)',
};

async function getCanvasWidthAndHeight(lore) {
    const canvas = Canvas.createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    ctx.font = '24px Minecraft';

    let highestWidth = 0;
    for (let i = 0; i < lore.length; i++) {
        const width = ctx.measureText(lore[i].replace(/\u00A7[0-9A-FK-OR]/gi, '')).width;
        if (width > highestWidth) {
            highestWidth = width;
        }
    }

    return { height: lore.length * 24 + 15, width: highestWidth + 60 };
}

async function renderLore(itemName, lore) {
    if (itemName) lore.unshift(itemName);
    const measurements = await getCanvasWidthAndHeight(lore);
    const canvas = Canvas.createCanvas(measurements.width, measurements.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#100110';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.shadowColor = '#131313';
    ctx.font = '24px Minecraft';
    ctx.fillStyle = '#ffffff';

    for (const [index, item] of Object.entries(lore)) {
        let width = 10;
        const splitItem = item.split('§');
        if (splitItem[0].length == 0) splitItem.shift();

        for (const toRenderItem of splitItem) {
            ctx.fillStyle = RGBA_COLOR[toRenderItem[0]];

            if (toRenderItem.startsWith('l')) ctx.font = '24px MinecraftBold, MinecraftUnicode';
            else if (toRenderItem.startsWith('o')) ctx.font = '24px MinecraftItalic, MinecraftUnicode';
            else ctx.font = '24px Minecraft, MinecraftUnicode';

            ctx.fillText(toRenderItem.substring(1), width, index * 24 + 29);
            width += ctx.measureText(toRenderItem.substring(1)).width;
        }
    }

    return canvas.toBuffer();
}

async function getLastProfile(data) {
    const profiles = data.profiles;
    return profiles.sort((a, b) => b.selected - a.selected)[0];
}
const parseNbt = util.promisify(nbt.parse);
async function nameToUUID(name) {
    try {
        return (await axios.get(`https://api.mojang.com/users/profiles/minecraft/${name}`)).data.id;
    } catch (e) {
        return null;
    }
}
async function decodeData(buffer) {
    const parsedNbt = await parseNbt(buffer);
    return nbt.simplify(parsedNbt);
}
function isValidUsername(username) {
    if (username.match(/^[0-9a-zA-Z_]+$/)) {
        return true;
    } else {
        return false;
    }
}
async function getPlayer(player, profile) {
    if (typeof player !== 'string' || !isValidUsername(player)) {
        throw new Error('Invalid Username');
    }

    const mojangResponse = await nameToUUID(player);
    if (!mojangResponse) throw new Error('Player not found');
    const hypixelResponse = await axios.get(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${mojangResponse}&key=${config.minecraft.API.hypixelAPIkey}`);
    if (!hypixelResponse) throw new Error("Couldn't get a response from the API");
    if (hypixelResponse.data.profiles === null) throw new Error(`Couldn\'t find any Skyblock profile that belongs to ${player}`);
    let profileData = await getLastProfile(hypixelResponse.data);
    if (profile) {
        profileData = hypixelResponse.data.profiles.find((p) => p.cute_name.toLowerCase() === profile.toLowerCase()) || getLastProfile(hypixelResponse.data);
    }
    if (!profileData) throw new Error(`Couldn't find the specified Skyblock profile that belongs to ${player}.`);
    return { memberData: profileData.members[mojangResponse], profileData, profiles: hypixelResponse.profiles };
}
async function getData(username, profile, itemNumber) {
    if (!/^[1-9]$/.test(itemNumber))
        return "Invalid item number. Must be between 1 and 9."

    const searchedPlayer = await getPlayer(username, profile).catch((err) => {
        return err
    });
    const playerProfile = searchedPlayer.memberData;

    const inventory = playerProfile?.inventory?.inv_contents?.data;
    if (!inventory) {
        return " has no items in their inventory or has their inventory API disabled."
    }

    const inventoryData = (await decodeData(Buffer.from(inventory, 'base64'))).i;
    const selectedItem = inventoryData[itemNumber - 1];
    if (!selectedItem || !Object.keys(selectedItem || {}).length) {
        return `This player does not have an item in slot ${itemNumber}.`;
    }

    const renderedItem = await renderLore(selectedItem?.tag?.display?.Name, selectedItem?.tag?.display?.Lore);

    const uploadResponse = await uploader.uploadBuffer(renderedItem);
    if (!uploadResponse.url) return `Failed to upload image.`;

    return uploadResponse.url
}
async function getUUIDFromUsername(username) {
    if (!(/^[a-zA-Z0-9_]{2,16}$/mg.test(username))) {
        return "Error"
    }
    else {
        try {
            const { data } = await axios.get('https://api.mojang.com/users/profiles/minecraft/' + username)
            let uuid = data.id
            let user = username
            return uuid
        } catch {
            const { data } = await axios.get('https://api.ashcon.app/mojang/v2/user/' + username)
            let uuid = data.uuid.replace("-","");
            let user = username
            return uuid
        }

    }
}
class RenderCommand extends DiscordCommand {
    constructor(discord) {
        super(discord)
        this.permission = "all"
        this.name = 'render'
        this.description = 'Renders an item from a hotbar slot. Use !render <slot> for your default IGN.'
    }

    async onCommand(message) {
        const [command, target, second, third] = message.content.trim().split(/\s+/);
        if (!target) {
            return message.channel.send(`Usage: \`${command} <slot>\` or \`${command} <IGN> [profile] <slot>\`.`);
        }

        const useDefault = target === "--me" || (!second && /^[1-9]$/.test(target));
        const username = useDefault
            ? await this.getDefaultPlayerTarget(message, `${command} <IGN> <slot>`)
            : target;
        if (!username) return;

        const profile = third && isNaN(Number(second)) ? second : undefined;
        const itemNumber = profile ? third : (second ?? target);
        return getData(username, profile, itemNumber).then(returnurl => {
            if(returnurl.toString().includes("imgur")){
                let game = Encode(returnurl)
                this.sendMinecraftMessage(`/gc ${username}: ${game}`)
                message.channel.send({
                    embeds: [{
                        image: {
                            url: returnurl,
                        },
                        color: 0x2A2A2A,
                        timestamp: new Date(),
                        footer: {
                            text: "BOT",
                        },
                        author: {
                            name: `${username}`,
                            icon_url: 'https://minotar.net/helm/' + username+'.png',
                        },
                    }],
                })
            }
            else{
                this.sendMinecraftMessage(`/gc ${username}: ${returnurl}`)
                message.channel.send({
                    embeds: [{
                        description: returnurl,
                        color: 0x2A2A2A,
                        timestamp: new Date(),
                        footer: {
                            text: "BOT",
                        },
                        author: {
                            name: `${username}`,
                            icon_url: 'https://minotar.net/helm/' + username+'.png',
                        },
                    }],
                })
            }
        })
    }
}

module.exports = RenderCommand
