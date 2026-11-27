/* eslint-env jest */
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));

const { formatKuudraStats } = require("../src/contracts/commands/kuudra.js");

const kuudraProfile = (faction) => ({
  crimson: {
    factions: { selected_faction: faction, mages_reputation: 10.6, barbarians_reputation: 5.4 },
    kuudra_completed_tiers: { none: 1, hot: 2, burning: 3, fiery: 4, infernal: 5 },
  },
});

it("prints the kuudra line both commands send", () => {
  expect(formatKuudraStats(kuudraProfile("barbarians"))).toBe(
    "**Current Faction**:\n➣ Barbarian¨ **;Mage Reputation**:\n➣ 11¨ **;Barbarian Reputation**:\n➣ 5¨ **;Basic**:\n➣ 1¨ **;Hot**:\n➣ 2¨ **;Burning**:\n➣ 3¨ **;Fiery**:\n➣ 4¨ **;Infernal**:\n➣ 5",
  );
});

it("names the factions and treats everything else as None", () => {
  expect(formatKuudraStats(kuudraProfile("mages")).startsWith("**Current Faction**:\n➣ Mage¨")).toBe(true);
  expect(formatKuudraStats(kuudraProfile("none")).startsWith("**Current Faction**:\n➣ None¨")).toBe(true);
  expect(formatKuudraStats(kuudraProfile(undefined)).startsWith("**Current Faction**:\n➣ None¨")).toBe(true);
});
