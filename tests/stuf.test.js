const { describe, it, expect } = require("@jest/globals");
const { encode, decode } = require("../src/contracts/stuf.js");

describe("stuf", () => {
  it("round-trips an https png link", () => {
    const link = "https://i.imgur.com/abc.png";
    const encoded = encode(link);

    expect(encoded.startsWith("l$")).toBe(true);
    expect(encoded.includes("https://")).toBe(false);
    expect(decode(encoded)).toBe(link);
  });

  it("round-trips http / jpg / jpeg / gif links", () => {
    const links = [
      "http://i.imgur.com/abc.jpg",
      "https://i.imgur.com/abc.jpeg",
      "https://i.imgur.com/abc.gif",
    ];

    for (const link of links) {
      expect(decode(encode(link))).toBe(link);
    }
  });

  it("round-trips a long link with many dots", () => {
    const link = "https://cdn.discordapp.com/attachments/1/2/my.image.file.name.png";
    expect(decode(encode(link))).toBe(link);
  });

  it("throws when decoding something that is not STuF", () => {
    expect(() => decode("https://i.imgur.com/abc.png")).toThrow();
  });
});
