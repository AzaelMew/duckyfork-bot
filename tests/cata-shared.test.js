/* eslint-env jest */
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));

const { formatCataStats, getDungeonFromUUID } = require("../src/contracts/commands/cata.js");

const dungeonProfile = {
  dungeons: {
    catacombs: { skill: { levelWithProgress: 40, totalXp: 0 } },
    classes: {
      healer: { levelWithProgress: 30, totalXp: 0 },
      mage: { levelWithProgress: 20, totalXp: 0 },
      archer: { levelWithProgress: 10, totalXp: 0 },
      berserk: { levelWithProgress: 25, totalXp: 0 },
      tank: { levelWithProgress: 15, totalXp: 0 },
    },
  },
  talismans: { secrets: 100 },
};

it("prints the dungeon line both commands send", () => {
  expect(formatCataStats(dungeonProfile)).toBe(
    "˚**Cata**:\n➣ 40.00˚ **;Average**:\n➣ 20.00˚ **;Archer**:\n➣ 10.00˚ **;Berserk**:\n➣ 25.00˚ **;Healer**:\n➣ 30.00˚ **;Mage**:\n➣ 20.00˚ **;Tank**:\n➣ 15.00˚ **;Secrets**:\n➣ 100",
  );
});

it("adds the 50+ overflow to the level but not to the average", () => {
  const profile = {
    dungeons: {
      catacombs: { skill: { levelWithProgress: 50, totalXp: 569809640 + 200000000 } },
      classes: { healer: { levelWithProgress: 50, totalXp: 569809640 + 200000000 } },
    },
    talismans: { secrets: 0 },
  };

  const text = formatCataStats(profile);

  expect(text.startsWith("˚**Cata**:\n➣ 51.00")).toBe(true);
  expect(text).toContain("**;Average**:\n➣ 10.00"); // 50/5, overflow not counted
  expect(text).toContain("**;Healer**:\n➣ 51.00");
});

it("falls back to 0 for a profile without dungeons", () => {
  const text = formatCataStats({ talismans: { secrets: 3 } });

  expect(text).toBe(
    "˚**Cata**:\n➣ 0.00˚ **;Average**:\n➣ 0.00˚ **;Archer**:\n➣ 0.00˚ **;Berserk**:\n➣ 0.00˚ **;Healer**:\n➣ 0.00˚ **;Mage**:\n➣ 0.00˚ **;Tank**:\n➣ 0.00˚ **;Secrets**:\n➣ 3",
  );
});

it("answers nothing for the skipped account", async () => {
  const { SKIPPED_UUID } = require("../src/contracts/commands/skyblockProfile.js");

  await expect(getDungeonFromUUID(SKIPPED_UUID)).resolves.toBeUndefined();
});
