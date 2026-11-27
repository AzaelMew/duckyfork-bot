const DiscordCommand = require('../../contracts/DiscordCommand')
const { Embed } = require("../../contracts/embedHandler.js");
const bridge = require("../../contracts/bridge.js")
const {
  fetchGuildOnline,
  mergePeerData,
  describeOnlineImage,
  sortOnline,
  peerCounts,
  renderChat,
  uploadImage,
  Encode,
  RENDER_STYLES,
} = require("../../contracts/commands/online.js");

const PEER_FOOTER = "• Numbers inside brackets are Sky/Aria counts";

class GuildList extends DiscordCommand {
  constructor(discord) {
    super(discord)
    this.permission = "all"

    this.name = 'online'
    this.aliases = ['online', 'on']
    this.description = 'Checks G Online'
  }

  async onCommand(cat) {
    const skyData = await fetchGuildOnline(bot)
    // Without a peer (bridge disabled, or the peer is offline) only this
    // guild is shown.
    const peer = await bridge.postToPeer("/api/online", { message: "a" })
    const combinedData = mergePeerData(skyData, peer)
    const description = `**Total Members:** ${combinedData.totalMembers}${peerCounts(combinedData.skyTotalMembers, combinedData.ariaTotalMembers)}\n**Online Members:** ${combinedData.onlineMembers}${peerCounts(combinedData.skyOnlineMembers, combinedData.ariaOnlineMembers)}\n${sortOnline(combinedData.online).join("\n")}`;
    const embed = new Embed("#2ECC71", "Online Members", description, PEER_FOOTER);
    const descriptionImg = describeOnlineImage(combinedData);

    renderChat(descriptionImg, RENDER_STYLES.discord).then(async (buffer) => {
      const imageUrl = await uploadImage(buffer);
      this.sendMinecraftMessage(`/gc ${Encode(imageUrl)}`);
      console.log(`Image uploaded to: ${imageUrl}`);
      //cat.channel.send(imageUrl);

      cat.channel.send({
        embeds: [{
          image: {
            url: imageUrl,
          },
          color: 0x2A2A2A,
          ...(bridge.enabled ? { footer: { text: PEER_FOOTER } } : {}),
        }],
      })
    })

    /*
    cat.channel.send({
      embeds: [embed],
    })*/

  }
}

module.exports = GuildList
