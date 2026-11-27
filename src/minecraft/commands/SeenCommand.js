const minecraftCommand = require("../../contracts/minecraftCommand.js");
const { SKIPPED_UUID, getUUIDFromUsername, fetchPlayer, describeSeen } = require("../../contracts/commands/playerLookup.js");

async function getSeenFromUUID(uuid) {
  try {
    if (uuid === SKIPPED_UUID) return
    const data = await fetchPlayer(uuid)
    return describeSeen(data.player)
  }
  catch {
    return " never logged into Hypixel"
  }
}

async function getSeenFromUsername(username) {
  return await getSeenFromUUID(await getUUIDFromUsername(username))
}

class SeenCommand extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'seen'
    this.description = `Show's user's last logout date`
  }

  onCommand(username, message) {

    let args = message.split(" ")
    getSeenFromUsername(args[1]).then(stats => {
      this.send(`/gc ${args[1]}'s ${stats}`)
    })
  }
}
module.exports = SeenCommand
