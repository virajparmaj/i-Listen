// YouTube link parsing for the converter's paste input.
// Pulls real YouTube URLs out of arbitrary pasted text so the UI can show one
// removable chip per link instead of a raw blob of text.

const YT_URL_RE =
  /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?\S*v=[\w-]{4,}|shorts\/[\w-]{4,}|live\/[\w-]{4,}|embed\/[\w-]{4,})|youtu\.be\/[\w-]{4,})\S*/gi;
const YT_ID_RE = /^[\w-]{11}$/;

function canonicalYoutubeUrl(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") id = u.pathname.split("/").filter(Boolean)[0] || "";
    else if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else if (/^\/(shorts|live|embed)\//.test(u.pathname)) id = u.pathname.split("/").filter(Boolean)[1] || "";
    }
    return YT_ID_RE.test(id) ? `https://www.youtube.com/watch?v=${id}` : url;
  } catch {
    return url;
  }
}

/** Normalise a matched link: trim trailing punctuation and add a scheme. */
function normalizeLink(raw) {
  let url = String(raw).trim().replace(/[)>,.;'"]+$/, "");
  if (YT_ID_RE.test(url)) return `https://www.youtube.com/watch?v=${url}`;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return canonicalYoutubeUrl(url);
}

function candidateTokens(text) {
  return String(text || "")
    .split(/[\s,]+/)
    .map((token) => token.trim().replace(/^[([<'"]+|[)\]>,.;'"]+$/g, ""))
    .filter(Boolean);
}

/**
 * Extract every YouTube link from arbitrary text (newline / comma / space
 * separated), normalised and de-duplicated in first-seen order.
 * @param {string} text
 * @returns {string[]}
 */
export function extractYouTubeLinks(text) {
  const matches = [
    ...(String(text || "").match(YT_URL_RE) || []),
    ...candidateTokens(text).filter((token) => YT_ID_RE.test(token)),
  ];
  const seen = new Set();
  const links = [];
  for (const raw of matches) {
    const url = normalizeLink(raw);
    if (seen.has(url)) continue;
    seen.add(url);
    links.push(url);
  }
  return links;
}

/**
 * True when the whole trimmed string is a single YouTube link (no whitespace).
 * @param {string} value
 * @returns {boolean}
 */
export function isYouTubeUrl(value) {
  const text = String(value || "").trim();
  if (!text || /\s/.test(text)) return false;
  return extractYouTubeLinks(text).length === 1;
}

/**
 * Merge new links into an existing list, de-duplicated, preserving order.
 * @param {string[]} existing
 * @param {string[]} incoming
 * @returns {string[]}
 */
export function mergeLinks(existing, incoming) {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const link of incoming) {
    if (seen.has(link)) continue;
    seen.add(link);
    merged.push(link);
  }
  return merged;
}

/** Short, human-friendly chip label for a YouTube link (id-focused). */
export function linkLabel(url) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "") || url;
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || u.hostname;
  } catch {
    return url;
  }
}
