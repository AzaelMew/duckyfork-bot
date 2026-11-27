const minecraftCommand = require("../../contracts/minecraftCommand.js");
const bridge = require("../../contracts/bridge.js")
const {
  fetchGuildOnline,
  mergePeerData,
  describeOnlineImage,
  renderChat,
  uploadImage,
  Encode,
  RENDER_STYLES,
} = require("../../contracts/commands/online.js");

class GuildList extends minecraftCommand {
  constructor(minecraft) {
    super(minecraft)

    this.name = 'online'
    this.aliases = ['online', 'on']
    this.description = 'Checks G Online'
  }

  async onCommand() {
    const skyData = await fetchGuildOnline(bot)
    // Without a peer (bridge disabled, or the peer is offline) only this
    // guild is shown.
    const peer = await bridge.postToPeer("/api/online", { message: "a" })
    const combinedData = mergePeerData(skyData, peer)
    const descriptionImg = describeOnlineImage(combinedData);

    renderChat(descriptionImg, RENDER_STYLES.minecraft).then(async (buffer) => {
      const imageUrl = await uploadImage(buffer);
      this.send(`/gc ${Encode(imageUrl)}`);
      console.log(`Image uploaded to: ${imageUrl}`);
    })
  }
}

module.exports = GuildList
