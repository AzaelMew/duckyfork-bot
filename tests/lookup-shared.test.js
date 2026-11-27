/* eslint-env jest */
// Fixtures for the shared !stalk / !seen (!playerLookup) and !contest (jacob)
// modules. Every expectation here was captured from the pre-dedupe command
// files, so a change in output shows up as a test failure.
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));
jest.mock("axios", () => ({ get: jest.fn() }));

const axios = require("axios");

const { locationFromSession, timeSince, describeSeen } = require("../src/contracts/commands/playerLookup.js");
const {
  convertSecondsToMinutesAndSeconds,
  convertSecondsToHoursMinutesAndSeconds,
  normalizeCrop,
  nextContest,
  formatGeneralContest,
  formatSpecificContest,
  generalEmbedText,
  generalChatText,
  specificEmbedText,
  specificChatText,
  getNextContest,
} = require("../src/contracts/commands/jacob.js");

const NOW = 1700000000000; // 2023-11-14T22:13:20Z

const FEED = [
  { time: 1699999900, crops: ["Cactus"] },
  { time: 1700000600, crops: ["Melon", "Pumpkin", "Wheat"] },
  { time: 1700003600, crops: ["Cocoa Beans", "Mushroom"] },
];

describe("!stalk location text", () => {
  it.each([
    ["SKYBLOCK", "garden", "Garden"],
    ["SKYBLOCK", "dynamic", "Private Island"],
    ["SKYBLOCK", "crystal_hollows", "Crystal Hollows"],
    ["SKYBLOCK", "fishing_1", "Backwater Bayou"],
    ["SKYBLOCK", "not_a_real_mode", "Unknown Skyblock Location"],
    ["BEDWARS", "BEDWARS_TWO_FOUR", "4v4 Bedwars"],
    ["BEDWARS", "not_a_real_mode", "Unknown Bedwars Mode"],
    ["SKYWARS", "solo_insane", "Skywars Solo Insane"],
    ["TNTGAMES", "LOBBY", "TNT Games Lobby"],
    ["TNTGAMES", "nope", "Unknown TNT Game Mode"],
    ["DUELS", "LOBBY", "Duels Lobby"],
    ["DUELS", "blitz_duel", "Duels Game"],
    ["HOUSING", "base", "Someone's Housing"],
    ["HOUSING", "lobby", "Housing Lobby"],
    ["SMP", "something", "Hypixel SMP"],
    ["PROTOTYPE", undefined, "Prototype Lobby"],
    ["MAIN", undefined, "Main Lobby"],
    ["MURDER_MYSTERY", undefined, "Murder Mystery Lobby"],
    ["ARCADE", undefined, "Arcade Lobby"],
    ["BUILD_BATTLE", undefined, "Build Battle Lobby"],
    ["NOT_A_GAME", undefined, "Unknown Game Type"],
  ])("%s/%s -> %s", (gameType, mode, expected) => {
    expect(locationFromSession({ online: true, gameType, mode })).toBe(expected);
  });

  it("reports offline players and an empty session as offline", () => {
    expect(locationFromSession({ online: false, gameType: "SKYBLOCK", mode: "hub" })).toBe("Player is Offline");
    expect(locationFromSession({})).toBe("Player is Offline");
  });
});

describe("!seen durations", () => {
  it("formats the same strings the commands always printed", () => {
    expect(timeSince(NOW, NOW)).toBe("");
    expect(timeSince(NOW, NOW - 45000)).toBe("45s ");
    expect(timeSince(NOW, NOW - 96000)).toBe("1m 36s ");
    expect(timeSince(NOW, NOW - 262861000)).toBe("3d 1h 1m 1s ");
  });
});

describe("!seen sentence", () => {
  it("says how long someone has been online", () => {
    expect(describeSeen({ lastLogin: NOW - 5000, lastLogout: NOW - 96000 }, { now: NOW })).toBe(
      "Has been online for 5s",
    );
  });

  it("prints a UTC logout date for guild chat", () => {
    expect(describeSeen({ lastLogin: NOW - 9000000, lastLogout: NOW - 96000 }, { now: NOW })).toBe(
      "Has been offline for 1m 36s, \nThey last logged out Tue, 14 Nov 2023 22:11:44 GMT",
    );
  });

  it("prints a Discord timestamp when asked for one", () => {
    expect(describeSeen({ lastLogin: NOW - 9000000, lastLogout: NOW - 96000 }, { now: NOW, format: "discord" })).toBe(
      "Has been offline for 1m 36s, \nThey last logged out <t:1699999904:F>",
    );
  });

  it("reports a disabled API", () => {
    expect(describeSeen({ lastLogout: null }, { now: NOW })).toBe("Api is Disabled");
    expect(describeSeen({}, { now: NOW })).toBe("Api is Disabled");
  });
});

describe("!contest helpers", () => {
  it("formats remaining time", () => {
    expect(convertSecondsToMinutesAndSeconds(600000)).toBe("10:00");
    expect(convertSecondsToMinutesAndSeconds(59000)).toBe("00:59");
    expect(convertSecondsToHoursMinutesAndSeconds(3661000)).toBe("01:01:01");
    expect(convertSecondsToHoursMinutesAndSeconds(59000)).toBe("00:59");
    expect(convertSecondsToHoursMinutesAndSeconds(36000000)).toBe("10:00:00");
  });

  it("expands the crop shorthands players type", () => {
    expect(normalizeCrop("cocoa")).toBe("Cocoa Beans");
    expect(normalizeCrop("WART")).toBe("Nether Wart");
    expect(normalizeCrop("cane")).toBe("Sugar Cane");
    expect(normalizeCrop("rose")).toBe("Wild Rose");
    expect(normalizeCrop("PUMpkin")).toBe("Pumpkin");
    expect(normalizeCrop("wheat")).toBe("Wheat");
  });

  it("picks the first contest that has not started yet", () => {
    expect(nextContest(FEED, { now: NOW })).toEqual(FEED[1]);
    expect(nextContest(FEED, { now: NOW, crop: "Mushroom" })).toEqual(FEED[2]);
    expect(nextContest(FEED, { now: NOW, crop: "Carrot" })).toBeUndefined();
  });

  it("builds the general contest in both output forms", () => {
    const contest = formatGeneralContest(FEED[1], NOW);
    expect(contest).toBe("The next contest starts in: 10:00\n\nCrops: \n- Melon, Pumpkin, Wheat");
    expect(generalEmbedText(contest)).toBe(
      "**The next contest starts in:**\n 10:00\n\n**Crops:** \n- Melon\n- Pumpkin\n- Wheat",
    );
    expect(generalChatText(contest)).toBe("The next contest starts in: 10:00 ┃ Crops: Melon, Pumpkin, Wheat");
  });

  it("builds a specific contest in both output forms", () => {
    const contest = formatSpecificContest(FEED[2], "Cocoa Beans", NOW);
    expect(contest).toBe("**The next Cocoa Beans contest is in:**\n 01:00:00 \n\n**and also has:**\n- Mushroom");
    expect(specificEmbedText(contest)).toBe(
      "**The next Cocoa Beans contest is in:**\n 01:00:00 \n\n**and also has:**\n- Mushroom",
    );
    expect(specificChatText(contest)).toBe("The next Cocoa Beans contest is in 01:00:00 and also has Mushroom");
  });
});

describe("!contest lookup", () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it("returns the general contest when no crop is given", async () => {
    axios.get.mockResolvedValue({ data: FEED });
    await expect(getNextContest({ now: NOW })).resolves.toEqual({
      embedText: "**The next contest starts in:**\n 10:00\n\n**Crops:** \n- Melon\n- Pumpkin\n- Wheat",
      chatText: "The next contest starts in: 10:00 ┃ Crops: Melon, Pumpkin, Wheat",
    });
    expect(axios.get).toHaveBeenCalledWith("https://dawjaw.net/jacobs");
  });

  it("returns the next matching contest for a crop", async () => {
    axios.get.mockResolvedValue({ data: FEED });
    await expect(getNextContest({ now: NOW, crop: "Pumpkin" })).resolves.toEqual({
      embedText: "**The next Pumpkin contest is in:**\n 10:00 \n\n**and also has:**\n- Melon\n- Wheat",
      chatText: "The next Pumpkin contest is in 10:00 and also has Melon and Wheat",
    });
  });

  it("returns nothing when the crop has no upcoming contest", async () => {
    axios.get.mockResolvedValue({ data: FEED });
    await expect(getNextContest({ now: NOW, crop: "Carrot" })).resolves.toBeUndefined();
  });
});
