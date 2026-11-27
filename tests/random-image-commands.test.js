/* eslint-env jest */
jest.mock("axios");
jest.mock("../src/contracts/Imgur/imgurExport.js", () => ({ uploadBuffer: jest.fn() }));

const fs = require("fs");
const os = require("os");
const path = require("path");
const axios = require("axios");
const uploader = require("../src/contracts/Imgur/imgurExport.js");

const {
  COOLDOWN_MESSAGE,
  COOLDOWN_MS,
  SOURCES,
  Encode,
  decode,
  charInc,
  getImage,
  cooldownRemaining,
  readLastRun,
  writeLastRun,
  fetchWithCooldown,
  announceImage,
  sendImageEmbed,
  sendCooldownEmbed,
} = require("../src/contracts/commands/randomImage.js");

let dir;

// The picture every mocked source resolves to.
const image = "https://i.imgur.com/abcd123.png";

beforeEach(() => {
  jest.clearAllMocks();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ducky-random-image-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("STuF encoding", () => {
  it("round-trips the URLs the picture APIs return", () => {
    const urls = [
      "https://i.imgur.com/abcd123.png",
      "http://example.com/a/b/picture.jpeg",
      "https://cdn.nekos.best/api/v2/neko/0001.gif",
      "https://images.dog.ceo/breeds/hound/n02088094_1003.jpg",
    ];

    urls.forEach((url) => expect(decode(Encode(url))).toBe(url));
  });

  it("keeps the charset shift wrapping like the original charInc", () => {
    // charset is abc..xyzABC..XYZ0..9, so the shift crosses case boundaries.
    expect(charInc("z", 1)).toBe("A");
    expect(charInc("Z", 1)).toBe("0");
    expect(charInc("a", -1)).toBe("9");
    expect(charInc("9", 1)).toBe("a");
    expect(charInc("http://a.b/c.png", 1)).not.toBe("http://a.b/c.png");
  });

  it("refuses strings that are not STuF", () => {
    expect(() => decode("https://i.imgur.com/x.png")).toThrow("String does not appear to be in STuF");
  });
});

describe("cooldown", () => {
  it("treats an empty or unparsable timestamp as 'never run'", () => {
    expect(COOLDOWN_MS).toBe(5000);
    // index.js boots the file with "" and the original did parseInt(fileData) || 0.
    expect(cooldownRemaining("", 1000000)).toBe(0);
    expect(cooldownRemaining(undefined, 1000000)).toBe(0);
    expect(cooldownRemaining("not a timestamp", 1000000)).toBe(0);
  });

  it("counts down and reaches zero at exactly 5 s", () => {
    expect(cooldownRemaining("1000", 1000)).toBe(5000);
    expect(cooldownRemaining("1000", 3000)).toBe(3000);
    expect(cooldownRemaining("1000", 5999)).toBe(1);
    expect(cooldownRemaining("1000", 6000)).toBe(0);
    expect(cooldownRemaining("1000", 999999)).toBe(0);
  });

  it("reads and writes the timestamp file in the working directory", async () => {
    const file = path.join(dir, "lastDogCalledTime.txt");

    await expect(readLastRun(file)).rejects.toBeTruthy();

    await writeLastRun(file, 1234);
    expect(await readLastRun(file)).toBe(1234);
    expect(fs.readFileSync(file, "utf8")).toBe("1234");
  });

  it("fetches first, then applies the cooldown, like the shipped dog command", async () => {
    const file = path.join(dir, "lastDogCalledTime.txt");
    const dog = "https://images.dog.ceo/breeds/hound/n02088094_1003.jpg";
    fs.writeFileSync(file, ""); // index.js creates the file empty on boot
    axios.get.mockResolvedValue({ data: { message: dog } });

    await expect(fetchWithCooldown("dog", file)).resolves.toBe(dog);
    expect(axios.get).toHaveBeenCalledWith("https://dog.ceo/api/breeds/image/random");
    expect(parseInt(fs.readFileSync(file, "utf8"), 10)).toBeGreaterThan(0);

    await expect(fetchWithCooldown("dog", file)).resolves.toBe(COOLDOWN_MESSAGE);
    expect(axios.get).toHaveBeenCalledTimes(2); // a blocked call still hits the API

    fs.writeFileSync(file, (Date.now() - COOLDOWN_MS).toString());
    await expect(fetchWithCooldown("dog", file)).resolves.toBe(dog);
  });
});

describe("picture sources", () => {
  const picture = "https://cdn.example.com/picture.png";

  beforeEach(() => {
    uploader.uploadBuffer.mockResolvedValue({ url: "https://i.imgur.com/uploaded.png" });
  });

  it("picks the field each API uses and uploads it to Imgur", async () => {
    const responses = {
      [SOURCES.cat.url]: [{ url: "https://cdn.thecatapi.com/cat.png" }],
      [SOURCES.dog.url]: { message: "https://images.dog.ceo/dog.jpg" },
      [SOURCES.neko.url]: { results: [{ url: "https://cdn.nekos.best/neko.png" }] },
      [SOURCES.duck.url]: { url: "https://random-d.uk/duck.jpg" },
    };
    axios.get.mockImplementation(async (url) => {
      if (url in responses) return { data: responses[url] };
      return { data: Buffer.from("image") };
    });

    for (const name of ["cat", "dog", "neko", "duck"]) {
      await expect(getImage(name)).resolves.toBe("https://i.imgur.com/uploaded.png");
    }

    const uploaded = axios.get.mock.calls.map((call) => call[0]);
    expect(uploaded).toEqual(
      expect.arrayContaining([
        "https://cdn.thecatapi.com/cat.png",
        "https://images.dog.ceo/dog.jpg",
        "https://cdn.nekos.best/neko.png",
        "https://random-d.uk/duck.jpg",
      ]),
    );
    expect(uploader.uploadBuffer).toHaveBeenCalledTimes(4);
  });

  it("falls back to the command's original text when Imgur is unreachable", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    axios.get.mockImplementation(async (url) => {
      if (url === SOURCES.neko.url) return { data: { results: [{ url: picture }] } };
      throw new Error("imgur down");
    });

    await expect(getImage("neko")).resolves.toBe("Failed to get Imgur ID for cat picture, try again in a few seconds");
    console.error.mockRestore();
  });

  it("keeps each command's upload-failure text", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    axios.get.mockImplementation(async (url) => {
      if (url === SOURCES.dog.url) return { data: { message: picture } };
      throw new Error("boom");
    });

    await expect(getImage("dog")).resolves.toBe("Failed to get Imgur ID for dog picture, try again in a few seconds");
    console.error.mockRestore();
  });
});

describe("delivery", () => {
  const image = "https://i.imgur.com/abcd123.png";

  it("sends the encoded guild line and the bridge broadcast", () => {
    const command = { send: jest.fn(), minecraft: { broadcastNewImage: jest.fn() } };

    announceImage(command, "Alice", image);

    expect(command.send).toHaveBeenCalledWith(`/gc ${Encode(image)}`);
    expect(command.minecraft.broadcastNewImage).toHaveBeenCalledWith({
      username: "Alice",
      image: image,
      icon: "https://minotar.net/helm/Alice.png",
    });
  });

  it("keeps the Discord embed layout", () => {
    const channel = { send: jest.fn() };

    sendImageEmbed(channel, image);
    sendCooldownEmbed(channel);

    const [picture, cooldown] = channel.send.mock.calls.map((call) => call[0].embeds[0]);
    expect(picture.image).toEqual({ url: image });
    expect(picture.color).toBe(0x2a2a2a);
    expect(picture.footer).toEqual({ text: "BOT" });
    expect(picture.timestamp).toBeInstanceOf(Date);
    expect(picture.description).toBeUndefined();

    expect(cooldown.description).toBe(COOLDOWN_MESSAGE);
    expect(cooldown.color).toBe(0x2a2a2a);
    expect(cooldown.footer).toEqual({ text: "BOT" });
  });
});

describe("commands use the shared module", () => {
  const inGameFiles = {
    cat: ["../src/minecraft/commands/CatCommand.js", "cat"],
    dog: ["../src/minecraft/commands/DogCommand.js", "dog"],
    neko: ["../src/minecraft/commands/NekoCommand.js", "neko"],
    duck: ["../src/minecraft/commands/duckCommand.js", "duck"],
  };
  const discordFiles = {
    cat: "../src/discord/oldcommands/CatCommand.js",
    dog: "../src/discord/oldcommands/DogCommand.js",
    neko: "../src/discord/oldcommands/NekoCommand.js",
    duck: "../src/discord/oldcommands/duckCommand.js",
  };

  const files = [...Object.values(inGameFiles).map((entry) => entry[0]), ...Object.values(discordFiles)];

  it("no longer carries its own copy of the encoder", () => {
    files.forEach((file) => {
      const source = fs.readFileSync(path.join(__dirname, file), "utf8");
      expect(source).toContain("contracts/commands/randomImage.js");
      expect(source).not.toContain("function Encode");
      expect(source).not.toContain("function charInc");
    });
  });

  it("sends the same in-game chat line as before", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    axios.get.mockImplementation(async (url) => {
      if (url === SOURCES.cat.url) return { data: [{ url: "https://cdn.thecatapi.com/cat.png" }] };
      if (url === SOURCES.dog.url) return { data: { message: "https://images.dog.ceo/dog.jpg" } };
      if (url === SOURCES.neko.url) return { data: { results: [{ url: "https://cdn.nekos.best/neko.png" }] } };
      return { data: { url: "https://random-d.uk/duck.jpg" } };
    });
    uploader.uploadBuffer.mockResolvedValue({ url: image });

    for (const [name, [file]] of Object.entries(inGameFiles)) {
      // eslint-disable-next-line global-require
      const Command = require(file);
      const command = new Command({ broadcastNewImage: jest.fn() });
      command.send = jest.fn();

      await command.onCommand("Alice", `!${name}`);

      expect(command.send).toHaveBeenCalledWith(`/gc ${Encode(image)}`);
      expect(command.minecraft.broadcastNewImage).toHaveBeenCalledWith({
        username: "Alice",
        image: image,
        icon: "https://minotar.net/helm/Alice.png",
      });
    }

    console.error.mockRestore();
  });

  it("posts the same Discord embed (and guild line) as before", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    axios.get.mockImplementation(async (url) => {
      if (url === SOURCES.dog.url) return { data: { message: image } };
      if (url === SOURCES.duck.url) return { data: { url: image } };
      if (url === SOURCES.neko.url) return { data: { results: [{ url: image }] } };
      return { data: [{ url: image }] };
    });
    uploader.uploadBuffer.mockResolvedValue({ url: image });

    const expectedMinecraftLine = {
      cat: `/gc ${Encode(image)}`,
      neko: `/gc ${Encode(image)}`,
      dog: null,
      duck: null,
    };

    const cwd = process.cwd();
    process.chdir(dir);
    fs.writeFileSync("lastDogCalledTime.txt", ""); // created at boot by index.js
    try {
      for (const [name, file] of Object.entries(discordFiles)) {
        // eslint-disable-next-line global-require
        const Command = require(file);
        const command = new Command({ app: { minecraft: { bot: { player: {} } } } });
        command.sendMinecraftMessage = jest.fn();
        const channel = { send: jest.fn() };

        command.onCommand({ content: `!${name}`, channel: channel });
        for (let i = 0; i < 20 && channel.send.mock.calls.length === 0; i += 1) {
          await new Promise((resolve) => setImmediate(resolve));
        }

        const embed = channel.send.mock.calls[0][0].embeds[0];
        expect(embed.image).toEqual({ url: image });
        expect(embed.color).toBe(0x2a2a2a);
        expect(embed.footer).toEqual({ text: "BOT" });

        if (expectedMinecraftLine[name]) {
          expect(command.sendMinecraftMessage).toHaveBeenCalledWith(expectedMinecraftLine[name]);
        } else {
          expect(command.sendMinecraftMessage).not.toHaveBeenCalled();
        }
      }
    } finally {
      process.chdir(cwd);
      console.error.mockRestore();
    }
  });
});
