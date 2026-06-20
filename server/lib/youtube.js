const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);
const YOUTUBE_ID_RE = /^[\w-]{11}$/;

export function normalizeYoutubeUrl(value) {
  const text = String(value || "").trim();
  if (YOUTUBE_ID_RE.test(text)) return `https://www.youtube.com/watch?v=${text}`;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (YOUTUBE_HOSTS.has(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/") || url.pathname.startsWith("/embed/")) {
        id = url.pathname.split("/").filter(Boolean)[1] || "";
      }
    }
    return YOUTUBE_ID_RE.test(id) ? `https://www.youtube.com/watch?v=${id}` : text;
  } catch {
    return text;
  }
}

export function isYoutubeUrl(value) {
  try {
    const text = normalizeYoutubeUrl(value);
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return false;
    if (host === "youtu.be") return url.pathname.length > 1;
    if (url.pathname === "/watch") return Boolean(url.searchParams.get("v"));
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/").filter(Boolean).length >= 2;
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/").filter(Boolean).length >= 2;
    return false;
  } catch {
    return false;
  }
}

export function parseYoutubeLines(text) {
  return String(text || "")
    .split(/[\s,]+/)
    .map((line) => line.trim().replace(/^[([<'"]+|[)\]>,.;'"]+$/g, ""))
    .filter(Boolean);
}

export function splitYoutubeUrls(text) {
  const urls = parseYoutubeLines(text);
  const accepted = [];
  const rejected = [];
  const seen = new Set();

  urls.forEach((url) => {
    const normalized = normalizeYoutubeUrl(url);
    if (isYoutubeUrl(normalized)) {
      if (!seen.has(normalized)) {
        seen.add(normalized);
        accepted.push(normalized);
      }
    }
    else rejected.push(url);
  });

  return { accepted, rejected };
}
