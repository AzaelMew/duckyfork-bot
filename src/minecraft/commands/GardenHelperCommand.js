const minecraftCommand = require("../../contracts/minecraftCommand.js");
const config = require("../../../config.json");

const NORMAL_ROWS = "Normal: 116 Speed (4 Lanes) or 93 Speed (5 Lanes) | 90° Yaw"
const MELON_PUMPKIN = "Normal: 155 Speed (Vertical Pumpkin) or 327 Speed (2 Lane) | 90° (Vert) and 145° or 35° (2 Lane) Angle Yaw"

const CROP_SETTINGS = {
    cocoa: "150 speed w/o Sprint | 55° Angle Pitch",
    cane: "327 Speed | 135° or 45° Angle Yaw",
    potato: NORMAL_ROWS,
    carrot: NORMAL_ROWS,
    wheat: NORMAL_ROWS,
    wart: NORMAL_ROWS,
    pumpkin: MELON_PUMPKIN,
    melon: MELON_PUMPKIN,
    cactus: "400 Speed | 90° Angle Yaw",
    mushroom: "\"233 speed 30degree offset towards way you walking, hold down forwards running into the mushroom block\" - and i'm not touching this again.",
}

class GHCommand extends minecraftCommand {
    constructor(minecraft) {
        super(minecraft)

        this.name = 'farmhelper'
        this.aliases = ["fh"]
        this.description = 'Gives needed farm info'
    }

    onCommand(username, message) {
        let args = message.toLowerCase().split(" ")
        const crop = args[1]
        if (crop === undefined || crop === "") {
            this.send("/gc Compatible farms at /visit farminghub l$H117|jjnhvsdpn/tOTLITR")
            return
        }
        // Per-crop speed and angle settings (from Shana's farmhelper).
        if (CROP_SETTINGS[crop] !== undefined) {
            this.send(`/gc ${CROP_SETTINGS[crop]}`)
            return
        }
        this.send(`/gc Unknown crop. Options: ${Object.keys(CROP_SETTINGS).join(", ")}`)
    }
}

module.exports = GHCommand
