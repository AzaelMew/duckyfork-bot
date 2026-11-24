"use strict";

/**
 * commandFilter.js - decides which Discord command modules a bot loads.
 *
 * Sky loads every slash command (src/discord/commands) and every legacy
 * "!command" (src/discord/oldcommands); Aria runs only nine legacy commands.
 * config.discord.commands.enabled selects the set:
 *
 *   "*"                      every command (Sky)
 *   ["autoclaim", "kick"]    only commands with those names
 *   ["old:kick", "slash:help"]  the same, restricted to one family
 *
 * The "old:" / "slash:" prefix exists because the two families share names:
 * Aria runs the legacy "kick" but has no slash "kick", and a bare "kick" would
 * enable both.
 */

const config = require("../../config.json");

const KINDS = ["slash", "old"];

/**
 * @returns {string[]|null} null when everything is enabled, otherwise the lower
 *   case allow list.
 */
function enabledList() {
  const commands = config.discord && config.discord.commands;
  const value = commands ? commands.enabled : "*";

  if (value === undefined || value === null || value === "*") return null;
  if (!Array.isArray(value)) return null;

  return value
    .map((entry) => String(entry).trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * @param {"slash"|"old"} kind family of the command module
 * @param {string} name command name as exported by the module
 * @returns {boolean} true when the module may be loaded
 */
function isEnabled(kind, name) {
  if (KINDS.includes(kind) === false) {
    throw new Error(`[commandFilter] unknown command family: ${kind}`);
  }

  const list = enabledList();
  if (list === null) return true;
  if (typeof name !== "string" || name.trim().length === 0) return false;

  const lower = name.trim().toLowerCase();
  return list.includes(lower) || list.includes(`${kind}:${lower}`);
}

function getPrefix() {
  return config.discord?.commands?.prefix ?? "!";
}

module.exports = { isEnabled, enabledList, getPrefix };
