/* eslint-env jest */
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));

const { formatSlayerStats, slayerErrorText, errorText } = require("../src/contracts/commands/slayer.js");

const slayerProfile = {
  slayer: {
    zombie: { xp: 100, level: 1 },
    spider: { xp: 100, level: 2 },
    wolf: { xp: 100, level: 3 },
    enderman: { xp: 100, level: 4 },
    blaze: { xp: 100, level: 5 },
    vampire: { xp: 100, level: 6 },
  },
};

it("prints the slayer line both commands send", () => {
  expect(formatSlayerStats(slayerProfile)).toBe(
    "˚**Total Slayer EXP**:\n➣  600; **Zombie level**:\n➣  1 - 100xp; **Spider level**:\n➣  2 - 100xp; **Wolf level**:\n➣  3 - 100xp; **Enderman level**:\n➣  4 - 100xp; **Blaze level**:\n➣  5 - 100xp; **Vampire level**:\n➣  6 - 100xp",
  );
});

it("groups thousands in the xp totals", () => {
  const profile = { slayer: { ...slayerProfile.slayer, wolf: { xp: 1234567, level: 9 } } };

  expect(formatSlayerStats(profile)).toContain("**Wolf level**:\n➣  9 - 1,234,567xp");
  expect(formatSlayerStats(profile)).toContain("**Total Slayer EXP**:\n➣  1,235,067");
});

it("keeps the in-game error wording for the proxy's 500/404 answers", () => {
  const error = (message) => new Error(message);
  const other = error("Request failed with status code 429");

  expect(slayerErrorText(error("Request failed with status code 500"))).toBe("is an Invalid Username");
  expect(slayerErrorText(error("Request failed with status code 404"))).toBe("has no Skyblock Profiles");
  expect(slayerErrorText(other)).toBe(other);
  expect(errorText({ response: { data: { reason: "Invalid Username" } } })).toBe("[ERROR] Invalid Username");
});
