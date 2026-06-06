const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function isYoutubeUrl(value) {
  try {
    const url = new URL(String(value).trim());
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
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function splitYoutubeUrls(text) {
  const urls = parseYoutubeLines(text);
  const accepted = [];
  const rejected = [];

  urls.forEach((url) => {
    if (isYoutubeUrl(url)) accepted.push(url);
    else rejected.push(url);
  });

  return { accepted, rejected };
}
