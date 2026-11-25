/* eslint-env jest */
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));
jest.mock("../API/functions/getLatestProfile.js", () => ({
  getLatestProfile: jest.fn(async () => ({ profile: {}, profileData: { profile_id: "p", banking: { balance: 5 } }, uuid: "u", museum: {} })),
}));
jest.mock("../API/functions/getMuseum.js", () => ({ getMuseum: jest.fn() }));
jest.mock("../src/contracts/API/mowojangAPI.js", () => ({ getUsername: jest.fn() }));
jest.mock("skyhelper-networth", () => ({
  ProfileNetworthCalculator: class {
    async getNetworth() {
      return {
        networth: 1234567890, purse: 1500, bank: 2000000, personalBank: 50,
        types: { armor: { total: 12345 }, enderchest: { total: 1000 }, storage: { total: 2000 }, sacks: { total: 999999 } },
      };
    }
  },
}));

const { getNetworthSummary, NetworthError, toChatText, toEmbedText } = require("../src/contracts/networthSummary.js");

it("keeps the Discord-style output", async () => {
  const { username, text } = await getNetworthSummary("Steve");
  expect(username).toBe("Steve");
  expect(toChatText(text)).toBe(
    "˚Total: $1,234,815,672˚ Purse: $1.5k˚ Bank: $2m/50˚ Armor: $12.3k˚ Equipment: $0˚ Wardrobe: $0˚ Inventory: $0˚ Storage: $3k˚ Pets: $0˚ Talis: $0˚ Museum: $0˚ Sacks: $1m"
  );
  expect(toEmbedText(text).startsWith("**Total**:\n➣ $1,234,815,672\n **Purse:**\n➣ $1.5k")).toBe(true);
});

it("rejects invalid names with a user-safe error", async () => {
  await expect(getNetworthSummary("bad name!")).rejects.toBeInstanceOf(NetworthError);
});
