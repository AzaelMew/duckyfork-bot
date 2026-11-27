const { uploadImage } = require("../../contracts/API/imgurAPI.js");
const { demojify } = require("discord-emoji-converter");
const config = require("../../../config.json");

const uploader = require('../../contracts/Imgur/imgurExport');
const { encode } = require('../../contracts/stuf.js');

const axios = require('axios');

// Images are fetched into memory, so cap what a single link can cost us.
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const COMPRESS_THRESHOLD_BYTES = 10 * 1024 * 1024;

async function compressImage(buffer, maxSizeMB = 10, qualityReductionStep = 5) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (buffer.length <= maxSizeBytes) {
    console.log('Image already smaller than max size.  No compression needed.');
    return buffer;
  }

  try {
    // Lazy on purpose: sharp is native, and a host that runs with
    // features.imageCompression false (Aria) must boot without it.
    const sharp = require("sharp");

    let quality = 95;
    while (true) {
      try {
        const compressed = await sharp(buffer)
          .jpeg({ quality }) // Or .png({ quality }), .webp({ quality }), adjust to the original image format if needed
          .toBuffer();

        if (compressed.length <= maxSizeBytes) {
          console.log(`Compressed image to ${compressed.length} bytes`);
          return compressed;
        }

        quality -= qualityReductionStep;
        if (quality <= 0) {
          console.error('Compression failed: Could not reach target size.');
          return null;
        }
      } catch (error) {
        console.error('Error during compression:', error);
        return null;
      }
    }
  } catch (error) {
    console.error('Error accessing or processing image:', error);
    return null;
  }
}
async function downloadUploadDeleteImage(imageUrl) {
  if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
    throw new Error('No image URL to download');
  }

  // zip.azael.moe serves the raw file from /raw/, /u/ is the viewer page
  const downloadUrl = imageUrl.replace('zip.azael.moe/u/', 'zip.azael.moe/raw/');

  const response = await axios({
    url: downloadUrl,
    method: 'GET',
    responseType: 'arraybuffer',
    maxContentLength: MAX_IMAGE_BYTES,
    maxBodyLength: MAX_IMAGE_BYTES,
    timeout: 30000
  });

  let buffer = Buffer.from(response.data);

  // Compression (Sky only; Aria uploads the original)
  if (config.features.imageCompression && buffer.length > COMPRESS_THRESHOLD_BYTES) {
    const compressed = await compressImage(buffer);
    if (compressed) buffer = compressed;
  }

  const uploadResponse = await uploader.uploadBuffer(buffer);
  if (!uploadResponse || !uploadResponse.url) {
    throw new Error(`Image upload failed: ${uploadResponse?.message ?? 'no url returned'}`);
  }
  console.log('Image uploaded successfully');

  return uploadResponse.url;
}

class MessageHandler {
  constructor(discord, oldcommand) {
    this.discord = discord;
    this.oldcommand = oldcommand;
  }

  async onMessage(message) {
    try {
      if (message.author.id === client.user.id || !this.shouldBroadcastMessage(message)) {
        return;
      }
      this.oldcommand.handle(message);

      const content = this.stripDiscordContent(message).trim();
      if (content.length === 0 && message.attachments.size === 0) {
        return;
      }

      const username = message.member.displayName ?? message.author.username;
      if (username === undefined || username.length === 0) {
        return;
      }

      const formattedUsername = this.formatEmojis(username);
      const messageData = {
        member: message.member.user,
        channel: message.channel.id,
        username: formattedUsername.replaceAll(" ", ""),
        message: content,
        replyingTo: await this.fetchReply(message),
        discord: message,
      };

      const images = content.split(" ").filter((line) => line.startsWith("http"));
      for (const attachment of message.attachments.values()) {
        images.push(attachment.url);
      }

      if (images.length > 0) {
        for (const attachment of images) {
          try {
            const imgurLink = await downloadUploadDeleteImage(attachment)
            const encodedLink = encode(imgurLink)
            messageData.message = messageData.message.replace(attachment, encodedLink);

            if (messageData.message.includes(encodedLink) === false) {
              messageData.message += ` ${encodedLink}`;
            }
          } catch (error) {
            messageData.message += ` ${attachment}`;
          }
        }
      }

      if (messageData.message.length === 0) {
        return;
      }

      this.discord.broadcastMessage(messageData);
    } catch (error) {
      console.log(error);
    }
  }

  async fetchReply(message) {
    try {
      if (message.reference?.messageId === undefined || message.mentions === undefined) {
        return null;
      }

      const reference = await message.channel.messages.fetch(message.reference.messageId);

      const discUser = await message.guild.members.fetch(message.mentions.repliedUser.id);
      const mentionedUserName = discUser.nickname ?? message.mentions.repliedUser.globalName;

      if (config.discord.other.messageMode === "bot" && reference.embed !== null) {
        const name = reference.embeds[0]?.author?.name;
        if (name === undefined) {
          return mentionedUserName;
        }

        return name;
      }

      if (config.discord.other.messageMode === "minecraft" && reference.attachments !== null) {
        const name = reference.attachments.values()?.next()?.value?.name;
        if (name === undefined) {
          return mentionedUserName;
        }

        return name.split(".")[0];
      }

      if (config.discord.other.messageMode === "webhook") {
        if (reference.author.username === undefined) {
          return mentionedUserName;
        }

        return reference.author.username;
      }

      return mentionedUserName ?? null;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  stripDiscordContent(message) {
    let output = message.content
      .split("\n")
      .map((part) => {
        part = part.trim();
        return part.length === 0 ? "" : part.replace(/@(everyone|here)/gi, "").trim() + " ";
      })
      .join("");

    const hasMentions = /<@|<#|<:|<a:|<sound:/.test(message); // Added <sound: to the regex
    if (hasMentions) {
      // Replace <@486155512568741900> with @DuckySoLucky
      const userMentionPattern = /<@(\d+)>/g;
      const replaceUserMention = (match, mentionedUserId) => {
        const mentionedUser = message.guild?.members?.cache?.get(mentionedUserId); // Added optional chaining

        return mentionedUser ? `@${mentionedUser.displayName}` : "@UnknownUser"; // Handle cases where user is not found
      };
      output = output.replace(userMentionPattern, replaceUserMention);

      // Replace <#1072863636596465726> with #💬・guild-chat
      const channelMentionPattern = /<#(\d+)>/g;
      const replaceChannelMention = (match, mentionedChannelId) => {
        const mentionedChannel = message.guild?.channels?.cache?.get(mentionedChannelId); // Added optional chaining

        return mentionedChannel ? `#${mentionedChannel.name}` : "#unknown-channel"; // Handle cases where channel is not found
      };
      output = output.replace(channelMentionPattern, replaceChannelMention);

      // Replace <:KEKW:628249422253391902> with :KEKW: || Replace <a:KEKW:628249422253391902> with :KEKW:
      const emojiMentionPattern = /<a?:(\w+):\d+>/g;
      output = output.replace(emojiMentionPattern, ":$1:");

      // Replace <sound:1199699127190167643:1273380983973875854> with [Sound]
      const soundMentionPattern = /<sound:\d+:\d+>/g; // Regex for sound mentions
      output = output.replace(soundMentionPattern, "[Sound]"); // Replace with [Sound]
    }

    // Replace IP Adresses with [Content Redacted]
    const IPAddressPattern = /((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/g;
    output = output.replaceAll(IPAddressPattern, "[IP Address]");

    return this.formatEmojis(output);
  }

  shouldBroadcastMessage(message) {
    const isBot =
      message.author.bot && config.discord.channels.allowedBots.includes(message.author.id) === false ? true : false;
    const isValid = !isBot && (message.content.length > 0 || message.attachments.size > 0);
    const validChannelIds = [
      config.discord.channels.officerChannel,
      config.discord.channels.guildChatChannel,
      config.discord.channels.debugChannel,
    ];

    return isValid && validChannelIds.includes(message.channel.id);
  }
  shouldReadChannel(message) {
    return message.channel.id == "1165608524538187896"
  }
  formatEmojis(content) {
    // ? demojify() function has a bug. It throws an error when it encounters channel with emoji in its name. Example: #💬・guild-chat
    try {
      return demojify(content);
    } catch (e) {
      return content;
    }
  }
}

module.exports = MessageHandler;
