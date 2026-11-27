/* eslint-env jest */
/**
 * Shared parts of the in-game `!online` and Discord `!online` commands.
 *
 * Both commands used to carry byte-identical copies of the `/g online` parser,
 * the rank merge and the image caption; these tests pin the behaviour of the
 * code that now lives in src/contracts/commands/online.js. `canvas` and the
 * imgur uploader are mocked: only the pure parsing/formatting parts and the
 * bot conversation are under test here.
 */
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

jest.mock("canvas", () => ({ registerFont: jest.fn(), createCanvas: jest.fn() }));
jest.mock("imgur-anonymous-uploader", () =>
  jest.fn(() => ({ uploadBuffer: jest.fn(async () => ({ url: "https://i.imgur.com/image.png" })) })),
);

let mockConfig;

jest.mock("../config.json", () => mockConfig);

function stubConfig() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.example.json"), "utf8"));
  // A three-rung ladder, staff rank first, so the sort order is meaningful.
  config.guild.ranks = {
    levelsFile: "",
    ladder: [{ name: "Elder", level: 100 }, { name: "Member", level: 0 }],
    protected: ["Guild Master"],
    overrides: {},
  };
  // bridge.js validates these at require time; 127.0.0.1 keeps the request
  // target local (these tests never post to a peer).
  config.bridge = { ...config.bridge, enabled: true, name: "Sky", peerUrl: "http://127.0.0.1:3001", peerGuild: "aria" };
  config.web = { ...(config.web || {}), token: "test-web-token" };
  return config;
}

// The lines the bot receives after `/g online`: the header/separator lines
// Hypixel decorates the numbers with, then one "-- Rank --" line followed by a
// "● name ● name" line. "-- Champion --" has no member line (nobody online at
// that rank), so the parser has to skip it.
const HYPIXEL_ONLINE = [
  "",
  "-----------------------------------------------------",
  "Guild Name: TempestSky",
  "Online Members: 5",
  "Total Members: 12",
  "-- Guild Master --",
  "● Steve",
  "-- Elder --",
  "● Alex ● [MVP+] Notch ● Hypixel",
  "-- Member --",
  "● Player_One ● [VIP] PlayerTwo",
  "-- Champion --",
  "Offline Members: 7",
];

const PEER_ONLINE = {
  data: {
    data: {
      totalMembers: "8",
      onlineMembers: "3",
      online: [{ rank: "Elder", players: ["Alex", "Peer"] }],
    },
  },
};

let online;

beforeEach(() => {
  mockConfig = stubConfig();
  jest.resetModules();
  // eslint-disable-next-line global-require
  online = require("../src/contracts/commands/online.js");
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("parseGuildOnline", () => {
  it("reads the totals and one block per rank that has players", () => {
    expect(online.parseGuildOnline(HYPIXEL_ONLINE)).toEqual({
      totalMembers: "12",
      onlineMembers: "5",
      online: [
        { rank: "Guild Master", players: ["Steve"] },
        { rank: "Elder", players: ["Alex", "[MVP+] Notch", "Hypixel"] },
        { rank: "Member", players: ["Player_One", "[VIP] PlayerTwo"] },
      ],
    });
  });

  it("keeps the totals as the strings Hypixel sent", () => {
    const data = online.parseGuildOnline(HYPIXEL_ONLINE);
    expect(typeof data.totalMembers).toBe("string");
    expect(typeof data.onlineMembers).toBe("string");
  });
});

describe("sortOnline", () => {
  it("orders by the guild rank ladder and strips rank tags from names", () => {
    const { online: ranks } = online.parseGuildOnline(HYPIXEL_ONLINE);
    expect(online.sortOnline(ranks)).toEqual([
      "\n**Guild Master**\n✦ Steve",
      "\n**Elder**\n✦ Alex ✦  Notch ✦ Hypixel",
      "\n**Member**\n✦ Player\\_One ✦  PlayerTwo",
    ]);
  });
});

describe("mergePeerData", () => {
  it("adds the peer's totals and dedupes players per rank", () => {
    const merged = online.mergePeerData(online.parseGuildOnline(HYPIXEL_ONLINE), PEER_ONLINE);
    expect(merged.totalMembers).toBe("20");
    expect(merged.onlineMembers).toBe("8");
    expect(merged.skyTotalMembers).toBe("12");
    expect(merged.ariaTotalMembers).toBe("8");
    expect(merged.skyOnlineMembers).toBe("5");
    expect(merged.ariaOnlineMembers).toBe("3");
    expect(merged.online).toEqual([
      { rank: "Guild Master", players: ["Steve"] },
      { rank: "Elder", players: ["Alex", "[MVP+] Notch", "Hypixel", "Peer"] },
      { rank: "Member", players: ["Player_One", "[VIP] PlayerTwo"] },
    ]);
  });

  it("falls back to this guild alone when the peer is offline", () => {
    const merged = online.mergePeerData(online.parseGuildOnline(HYPIXEL_ONLINE), undefined);
    expect(merged.totalMembers).toBe("12");
    expect(merged.onlineMembers).toBe("5");
    expect(merged.ariaTotalMembers).toBe("0");
    expect(merged.online).toEqual(online.parseGuildOnline(HYPIXEL_ONLINE).online);
  });
});

describe("describeOnlineImage", () => {
  it("renders ranks, then the totals with the peer split when a peer exists", () => {
    const merged = online.mergePeerData(online.parseGuildOnline(HYPIXEL_ONLINE), PEER_ONLINE);
    expect(online.describeOnlineImage(merged)).toBe(
      [
        "",
        "**Guild Master**",
        "✦ Steve",
        "",
        "**Elder**",
        "✦ Alex ✦  Notch ✦ Hypixel ✦ Peer",
        "",
        "**Member**",
        "✦ Player\\_One ✦  PlayerTwo",
        "",
        "**Total Members:** 20   |   (12/8)",
        "**Online Members:** 8   |   (5/3)",
      ].join("\n"),
    );
  });

  it("leaves the peer split out when the bridge is disabled", () => {
    mockConfig = stubConfig();
    mockConfig.bridge.enabled = false;
    jest.resetModules();
    // eslint-disable-next-line global-require
    const noPeer = require("../src/contracts/commands/online.js");

    expect(noPeer.peerCounts("12", "8")).toBe("");
    const merged = noPeer.mergePeerData(noPeer.parseGuildOnline(HYPIXEL_ONLINE), undefined);
    expect(noPeer.describeOnlineImage(merged)).toContain("**Total Members:** 12\n**Online Members:** 5");
    expect(noPeer.describeOnlineImage(merged)).not.toContain("|");
  });
});

describe("fetchGuildOnline", () => {
  function fakeBot(lines) {
    const bot = new EventEmitter();
    bot._client = { chat: jest.fn() };
    bot.chat = jest.fn(() => {
      for (const line of lines) bot.emit("message", line);
    });
    return bot;
  }

  it("sends /g online and parses what the bot hears back", async () => {
    jest.useFakeTimers();
    const bot = fakeBot(HYPIXEL_ONLINE);
    const result = online.fetchGuildOnline(bot);

    jest.advanceTimersByTime(150);
    await expect(result).resolves.toEqual(online.parseGuildOnline(HYPIXEL_ONLINE));
    expect(bot.chat).toHaveBeenCalledWith("/g online");
    expect(bot.listenerCount("message")).toBe(0);
  });

  it("rejects when Hypixel never reaches the offline-members line", async () => {
    jest.useFakeTimers();
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const bot = fakeBot([""]);
    const result = online.fetchGuildOnline(bot);
    result.catch(() => {});

    jest.advanceTimersByTime(150);
    jest.advanceTimersByTime(5000);

    await expect(result).rejects.toThrow("Command timed out. Please try again.");
    consoleError.mockRestore();
  });

  it("refuses to run without a connected bot", async () => {
    await expect(online.fetchGuildOnline(undefined)).rejects.toThrow(
      "Bot doesn't seem to be connected to Hypixel. Please try again.",
    );
  });
});

describe("image link", () => {
  it("round-trips an imgur url through the guild-chat encoding", () => {
    const url = "https://i.imgur.com/abc.png";
    const encoded = online.Encode(url);
    expect(online.decode(encoded)).toBe(url);
  });

  it("returns the uploaded url", async () => {
    await expect(online.uploadImage(Buffer.from("png"))).resolves.toBe("https://i.imgur.com/image.png");
  });
});
