// Shared !contest (Jacob farming contest) lookup for the in-game and Discord
// commands. Both bots print the same two strings for a contest: `embedText` is
// what Discord posts as an embed description (and what the in-game command
// broadcasts to the bridge), `chatText` is the guild chat line. Only how they
// are sent differs, so that stays in the wrappers.
const axios = require("axios");

const JACOBS_URL = "https://dawjaw.net/jacobs";

// Short names players type -> the crop names dawjaw.net uses.
const CROP_ALIASES = new Map([
  ["cocoa", "Cocoa Beans"],
  ["wart", "Nether Wart"],
  ["cane", "Sugar Cane"],
  ["rose", "Wild Rose"],
]);

function convertSecondsToMinutesAndSeconds(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
  return (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function convertSecondsToHoursMinutesAndSeconds(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
  return (hours > 0 ? (hours < 10 ? "0" : "") + hours + ":" : "") +
    (minutes < 10 ? "0" : "") + minutes + ":" +
    (seconds < 10 ? "0" : "") + seconds;
}

// Pure: whatever the player typed -> the crop name the feed lists.
function normalizeCrop(input) {
  const lower = input.toLowerCase();
  const alias = CROP_ALIASES.get(lower);
  if (alias) {
    return alias;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Pure: first contest in the feed that has not started yet (and, when `crop`
// is given, that features that crop). Undefined when there is none.
function nextContest(events, options = {}) {
  const now = options.now ?? Date.now();
  return events.find(
    (event) => event.time * 1000 > now && (options.crop === undefined || event.crops.includes(options.crop)),
  );
}

function formatGeneralContest(event, now = Date.now()) {
  const timeUntil = convertSecondsToMinutesAndSeconds(event.time * 1000 - now);
  return `The next contest starts in: ${timeUntil}\n\nCrops: \n- ${event.crops.join(", ")}`;
}

function formatSpecificContest(event, crop, now = Date.now()) {
  const timeUntil = convertSecondsToHoursMinutesAndSeconds(event.time * 1000 - now);
  const others = event.crops.filter((other) => other !== crop);
  return `**The next ${crop} contest is in:**\n ${timeUntil} \n\n**and also has:**\n- ${others.join(" and ")}`;
}

const generalEmbedText = (contest) =>
  contest
    .replaceAll(", ", "\n- ")
    .replaceAll("Crops:", "**Crops:**")
    .replaceAll("The next contest starts in:", "**The next contest starts in:**\n");

const generalChatText = (contest) =>
  contest.replaceAll("\n- ", "").replaceAll("\n\n", " ┃ ").replaceAll("- ", "");

const specificEmbedText = (contest) =>
  contest.replaceAll("\n\nand ", "\n\nIt ").replaceAll(" and ", "\n- ");

const specificChatText = (contest) =>
  contest.replaceAll("\n\n", "").replaceAll(":**\n-", "").replaceAll(":**\n", "").replaceAll("*", "");

// Fetch the feed and render the next contest. Resolves to { embedText, chatText };
// undefined when the feed has no upcoming (matching) contest, which the callers
// have always turned into "send nothing".
async function getNextContest(options = {}) {
  const now = options.now ?? Date.now();
  const crop = options.crop;
  const { data } = await axios.get(JACOBS_URL);
  const event = nextContest(data, { now, crop });

  if (event === undefined) {
    return undefined;
  }

  if (crop !== undefined) {
    const contest = formatSpecificContest(event, crop, now);
    return { embedText: specificEmbedText(contest), chatText: specificChatText(contest) };
  }

  const contest = formatGeneralContest(event, now);
  return { embedText: generalEmbedText(contest), chatText: generalChatText(contest) };
}

module.exports = {
  convertSecondsToMinutesAndSeconds,
  convertSecondsToHoursMinutesAndSeconds,
  normalizeCrop,
  nextContest,
  formatGeneralContest,
  formatSpecificContest,
  generalEmbedText,
  generalChatText,
  specificEmbedText,
  specificChatText,
  getNextContest,
};
