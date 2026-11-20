"use strict";

/**
 * bridge.js - the one place that talks to the peer bot.
 *
 * Both bots (Sky and Aria) run the same code and mirror guild chat to each
 * other over HTTP. Every peer call used to be a copy of
 *
 *   axios.post("http://<peer>:<port>/api/<endpoint>", body,
 *              { headers: { Authorization: <config.web.token> } })
 *
 * with its own ECONNREFUSED handling. This module replaces those copies:
 * the peer address comes from config.bridge.peerUrl, the token from
 * config.web.token and the bot's own name from config.bridge.name, so the
 * same tree can run as either bot without editing source.
 *
 * Configuration is validated when this module is first required (that is,
 * during startup): a missing or empty required key throws with the key path
 * and never prints a value. Placeholder values copied from
 * config.example.json are reported loudly but do not throw, because the CI
 * gate runs the whole tree against that example file.
 */

const axios = require("axios");
const config = require("../../config.json");

const EXAMPLE_PEER_HOSTS = ["peer_host", "peer-host", "peerhost"];

function bridgeError(message) {
  return new Error(`[bridge] ${message} (see config.example.json and docs/config.md)`);
}

function requiredString(value, keyPath) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw bridgeError(`config.${keyPath} is required and must be a non-empty string`);
  }
  return value.trim();
}

function validate() {
  const bridge = config.bridge;
  if (bridge === null || typeof bridge !== "object" || Array.isArray(bridge)) {
    throw bridgeError("config.bridge is missing; add it with scripts/migrate-config.js");
  }

  const name = requiredString(bridge.name, "bridge.name");
  const peerUrlRaw = requiredString(bridge.peerUrl, "bridge.peerUrl");
  const peerGuild = requiredString(bridge.peerGuild, "bridge.peerGuild");
  const token = requiredString(config.web && config.web.token, "web.token");

  let parsed;
  try {
    parsed = new URL(peerUrlRaw);
  } catch (error) {
    throw bridgeError("config.bridge.peerUrl is not an absolute URL (expected http://host:port)");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw bridgeError("config.bridge.peerUrl must use http:// or https://");
  }
  if (EXAMPLE_PEER_HOSTS.includes(parsed.hostname.toLowerCase())) {
    console.error(
      "[bridge] config.bridge.peerUrl still holds the config.example.json placeholder; " +
        "run scripts/migrate-config.js with the real peer address before starting the bot",
    );
  }

  return {
    name,
    peerGuild,
    peerUrl: peerUrlRaw.replace(/\/+$/, ""),
    token,
  };
}

const settings = validate();

/**
 * The bot's own name, as shown to players ("<name> has joined", "- <name>" rank
 * suffix, embed footers, "!<name> Bridge is Online").
 */
const name = settings.name;

/**
 * Name used for the peer in log lines and in the guild field of /api/message.
 */
const peerGuild = settings.peerGuild;

/**
 * Peer base URL without a trailing slash (config.bridge.peerUrl).
 */
const peerUrl = settings.peerUrl;

/**
 * POST a JSON body to the peer bot.
 *
 * @param {string} path endpoint path, e.g. "/api/command"
 * @param {object} body request body, unchanged from the old call sites
 * @returns {Promise<object|undefined>} the axios response, or undefined when the
 *   peer is offline / returned an error. Errors are logged, never thrown: the
 *   callers are fire-and-forget mirroring paths and a down peer must not take
 *   this bot down with an unhandled rejection.
 */
async function postToPeer(path, body) {
  if (typeof path !== "string" || path.startsWith("/") === false) {
    console.error("[bridge] postToPeer needs an absolute endpoint path, got:", String(path));
    return undefined;
  }

  try {
    return await axios.post(`${peerUrl}${path}`, body, {
      headers: { Authorization: settings.token },
    });
  } catch (error) {
    if (error && error.code === "ECONNREFUSED") {
      console.error(`Connection refused: ${peerGuild} is offline`);
    } else {
      console.error("An error occurred:", error && error.message);
    }
    return undefined;
  }
}

module.exports = { name, peerGuild, peerUrl, postToPeer };
