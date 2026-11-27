/* eslint-env jest */
jest.mock("../config.json", () => jest.requireActual("../config.example.json"));

const { shapeSkills } = require("../src/contracts/commands/skills.js");

const skillProfile = (levels) => ({
  skills: {
    farming: { level: levels.farming },
    mining: { level: levels.mining },
    combat: { level: levels.combat },
    foraging: { level: levels.foraging },
    fishing: { level: levels.fishing },
    enchanting: { level: levels.enchanting },
    alchemy: { level: levels.alchemy },
    carpentry: { level: levels.carpentry },
    runecrafting: { level: 0 },
    social: { level: 0 },
    taming: { level: levels.taming },
  },
});

const flat = { farming: 30, mining: 30, combat: 30, foraging: 30, fishing: 30, enchanting: 30, alchemy: 30, carpentry: 30, taming: 30 };

it("keeps every displayed level", () => {
  const { levels } = shapeSkills(skillProfile(flat));

  expect(levels).toEqual({
    farming: 30, mining: 30, combat: 30, foraging: 30, fishing: 30,
    enchanting: 30, alchemy: 30, carpentry: 30, runecrafting: 0, social: 0, taming: 30,
  });
});

it("averages nine skills (runecrafting and social are displayed only)", () => {
  expect(shapeSkills(skillProfile(flat)).sa).toBe(30);
});

it("rounds the average to one decimal", () => {
  expect(shapeSkills(skillProfile({ ...flat, farming: 31 })).sa).toBe(30.1);
});
