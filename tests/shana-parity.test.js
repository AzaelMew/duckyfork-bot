/* eslint-env jest */
/**
 * What a bot without a peer (Shana) needs from the shared tree: a disabled
 * bridge, a command deny list, the opt-in role sync, and the small fixes and
 * features its own tree had.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

jest.mock("axios");

let mockConfig;

jest.mock("../config.json", () => mockConfig);

const ROOT = path.join(__dirname, "..");

function exampleConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8"));
}

function standaloneConfig() {
  const config = exampleConfig();
  config.bridge = {
    enabled: false,
    name: "Baka",
    peerUrl: "",
    peerGuild: "",
    mirrorOnSend: false,
    relayBangCommands: false,
    peerRank: { rank: "", guildRank: "" },
  };
  config.web.token = "";
  config.minecraft.API.waifuItKey = "test-waifu";
  config.minecraft.API.statsProxyUrl = "http://stats.test:3000";
  config.minecraft.API.statsProxyKey = "test-stats";
  config.guild.name = "Bakacord";
  return config;
}

let axiosMock;

function reload(config) {
  jest.resetModules();
  mockConfig = config;
  axiosMock = require("axios");
  axiosMock.post.mockReset();
  axiosMock.get.mockReset();
}

describe("bridge.enabled false", () => {
  it("boots without a peer address or token and never posts", async () => {
    reload(standaloneConfig());
    const bridge = require("../src/contracts/bridge.js");
    expect(bridge.enabled).toBe(false);
    expect(bridge.name).toBe("Baka");
    await expect(bridge.postToPeer("/api/command", { message: "x" })).resolves.toBeUndefined();
    expect(axiosMock.post).not.toHaveBeenCalled();
  });

  it("still requires the peer address when the bridge is enabled", () => {
    const config = standaloneConfig();
    config.bridge.enabled = true;
    reload(config);
    expect(() => require("../src/contracts/bridge.js")).toThrow("bridge.peerUrl");
  });

  it("check-config accepts empty peer keys only for a disabled bridge", () => {
    const { checkConfigFile } = require("../scripts/check-config.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "standalone-check-"));
    try {
      const file = path.join(dir, "config.json");
      const config = standaloneConfig();
      fs.writeFileSync(file, JSON.stringify(config));
      expect(checkConfigFile(file).problems).toEqual([]);

      config.bridge.enabled = true;
      fs.writeFileSync(file, JSON.stringify(config));
      expect(checkConfigFile(file).problems.join("\n")).toContain("bridge.peerUrl");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrate-config needs no --peer-url with --bridge-enabled false", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "standalone-migrate-"));
    try {
      const input = path.join(dir, "config.json");
      const output = path.join(dir, "config.json.new");
      const host = exampleConfig();
      delete host.bridge;
      delete host.guild;
      delete host.discord.commands.disabled;
      delete host.features.roleSync;
      fs.writeFileSync(input, JSON.stringify(host));
      const guildFile = path.join(dir, "guild.json");
      fs.writeFileSync(guildFile, JSON.stringify(Object.assign(exampleConfig().guild, { name: "Bakacord" })));

      const result = spawnSync(
        process.execPath,
        [
          path.join(ROOT, "scripts", "migrate-config.js"),
          "--in", input, "--out", output,
          "--name", "Baka", "--bridge-enabled", "false",
          "--guild-file", guildFile,
          "--commands-disabled", "slash:online",
          "--role-sync", "true",
        ],
        { cwd: ROOT, encoding: "utf8" },
      );
      expect(result.status).toBe(0);
      const migrated = JSON.parse(fs.readFileSync(output, "utf8"));
      expect(migrated.bridge.enabled).toBe(false);
      expect(migrated.bridge.peerUrl).toBe("");
      expect(migrated.guild.name).toBe("Bakacord");
      expect(migrated.discord.commands.disabled).toEqual(["slash:online"]);
      expect(migrated.features.roleSync).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("discord.commands.disabled", () => {
  it("removes commands from \"*\" per family", () => {
    const config = standaloneConfig();
    config.discord.commands.enabled = "*";
    config.discord.commands.disabled = ["slash:online", "force-verify"];
    reload(config);
    const commandFilter = require("../src/contracts/commandFilter.js");
    expect(commandFilter.isEnabled("slash", "online")).toBe(false);
    expect(commandFilter.isEnabled("old", "online")).toBe(true);
    expect(commandFilter.isEnabled("slash", "force-verify")).toBe(false);
    expect(commandFilter.isEnabled("slash", "help")).toBe(true);
  });

  it("applies after an allow list too", () => {
    const config = standaloneConfig();
    config.discord.commands.enabled = ["old:kick", "old:mute"];
    config.discord.commands.disabled = ["old:mute"];
    reload(config);
    const commandFilter = require("../src/contracts/commandFilter.js");
    expect(commandFilter.isEnabled("old", "kick")).toBe(true);
    expect(commandFilter.isEnabled("old", "mute")).toBe(false);
  });
});

describe("ported Shana commands", () => {
  it("ships the slash commands Shana registered", () => {
    reload(standaloneConfig());
    for (const file of ["forceUpdateCommand.js", "forceUpdateEveryone.js", "forceVerifyCommand.js", "onlineCommand.js"]) {
      const command = require(`../src/discord/commands/${file}`);
      expect(typeof command.name).toBe("string");
      expect(typeof command.execute).toBe("function");
    }
  });

  it("farmhelper answers per crop and keeps the farm link without one", () => {
    reload(standaloneConfig());
    const GardenHelper = require("../src/minecraft/commands/GardenHelperCommand.js");
    const command = new GardenHelper({});
    command.send = jest.fn();

    command.onCommand("Player", "!farmhelper Cactus");
    expect(command.send).toHaveBeenLastCalledWith("/gc 400 Speed | 90° Angle Yaw");

    command.onCommand("Player", "!farmhelper");
    expect(command.send.mock.calls[1][0]).toMatch(/^\/gc Compatible farms at \/visit farminghub /);

    command.onCommand("Player", "!farmhelper kelp");
    expect(command.send).toHaveBeenLastCalledWith(expect.stringContaining("/gc Unknown crop. Options: cocoa, cane"));
  });

  it("send does not throw while the Minecraft bot is not connected", () => {
    reload(standaloneConfig());
    const minecraftCommand = require("../src/contracts/minecraftCommand.js");
    const command = new minecraftCommand({});
    const saved = global.bot;
    try {
      global.bot = undefined;
      expect(() => command.send("/gc hi")).not.toThrow();
      expect(() => command.warpSend("/gc hi")).not.toThrow();
    } finally {
      global.bot = saved;
    }
  });

  it("!slayers is an exact alias, not a substring match", () => {
    reload(standaloneConfig());
    const SlayerCommand = require("../src/minecraft/commands/SlayerCommand.js");
    expect(new SlayerCommand({}).aliases).toEqual(["slayers"]);
  });
});

describe("web.enabled", () => {
  function initialize(enabled) {
    const config = standaloneConfig();
    config.web.enabled = enabled;
    reload(config);
    const ExpressManager = require("../src/express/ExpressManager.js");
    const manager = new ExpressManager({ minecraft: {} });
    manager.express.listen = jest.fn();
    manager.initialize();
    return manager.express.listen;
  }

  it("does not open the API port when web.enabled is false", () => {
    expect(initialize(false)).not.toHaveBeenCalled();
  });

  it("listens when web.enabled is true", () => {
    expect(initialize(true)).toHaveBeenCalledTimes(1);
  });
});
