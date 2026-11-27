/* eslint-env jest */
/**
 * The shared SkyBlock profile lookup behind !cata / !kuudra / !skills /
 * !slayer / !stats: config-driven proxy URL, UUID resolution, number helpers.
 * Every value here is fake.
 */
jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const FAKE_STATS_URL = "http://localhost:3000";
const FAKE_STATS_KEY = "test-stats-key";
const FAKE_UUID = "0123456789abcdef0123456789abcdef";

let axiosMock;
let profile;

beforeEach(() => {
  mockConfig = jest.requireActual("../config.example.json");
  mockConfig.minecraft.API.statsProxyUrl = FAKE_STATS_URL;
  mockConfig.minecraft.API.statsProxyKey = FAKE_STATS_KEY;
  jest.resetModules();
  jest.mock("../config.json", () => mockConfig);
  axiosMock = require("axios");
  axiosMock.get.mockReset();
  // eslint-disable-next-line global-require
  profile = require("../src/contracts/commands/skyblockProfile.js");
});

describe("fetchProfiles", () => {
  it("asks the configured proxy for the uuid and returns the body", async () => {
    axiosMock.get.mockResolvedValue({ data: { data: [{ name: "Alice" }] } });

    const body = await profile.fetchProfiles(FAKE_UUID);

    expect(axiosMock.get).toHaveBeenCalledWith(FAKE_STATS_URL + "/v1/profiles/" + FAKE_UUID + "?key=" + FAKE_STATS_KEY);
    expect(body).toEqual({ data: [{ name: "Alice" }] });
  });

  it("sends the historical \"a\" placeholder when no uuid was resolved", async () => {
    axiosMock.get.mockResolvedValue({ data: { data: [] } });

    await profile.fetchProfiles(undefined);

    expect(axiosMock.get.mock.calls[0][0]).toBe(FAKE_STATS_URL + "/v1/profiles/a?key=" + FAKE_STATS_KEY);
  });

  it("never calls out for the skipped account", async () => {
    await expect(profile.fetchProfiles(profile.SKIPPED_UUID)).resolves.toBeUndefined();
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it("propagates proxy failures so each command can word them", async () => {
    const error = new Error("Request failed with status code 404");
    error.response = { status: 404, data: { reason: "Invalid Username" } };
    axiosMock.get.mockRejectedValue(error);

    await expect(profile.fetchProfiles(FAKE_UUID)).rejects.toBe(error);
    expect(profile.errorText(error)).toBe("[ERROR] Invalid Username");
  });
});

describe("getUUIDFromUsername", () => {
  it("rejects names that cannot be an IGN without calling out", async () => {
    await expect(profile.getUUIDFromUsername("bad name!")).resolves.toBe("Error");
    expect(axiosMock.get).not.toHaveBeenCalled();
  });

  it("falls back to ashcon and strips one dash, as it always has", async () => {
    axiosMock.get
      .mockRejectedValueOnce(new Error("mojang down"))
      .mockResolvedValueOnce({ data: { uuid: "11111111-2222-3333-4444-555555555555" } });

    await expect(profile.getUUIDFromUsername("Alice")).resolves.toBe("111111112222-3333-4444-555555555555");
    expect(axiosMock.get.mock.calls[1][0]).toBe("https://api.ashcon.app/mojang/v2/user/Alice");
  });
});

describe("number helpers", () => {
  it("keeps the in-game >999815672 networth quirk only when asked", () => {
    expect(profile.numberWithCommas(1234567890)).toBe("1,234,815,672");
    expect(profile.numberWithCommas(1234567890, false)).toBe("1,234,567,890");
    expect(profile.numberWithCommas(1500)).toBe("1,500");
    expect(profile.numberWithCommas(1500, false)).toBe("1,500");
  });

  it("drops the decimals and rounds to the requested precision", () => {
    expect(profile.numberWithCommas(999.9)).toBe("999");
    expect(profile.round(30.1111, 1)).toBe(30.1);
    expect(profile.round(2.25, 1)).toBe(2.3);
  });

  it("adds the 50+ overflow as a fraction of the next level", () => {
    expect(profile.levelWithOverflow(50, 569809640)).toBe(50);
    expect(profile.levelWithOverflow(50, 569809640 + 100000000)).toBe(50.5);
    expect(profile.levelWithOverflow(42.5, 0)).toBe(42.5);
    expect(profile.levelWithOverflow(0, undefined)).toBe(0);
  });
});
