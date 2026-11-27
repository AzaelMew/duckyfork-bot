/* eslint-env jest */
/**
 * Guild identity comes from config.guild: with each bot's values the guild
 * checks, the Discord keyword, the rank ladder and the kick lists behave as the
 * literals each tree used to carry (Sky: TempestSky/"sky", Aria:
 * TempestAria/"aria", Shana: Bakacord, no keyword).
 *
 * Player names and guild ids below are test values, not the hosts' lists.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");

function exampleConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
}

let levelsFile;

beforeAll(() => {
  levelsFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "guild-config-")), "level.json");
  fs.writeFileSync(levelsFile, JSON.stringify({ recruit: 100, knight: 200, champion: 250, legend: 300 }));
});

afterAll(() => {
  fs.rmSync(path.dirname(levelsFile), { recursive: true, force: true });
});

function skyGuild() {
  return {
    name: "TempestSky",
    alliedGuilds: ["TempestAria"],
    commandKeyword: "sky",
    peerCommandKeywords: ["aria"],
    requireKeyword: true,
    invite: { guildId: "sky-guild-id", peerGuildId: "aria-guild-id", winsTie: true },
    ranks: {
      levelsFile,
      ladder: [{ name: "Legend" }, { name: "Champion" }, { name: "Knight" }, { name: "Recruit" }],
      protected: ["Guild Master", "Elder"],
      overrides: { "uuid-fixed": "Champion" },
    },
    kickExempt: ["ExemptPlayer"],
    protectedPlayers: ["owner_ign"],
    overridePlayers: ["Azael_Nyaa", "Azael_Nya"],
    blacklistEditors: ["Xephor_EX", "Azael_Nyaa", "Vallekoen"],
    autoClaim: { enabled: true, cron: "00 17 * * *" },
    inactiveKick: { enabled: false, cron: "30 17 * * *", days: 25 },
  };
}

function ariaGuild() {
  return Object.assign(skyGuild(), {
    name: "TempestAria",
    alliedGuilds: [],
    commandKeyword: "aria",
    peerCommandKeywords: ["sky"],
    invite: { guildId: "aria-guild-id", peerGuildId: "sky-guild-id", winsTie: false },
  });
}

function shanaGuild() {
  return {
    name: "Bakacord",
    alliedGuilds: [],
    commandKeyword: "sky",
    peerCommandKeywords: [],
    requireKeyword: false,
    invite: { guildId: "", peerGuildId: "", winsTie: true },
    ranks: {
      levelsFile: "",
      ladder: [
        { name: "Master", level: 400 },
        { name: "Expert", level: 300 },
        { name: "Challenger", level: 180 },
        { name: "Beginner", level: 0 },
      ],
      protected: ["Guild Master", "Baka"],
      overrides: {},
    },
    kickExempt: [],
    protectedPlayers: ["owner_ign2"],
    autoClaim: { enabled: true, cron: "00 20 * * *" },
    inactiveKick: { enabled: false, cron: "30 17 * * *", days: 25 },
  };
}

function configWith(guild) {
  const config = exampleConfig();
  config.web.token = "test-web-token";
  config.minecraft.API.hypixelAPIkey = "hk";
  config.minecraft.API.statsProxyUrl = "http://stats.test:3000";
  config.minecraft.API.statsProxyKey = "test-stats-key";
  config.bridge = {
    enabled: true,
    name: "Sky",
    peerUrl: "http://peer.test:3001",
    peerGuild: "aria",
    mirrorOnSend: false,
    relayBangCommands: false,
    peerRank: { rank: "VIP+", guildRank: "Elder" },
  };
  config.guild = guild;
  return config;
}

let axiosMock;

function load(guild) {
  jest.resetModules();
  mockConfig = configWith(guild);
  axiosMock = require("axios");
  axiosMock.get.mockReset();
  axiosMock.post.mockReset();
  axiosMock.post.mockResolvedValue({ data: {} });
  global.bot = { chat: jest.fn(), _client: { chat: jest.fn() }, player: {}, on: jest.fn(), once: jest.fn(), removeListener: jest.fn() };
  return require("../src/contracts/guildConfig.js");
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  delete global.bot;
});

describe("guildConfig helpers", () => {
  it("matches the guild by name, case-insensitively, plus allied guilds for membership", () => {
    const guild = load(skyGuild());
    expect(guild.isOwnGuild({ name_lower: "tempestsky" })).toBe(true);
    expect(guild.isOwnGuild({ name: "TempestSky" })).toBe(true);
    expect(guild.isOwnGuild({ name_lower: "tempestaria" })).toBe(false);
    expect(guild.isMemberGuild({ name_lower: "tempestaria" })).toBe(true);
    expect(guild.isMemberGuild({ name_lower: "bakacord" })).toBe(false);
    expect(guild.isOwnGuild(undefined)).toBe(false);
  });

  it("looks the guild up by name", () => {
    const guild = load(shanaGuild());
    expect(guild.ownGuildUrl()).toBe("https://api.hypixel.net/v2/guild?key=hk&name=Bakacord");
  });

  it("reads rank levels from the levels file on every call", () => {
    const guild = load(skyGuild());
    expect(guild.rankLadder()).toEqual([
      { name: "Legend", level: 300 },
      { name: "Champion", level: 250 },
      { name: "Knight", level: 200 },
      { name: "Recruit", level: 100 },
    ]);
    expect(guild.minimumLevel()).toBe(100);
  });

  it("assigns the highest reached rung, the lowest rung being the default", () => {
    const guild = load(skyGuild());
    expect(guild.rankForLevel(300)).toBe("Legend");
    expect(guild.rankForLevel(299)).toBe("Champion");
    expect(guild.rankForLevel(200)).toBe("Knight");
    expect(guild.rankForLevel(5)).toBe("Recruit");
    expect(guild.rankForExperience(25000)).toBe("Champion");

    const shana = load(shanaGuild());
    expect(shana.rankForLevel(400)).toBe("Master");
    expect(shana.rankForLevel(180)).toBe("Challenger");
    expect(shana.rankForExperience(17999)).toBe("Beginner");
  });

  it("lists staff ranks then the ladder for the online/list commands", () => {
    const guild = load(skyGuild());
    expect(guild.allRankNames()).toEqual(["Guild Master", "Elder", "Legend", "Champion", "Knight", "Recruit"]);
  });

  it("routes keyword commands to the right bot", () => {
    const sky = load(skyGuild());
    expect(sky.matchKeyword(["!override", "sky", "g", "list"])).toEqual({ forUs: true, rest: ["g", "list"], keyword: true });
    expect(sky.matchKeyword(["!override", "aria", "g", "list"]).forUs).toBe(false);
    expect(sky.matchKeyword(["!override", "g", "list"]).forUs).toBe(false);
    expect(sky.matchKeyword(["!autoclaim"]).forUs).toBe(false);

    const aria = load(ariaGuild());
    expect(aria.matchKeyword(["!override", "sky", "g", "list"]).forUs).toBe(false);
    expect(aria.matchKeyword(["!override", "ARIA", "g", "list"]).forUs).toBe(true);

    const shana = load(shanaGuild());
    expect(shana.matchKeyword(["!autoclaim"]).forUs).toBe(true);
    expect(shana.matchKeyword(["!override", "sky", "g", "list"])).toEqual({ forUs: true, rest: ["g", "list"], keyword: true });
    expect(shana.matchKeyword(["!override", "g", "list"])).toEqual({ forUs: true, rest: ["g", "list"], keyword: false });
  });

  it("keeps kick-exempt (exact) and protected (any case) players apart", () => {
    const guild = load(skyGuild());
    expect(guild.isKickExempt("ExemptPlayer")).toBe(true);
    expect(guild.isKickExempt("exemptplayer")).toBe(false);
    expect(guild.isProtectedPlayer("OWNER_IGN")).toBe(true);
    expect(guild.isProtectedRank("Elder")).toBe(true);
    expect(guild.isProtectedRank("Knight")).toBe(false);
  });

  it("gates the in-game admin commands on exact configured players", () => {
    const guild = load(skyGuild());
    // Case-insensitive, but the whole name must match: a name that only
    // contains an allowed one (Azael_Nyan) is not an admin.
    expect(guild.isOverridePlayer("Azael_Nyaa")).toBe(true);
    expect(guild.isOverridePlayer("AZAEL_NYA")).toBe(true);
    expect(guild.isOverridePlayer("Azael_Nyan")).toBe(false);
    expect(guild.isOverridePlayer("NotAzael_Nyaa")).toBe(false);
    expect(guild.isOverridePlayer(undefined)).toBe(false);

    expect(guild.isBlacklistEditor("Xephor_EX")).toBe(true);
    expect(guild.isBlacklistEditor("vallekoen")).toBe(true);
    expect(guild.isBlacklistEditor("Xephor_EX2")).toBe(false);
    expect(guild.isBlacklistEditor("Azael_Nyan")).toBe(false);

    // No key at all: nobody is allowed (safe default).
    const shana = load(shanaGuild());
    expect(shana.isOverridePlayer("Azael_Nyaa")).toBe(false);
    expect(shana.isBlacklistEditor("Xephor_EX")).toBe(false);
  });
});

describe("commands use the configured guild", () => {
  it("!reqs prints the same line Sky printed from level.json", () => {
    load(skyGuild());
    const ReqsCommand = require("../src/minecraft/commands/ReqsCommand.js");
    const command = new ReqsCommand({});
    command.send = jest.fn();
    command.onCommand("Player", "!reqs");
    expect(command.send).toHaveBeenCalledWith(
      "/gc Rank Requirements; Recruit - Skyblock Level 100 | Knight - Skyblock Level 200 | Champion - Skyblock Level 250 | Legend - Skyblock Level 300",
    );
  });

  it("!claim sets the ladder rank from the stats proxy level", async () => {
    load(shanaGuild());
    axiosMock.get.mockImplementation((url) => {
      if (url.includes("mojang") || url.includes("ashcon")) return Promise.resolve({ data: { id: "uuid-player" } });
      return Promise.resolve({ data: { data: [{ sblevel: 120 }, { sblevel: 310 }] } });
    });
    const ClaimCommand = require("../src/minecraft/commands/ClaimCommand.js");
    const command = new ClaimCommand({});
    command.warpSend = jest.fn();
    command.send = jest.fn();
    jest.useFakeTimers();
    try {
      await command.onCommand("Player", "!claim");
      for (let i = 0; i < 5; i++) await Promise.resolve();
      jest.runAllTimers();
    } finally {
      jest.useRealTimers();
    }
    await flush();
    expect(command.warpSend).toHaveBeenCalledWith("/g setrank Player Expert");
  });

  it("!claim honours a per-UUID override", async () => {
    load(skyGuild());
    axiosMock.get.mockImplementation((url) => {
      if (url.includes("mojang") || url.includes("ashcon")) return Promise.resolve({ data: { id: "uuid-fixed" } });
      return Promise.reject(new Error("stats proxy must not be called for an override"));
    });
    const ClaimCommand = require("../src/minecraft/commands/ClaimCommand.js");
    const command = new ClaimCommand({});
    command.warpSend = jest.fn();
    command.send = jest.fn();
    await command.onCommand("Player", "!claim");
    await flush();
    expect(command.warpSend).toHaveBeenCalledWith("/g setrank Player Champion");
  });

  it("!override only runs on the bot named by the keyword", () => {
    load(ariaGuild());
    const OverrideCommand = require("../src/discord/oldcommands/OverrideCommand.js");
    const command = new OverrideCommand({ app: { minecraft: { bot: global.bot } } });

    const skyMessage = { content: "!override sky g list", reply: jest.fn() };
    command.onCommand(skyMessage);
    expect(global.bot.chat).not.toHaveBeenCalled();

    const ariaMessage = { content: "!override aria g list", reply: jest.fn() };
    command.onCommand(ariaMessage);
    expect(global.bot.chat).toHaveBeenCalledWith("/g list");
    expect(ariaMessage.reply).toHaveBeenCalledWith("`/g list` has been executed in TempestAria");
  });

  it("!invite without a keyword goes to the smaller guild, the tie to winsTie", async () => {
    const counts = { "sky-guild-id": 3, "aria-guild-id": 3 };
    const guildReply = (url) => {
      const id = new URL(url).searchParams.get("id");
      return Promise.resolve({ data: { guild: { members: new Array(counts[id]).fill({}) } } });
    };

    load(skyGuild());
    axiosMock.get.mockImplementation(guildReply);
    let InviteCommand = require("../src/discord/oldcommands/InviteCommand.js");
    new InviteCommand({ app: { minecraft: { bot: global.bot } } }).onCommand({ content: "!invite Newbie" });
    await flush();
    expect(global.bot.chat).toHaveBeenCalledWith("/g invite Newbie");

    load(ariaGuild());
    axiosMock.get.mockImplementation(guildReply);
    InviteCommand = require("../src/discord/oldcommands/InviteCommand.js");
    new InviteCommand({ app: { minecraft: { bot: global.bot } } }).onCommand({ content: "!invite Newbie" });
    await flush();
    expect(global.bot.chat).not.toHaveBeenCalled();

    new InviteCommand({ app: { minecraft: { bot: global.bot } } }).onCommand({ content: "!invite aria Newbie" });
    expect(global.bot.chat).toHaveBeenCalledWith("/g invite Newbie");
  });

  it("!invite on a bot without a peer guild always invites", async () => {
    load(shanaGuild());
    const InviteCommand = require("../src/discord/oldcommands/InviteCommand.js");
    new InviteCommand({ app: { minecraft: { bot: global.bot } } }).onCommand({ content: "!invite Newbie" });
    await flush();
    expect(axiosMock.get).not.toHaveBeenCalled();
    expect(global.bot.chat).toHaveBeenCalledWith("/g invite Newbie");
  });

  it("!kick refuses protected players", async () => {
    load(skyGuild());
    const KickCommand = require("../src/discord/oldcommands/KickCommand.js");
    const command = new KickCommand({ app: { minecraft: { bot: global.bot } } });
    await command.onCommand({ content: "!kick Owner_IGN reason", channel: { send: jest.fn() } });
    expect(axiosMock.get).not.toHaveBeenCalled();
    expect(global.bot.chat).not.toHaveBeenCalled();
  });
});

describe("config tooling", () => {
  it("check-config accepts the example and flags an empty ladder", () => {
    load(skyGuild());
    const { checkConfigFile } = require("../scripts/check-config.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guild-check-"));
    try {
      const file = path.join(dir, "config.json");
      const config = configWith(skyGuild());
      fs.writeFileSync(file, JSON.stringify(config));
      expect(checkConfigFile(file).problems).toEqual([]);

      config.guild.ranks.ladder = [];
      fs.writeFileSync(file, JSON.stringify(config));
      expect(checkConfigFile(file).problems.join("\n")).toContain("guild.ranks.ladder");

      const placeholder = configWith(exampleConfig().guild);
      fs.writeFileSync(file, JSON.stringify(placeholder));
      expect(checkConfigFile(file).warnings.join("\n")).toContain("guild.name");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
