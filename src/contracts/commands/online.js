// Shared guild-online lookup for the in-game (!online) and Discord (old)
// command. Both commands ask Hypixel's `/g online` through this module, merge
// the peer bot's answer, render the same image and upload it the same way;
// only the delivery (guild chat vs Discord message) and the image style differ.
const Canvas = require("canvas");
const imgur = require("imgur-anonymous-uploader");
const bridge = require("../bridge.js");
const guildConfig = require("../guildConfig.js");
const HypixelDiscordChatBridgeError = require("../errorHandler.js");

const uploader = new imgur(require("../Imgur/imgurTokens.js").clientId);

Canvas.registerFont('./src/fonts/MinecraftRegular-Bmg3.ttf', { family: 'Minecraft' });
Canvas.registerFont('./src/fonts/minecraft-bold.otf', { family: 'MinecraftBold' });
Canvas.registerFont('./src/fonts/2_Minecraft-Italic.otf', { family: 'MinecraftItalic' });
Canvas.registerFont('./src/fonts/unifont.ttf', { family: 'MinecraftUnicode' });

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
  r: 'rgba(255,255,255,1)', // reset
};

// Only the box/shadow colours used to differ between the two commands.
const RENDER_STYLES = {
  minecraft: { shadowColor: 'rgba(0, 0, 0, 0.7)', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  discord: { shadowColor: 'rgba(0, 0, 0, 0.2)', backgroundColor: 'rgba(0, 0, 0, 0)' },
};

function charInc(str, int) {
  const charSet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let incrementedStr = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = charSet.indexOf(char);

    if (index === -1) {
      incrementedStr += char;
    } else {
      let offset = index + int;
      while (offset >= charSet.length) {
        offset -= charSet.length;
      }
      while (offset < 0) {
        offset += charSet.length;
      }
      incrementedStr += charSet[offset];
    }
  }
  return incrementedStr;
}

function decode(string) {
  if (!string.startsWith('l$')) {
    throw new Error('String does not appear to be in STuF');
  }
  const prefix = string[2];
  const suffix = string[3];
  const dotIndices = string.slice(4, string.indexOf('|')).split('').map(Number);
  const urlBody = string.slice(string.indexOf('|') + 1);

  const first9 = urlBody.slice(0, 9 - dotIndices.length);
  const then = urlBody.slice(9 - dotIndices.length).replace(/\^/g, '.');

  let url = first9 + then;
  url = charInc(url, -1);

  // Restore the dots in the first part of the URL
  dotIndices.forEach((index) => {
    url = url.slice(0, index) + '.' + url.slice(index);
  });

  // Add the prefix back
  if (prefix === 'h') {
    url = 'http://' + url;
  } else if (prefix === 'H') {
    url = 'https://' + url;
  }

  // Add the suffix back
  if (suffix === '1') {
    url += '.png';
  } else if (suffix === '2') {
    url += '.jpg';
  } else if (suffix === '3') {
    url += '.jpeg';
  } else if (suffix === '4') {
    url += '.gif';
  }

  return url;
}

function Encode(url) {
  let encoded = "l$";
  if (url.startsWith('http://')) {
    encoded += 'h';
    url = url.slice(7); // Remove the 'http://' part
  } else if (url.startsWith('https://')) {
    encoded += 'H';
    url = url.slice(8); // Remove the 'https://' part
  }

  if (url.endsWith('.png')) {
    encoded += '1';
    url = url.slice(0, -4); // Remove the '.png' part
  } else if (url.endsWith('.jpg')) {
    encoded += '2';
    url = url.slice(0, -4); // Remove the '.jpg' part
  } else if (url.endsWith('.jpeg')) {
    encoded += '3';
    url = url.slice(0, -5); // Remove the '.jpeg' part
  } else if (url.endsWith('.gif')) {
    encoded += '4';
    url = url.slice(0, -4); // Remove the '.gif' part
  } else {
    encoded += '0';
  }

  const dotIndices = [];
  for (let i = 0; (i < url.length) && (i <= 8); i++) {
    if (url[i] === '.') {
      dotIndices.push(i);
      if (dotIndices.length === 9) break; // Stop after 9 dots
    }
  }

  let first9 = url.substring(0, 9);
  const then = url.substring(9).replace(/\./g, '^');
  first9 = first9.replace(/\./g, '');
  const shifted = charInc(first9 + then, 1);

  encoded += dotIndices.map(index => index.toString()).join('') + '|';
  encoded += shifted;

  return encoded;
}

function cleanChatText(description) {
  const lines = description.split('\n');
  const cleanedLines = [];

  for (let line of lines) {
    // Remove markdown formatting and backslashes
    line = line
      .replace(/\*\*(.*?)\*\*/g, '$1')     // bold
      .replace(/\*(.*?)\*/g, '$1')         // italic
      .replace(/__(.*?)__/g, '$1')         // underline
      .replace(/\\/g, '');                 // remove backslashes

    const trimmed = line.trim();
    if (trimmed.length === 0) {
      cleanedLines.push('');
      continue;
    }

    // Handle ✦-separated names
    if (trimmed.includes('✦')) {
      const names = trimmed.split('✦')
        .map(name => name.trim())
        .filter(name => name.length > 0);
      cleanedLines.push(`§b${names.join(', ')}`);
      continue;
    }

    // Rank headers (e.g., "Elder", "Champion")
    const isHeader = /^[a-zA-Z\s]+$/.test(trimmed);
    if (isHeader) {
      cleanedLines.push(`§a-- ${trimmed} --`);
      continue;
    }

    // Stat lines (e.g., "Total Members: 123 | (111/12)")
    const statMatch = trimmed.match(/^([^:]+:)\s*(.*)$/);
    if (statMatch) {
      const label = statMatch[1].trim();
      const value = statMatch[2].trim();
      cleanedLines.push(`§e${label} §a${value}`);
      continue;
    }

    // Fallback: just return line
    cleanedLines.push(trimmed);
  }
  cleanedLines.shift();
  return cleanedLines.join('\n');
}

function parseColorChunks(text) {
  const parts = text.split(/§([0-9a-fr])/i);
  const chunks = [];

  let currentColor = 'f';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i].length > 0) {
        chunks.push({
          text: parts[i],
          color: RGBA_COLOR[currentColor] || 'rgba(255,255,255,1)'
        });
      }
    } else {
      currentColor = parts[i].toLowerCase();
    }
  }

  return chunks;
}

function wrapChatLines(ctx, text, maxWidth) {
  const paragraphs = text.split('\n');
  const wrappedLines = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      wrappedLines.push({ segments: [], align: 'left' });
      continue;
    }

    const chunks = parseColorChunks(paragraph);
    let line = [];
    let lineWidth = 0;

    let alignment = 'left';
    if (paragraph.includes('--') && !paragraph.includes(',')) {
      alignment = 'center';
    }

    for (const chunk of chunks) {
      const words = chunk.text.split(' ');

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testText = (line.length > 0 ? ' ' : '') + word;
        const testWidth = ctx.measureText(testText).width;

        if (lineWidth + testWidth > maxWidth && line.length > 0) {
          wrappedLines.push({ segments: line, align: alignment });
          line = [];
          lineWidth = 0;
        }

        const finalText = (line.length > 0 ? ' ' : '') + word;
        line.push({ text: finalText, color: chunk.color });
        lineWidth += ctx.measureText(finalText).width;
      }
    }

    if (line.length > 0) {
      wrappedLines.push({ segments: line, align: alignment });
    }
  }

  return wrappedLines;
}

async function renderChat(description, style = RENDER_STYLES.minecraft, maxLineWidth = 640) {
  description = cleanChatText(description);

  const tempCanvas = Canvas.createCanvas(maxLineWidth, 1000);
  const ctx = tempCanvas.getContext('2d');

  ctx.font = '20px Minecraft, MinecraftUnicode';
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.shadowColor = style.shadowColor;
  ctx.textBaseline = 'top';

  const lines = wrapChatLines(ctx, description, maxLineWidth - 16);

  const lineHeight = 24;
  const padding = 8;
  const contentWidth = maxLineWidth;
  const contentHeight = lines.length * lineHeight + padding * 2;

  const canvasWidth = contentWidth + 32;
  const canvasHeight = contentHeight + 32;

  const finalCanvas = Canvas.createCanvas(canvasWidth, canvasHeight);
  const finalCtx = finalCanvas.getContext('2d');

  finalCtx.font = ctx.font;
  finalCtx.fillStyle = ctx.fillStyle;
  finalCtx.shadowOffsetX = ctx.shadowOffsetX;
  finalCtx.shadowOffsetY = ctx.shadowOffsetY;
  finalCtx.shadowColor = ctx.shadowColor;
  finalCtx.textBaseline = 'top';

  const boxX = (canvasWidth - contentWidth) / 2;
  const boxY = (canvasHeight - contentHeight) / 2;
  const borderRadius = 12;

  // Helper: draw rounded rectangle
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Draw box background
  drawRoundedRect(finalCtx, boxX, boxY, contentWidth, contentHeight, borderRadius);
  finalCtx.fillStyle = style.backgroundColor;
  finalCtx.fill();

  // Draw box border
  finalCtx.strokeStyle = 'rgba(161, 10, 133, 0.8)';
  finalCtx.lineWidth = 2;
  finalCtx.stroke();

  // Draw all text fully centered
  for (let i = 0; i < lines.length; i++) {
    const { segments } = lines[i];

    const lineWidth = segments.reduce(
      (sum, s) => sum + finalCtx.measureText(s.text).width,
      0
    );

    let x = boxX + (contentWidth - lineWidth) / 2;
    const y = boxY + padding + i * lineHeight;

    for (const segment of segments) {
      finalCtx.fillStyle = segment.color;
      finalCtx.fillText(segment.text, x, y);
      x += finalCtx.measureText(segment.text).width;
    }
  }

  return finalCanvas.toBuffer();
}

// Turn the lines Hypixel sent after `/g online` into
// { totalMembers, onlineMembers, online: [{ rank, players }] }.
// Both counts stay strings: the callers print them as they arrived.
function parseGuildOnline(messages) {
  const onlineMembers = messages.find((m) => m.startsWith("Online Members: ")).replace("Online Members: ", "");
  const totalMembers = messages.find((m) => m.startsWith("Total Members: ")).replace("Total Members: ", "");

  const online = messages
    .flatMap((item, index) => {
      if (!item.includes("-- ")) return;

      const nextLine = messages[index + 1];
      if (nextLine.includes("●")) {
        const rank = item.replaceAll("--", "").trim();
        const players = nextLine
          .split("●")
          .map((player) => player.trim())
          .filter((player) => player);

        if (!rank || !players) return;

        return { rank, players };
      }
    })
    .filter((item) => item);

  return { totalMembers, onlineMembers, online };
}

async function fetchGuildOnline(bot) {
  if (!bot || !bot._client.chat) {
    throw new HypixelDiscordChatBridgeError(
      "Bot doesn't seem to be connected to Hypixel. Please try again."
    );
  }

  const cachedMessages = [];
  const messages = new Promise((resolve, reject) => {
    const listener = (message) => {
      message = message.toString();
      cachedMessages.push(message);

      if (message.startsWith("Offline Members")) {
        bot.removeListener("message", listener);
        resolve(cachedMessages);
      }
    };

    bot.on("message", listener);
    setTimeout(() => {
      bot.chat("/g online");
    }, 150);

    setTimeout(() => {
      bot.removeListener("message", listener);
      reject("Command timed out. Please try again.");
    }, 5000);
  });

  try {
    const message = await messages;
    return parseGuildOnline(message);
  } catch (error) {
    console.error("Error processing the command:", error);
    throw new Error(error);
  }
}

// Rank-ordered "*rank* + ✦ players" blocks, one string per rank.
const sortOnline = (online) => {
  // Define the rank order for sorting
  const rankOrder = guildConfig.allRankNames();

  // Sort the `online` array based on the rank order
  const sortedOnline = online
    .sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank)) // Sort by rank order
    .flatMap(({ rank, players }) => {
      if (!rank || !players || players.length === 0) return; // Skip invalid or empty entries

      // Format the rank and player list
      const formattedRank = `\n**${rank}**`;

      const formattedPlayers = players.map((player) => `✦ ${player.replace("_", "\\_").replace("[VIP]", "").replace("[VIP+]", "").replace("[MVP]", "").replace("[MVP+]", "").replace("[MVP++]", "").replace("[YOUTUBE]", "")}`).join(" ");

      return `${formattedRank}\n${formattedPlayers}`;
    })
    .filter(Boolean); // Remove undefined entries

  return sortedOnline;
};

const NO_PEER_DATA = { totalMembers: "0", onlineMembers: "0", online: [] };

// "   |   (own/peer)" after a total, only when there is a peer bot.
function peerCounts(own, peer) {
  return bridge.enabled ? `   |   (${own}/${peer})` : "";
}

const deepMergeGuildData = (data1, data2) => {
  // Define the rank hierarchy
  const rankOrder = guildConfig.allRankNames();

  // Combine totalMembers and onlineMembers as numbers
  const totalMembers = (parseInt(data1.totalMembers, 10) || 0) + (parseInt(data2.totalMembers, 10) || 0);
  const onlineMembers = (parseInt(data1.onlineMembers, 10) || 0) + (parseInt(data2.onlineMembers, 10) || 0);
  const skyTotalMembers = parseInt(data1.totalMembers, 10);
  const ariaTotalMembers = parseInt(data2.totalMembers, 10);
  const skyOnlineMembers = parseInt(data1.onlineMembers, 10);
  const ariaOnlineMembers = parseInt(data2.onlineMembers, 10);
  // Merge online array based on rank
  const onlineMap = new Map();

  [...data1.online, ...data2.online].forEach(({ rank, players }) => {
    if (!onlineMap.has(rank)) {
      onlineMap.set(rank, new Set(players)); // Use Set to avoid duplicate players
    } else {
      players.forEach((player) => onlineMap.get(rank).add(player)); // Add players to the existing rank
    }
  });

  // Convert Map back to array
  let online = Array.from(onlineMap, ([rank, playersSet]) => ({
    rank,
    players: Array.from(playersSet),
  }));

  // Sort the online array by the predefined rank order
  online = online.sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));

  return {
    totalMembers: totalMembers.toString(),
    onlineMembers: onlineMembers.toString(),
    skyOnlineMembers: skyOnlineMembers.toString(),
    ariaOnlineMembers: ariaOnlineMembers.toString(),
    skyTotalMembers: skyTotalMembers.toString(),
    ariaTotalMembers: ariaTotalMembers.toString(),
    online,
  };
};

// This guild's data plus the peer's /api/online answer (or none at all).
const mergePeerData = (data, peer) =>
  deepMergeGuildData(data, (peer && peer.data && peer.data.data) || NO_PEER_DATA);

// The image caption, identical for both commands.
const describeOnlineImage = (data) =>
  `${sortOnline(data.online).join("\n")}\n\n**Total Members:** ${data.totalMembers}${peerCounts(data.skyTotalMembers, data.ariaTotalMembers)}\n**Online Members:** ${data.onlineMembers}${peerCounts(data.skyOnlineMembers, data.ariaOnlineMembers)}`;

async function uploadImage(buffer) {
  const response = await uploader.uploadBuffer(buffer);
  return response.url;
}

module.exports = {
  fetchGuildOnline,
  parseGuildOnline,
  sortOnline,
  deepMergeGuildData,
  mergePeerData,
  describeOnlineImage,
  peerCounts,
  renderChat,
  uploadImage,
  Encode,
  decode,
  RENDER_STYLES,
  NO_PEER_DATA,
};
