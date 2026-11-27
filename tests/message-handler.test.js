const { describe, it, expect, beforeEach } = require("@jest/globals");
const config = require("../config.json");

jest.mock("axios");
jest.mock("../src/contracts/Imgur/imgurExport", () => ({
  uploadBuffer: jest.fn(),
  upload: jest.fn(),
}));

const axios = require("axios");
const uploader = require("../src/contracts/Imgur/imgurExport");
const MessageHandler = require("../src/discord/handlers/MessageHandler.js");
const { decode, encode } = require("../src/contracts/stuf.js");

const BOT_ID = "bot-id";

function makeMessage({ content = "", channelId, attachments = [], authorId = "user-id" } = {}) {
  const attachmentMap = new Map(attachments.map((attachment, index) => [index, attachment]));

  return {
    author: { id: authorId, bot: false, username: "tester" },
    member: { displayName: "Tester", user: { id: authorId } },
    channel: { id: channelId ?? config.discord.channels.guildChatChannel, messages: { fetch: jest.fn() } },
    content,
    attachments: attachmentMap,
    mentions: undefined,
    reference: undefined,
    guild: undefined,
  };
}

describe("MessageHandler link handling", () => {
  let handler;
  let broadcastMessage;

  beforeEach(() => {
    global.client = { user: { id: BOT_ID } };
    axios.mockReset();
    uploader.uploadBuffer.mockReset();
    broadcastMessage = jest.fn();
    handler = new MessageHandler({ broadcastMessage }, { handle: jest.fn() });
  });

  it("broadcasts a message with a link whose upload failed instead of dropping it", async () => {
    axios.mockResolvedValue({ data: Buffer.from("not really an image") });
    uploader.uploadBuffer.mockResolvedValue({ success: false, message: "Not a valid file." });

    const message = makeMessage({ content: "look at https://example.com/page" });
    await handler.onMessage(message);

    expect(broadcastMessage).toHaveBeenCalledTimes(1);
    expect(broadcastMessage.mock.calls[0][0].message).toContain("https://example.com/page");
  });

  it("runs oldcommand.handle exactly once and keeps officer-channel messages", async () => {
    axios.mockResolvedValue({ data: Buffer.from("image") });
    uploader.uploadBuffer.mockResolvedValue({ success: true, url: "https://i.ibb.co/abc.png" });

    const message = makeMessage({
      content: "https://i.imgur.com/abc.png",
      channelId: config.discord.channels.officerChannel,
    });
    await handler.onMessage(message);

    expect(handler.oldcommand.handle).toHaveBeenCalledTimes(1);
    expect(broadcastMessage).toHaveBeenCalledTimes(1);
    expect(decode(broadcastMessage.mock.calls[0][0].message)).toBe("https://i.ibb.co/abc.png");
  });

  it("downloads uploads from zip.azael.moe through /raw/ and encodes the result", async () => {
    axios.mockResolvedValue({ data: Buffer.from("image") });
    uploader.uploadBuffer.mockResolvedValue({ success: true, url: "https://i.ibb.co/abc.png" });

    const message = makeMessage({ content: "https://zip.azael.moe/u/abc.png" });
    await handler.onMessage(message);

    expect(axios.mock.calls[0][0].url).toBe("https://zip.azael.moe/raw/abc.png");
    expect(decode(broadcastMessage.mock.calls[0][0].message)).toBe("https://i.ibb.co/abc.png");
  });

  it("uploads attachments too", async () => {
    axios.mockResolvedValue({ data: Buffer.from("image") });
    uploader.uploadBuffer.mockResolvedValue({ success: true, url: "https://i.ibb.co/def.png" });

    const message = makeMessage({
      content: "hi",
      attachments: [{ url: "https://cdn.discordapp.com/attachments/1/2/pic.png" }],
    });
    await handler.onMessage(message);

    expect(uploader.uploadBuffer).toHaveBeenCalledTimes(1);
    expect(broadcastMessage.mock.calls[0][0].message).toContain(` ${encode("https://i.ibb.co/def.png")}`);
  });
});
