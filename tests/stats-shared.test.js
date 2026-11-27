/* eslint-env jest */
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));

const { formatStats, shapeStats } = require("../src/contracts/commands/stats.js");

const player = {
  name: "Alice",
  networth: { networth: 1234567890 },
  skills: {
    farming: { level: 30 }, mining: { level: 30 }, combat: { level: 30 },
    foraging: { level: 30 }, fishing: { level: 30 }, enchanting: { level: 30 },
    alchemy: { level: 30 }, taming: { level: 30 }, carpentry: { level: 30 },
  },
  dungeons: { catacombs: { skill: { levelWithProgress: 40, totalXp: 0 } } },
  slayer: {
    wolf: { xp: 100 }, zombie: { xp: 100 }, spider: { xp: 100 },
    enderman: { xp: 100 }, blaze: { xp: 100 }, vampire: { xp: 100 },
  },
  sblevel: 240.65,
  talismans: { mp: 987 },
};

it("shapes the numbers the line prints", () => {
  expect(shapeStats(player)).toEqual({
    skyblockLevel: "240",
    sa: 30,
    slayer: "600",
    cata: 40,
    networth: "1,234,815,672",
    magicalPower: 987,
  });
});

it("prints the fallback line with magical power", () => {
  expect(formatStats(player, { magicalPower: true })).toBe(
    "˚**Skyblock Level:** \n➣ 240; **Skill Avg:** \n➣ 30; **Slayer:** \n➣ 600; **Cata:** \n➣ 40.00; **Networth:** \n➣ $1,234,815,672; **Magical Power:** \n➣ 987",
  );
});

it("prints the requested-profile line without magical power", () => {
  expect(formatStats(player, { profileName: "Bob" })).toBe(
    "**On Bob:** \n**Skyblock Level:** \n➣ 240; **Skill Avg:** \n➣ 30; **Slayer:** \n➣ 600; **Cata:** \n➣ 40.00; **Networth:** \n➣ $1,234,815,672;",
  );
});

it("leaves the networth uncapped for the Discord command", () => {
  expect(formatStats(player, { capNetworth: false })).toContain("**Networth:** \n➣ $1,234,567,890;");
  expect(formatStats(player)).toContain("**Networth:** \n➣ $1,234,815,672;");
});
