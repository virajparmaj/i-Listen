const DEFAULT_HELPER_URL = "http://127.0.0.1:4317";
const TOKEN_KEY = "ilisten.helperToken";

export const helperBaseUrl = import.meta.env.VITE_ILISTEN_HELPER_URL || DEFAULT_HELPER_URL;

function storedToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function helperToken() {
  return storedToken();
}

function assetUrl(path, version = "") {
  const token = storedToken();
  if (!token) return null;
  const url = new URL(`${helperBaseUrl}${path}`);
  url.searchParams.set("token", token);
  if (version) url.searchParams.set("v", version);
  return url.toString();
}

export function coverArtUrlForJob(id, version = "") {
  return assetUrl(`/jobs/${id}/cover`, version);
}

export function audioUrlForJob(id, version = "") {
  return assetUrl(`/jobs/${id}/audio`, version);
}

function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  if (options.body !== undefined && !hasContentType) {
    headers["Content-Type"] = "application/json";
  }
  const token = storedToken();
  if (token) headers["x-ilisten-token"] = token;

  let response;
  try {
    response = await fetch(`${helperBaseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(`Cannot reach local helper at ${helperBaseUrl}: ${error.message}`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Local helper returned ${response.status}`);
  return data;
}

export async function pairHelper() {
  const data = await request("/pair", { method: "POST", body: "{}" });
  setStoredToken(data.token);
  return data;
}

export async function helperHealth() {
  return request("/health");
}

export async function openProject(path = "") {
  return request("/projects/open", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export async function addJobs(text, outputOption) {
  return request("/jobs", {
    method: "POST",
    body: JSON.stringify({ text, outputOption }),
  });
}

export async function listJobs() {
  return request("/jobs");
}

export async function updateJob(id, patch) {
  return request(`/jobs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function organizeJobs(items) {
  return request("/jobs/organize", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function startJob(id) {
  return request(`/jobs/${id}/start`, { method: "POST", body: "{}" });
}

export async function cancelJob(id) {
  return request(`/jobs/${id}/cancel`, { method: "POST", body: "{}" });
}

export async function retryJob(id) {
  return request(`/jobs/${id}/retry`, { method: "POST", body: "{}" });
}

export async function removeJob(id) {
  return request(`/jobs/${id}/remove`, { method: "POST", body: "{}" });
}

export async function createPlaylist() {
  return request("/exports/playlist", { method: "POST", body: "{}" });
}

export async function revealExports() {
  return request("/exports/reveal", { method: "POST", body: "{}" });
}

export async function handoffToIpod(ids = null) {
  return request("/ipod/handoff", {
    method: "POST",
    body: JSON.stringify(Array.isArray(ids) ? { ids } : {}),
  });
}

export async function cleanupAppleMusic() {
  return request("/applemusic/cleanup", { method: "POST", body: "{}" });
}

export async function ipodDevices() {
  return request("/ipod/devices");
}

export async function selectIpodVolume(path) {
  return request("/ipod/select", { method: "POST", body: JSON.stringify({ path }) });
}

export async function ipodStatus() {
  return request("/ipod/status");
}

export async function parseLibrary(xml) {
  return request("/library/parse", { method: "POST", body: JSON.stringify({ xml }) });
}

export async function searchLibraryMatches(tracks) {
  return request("/library/search", { method: "POST", body: JSON.stringify({ tracks }) });
}

export async function importLibraryMatches(matches, options = {}) {
  return request("/library/import", { method: "POST", body: JSON.stringify({ matches, ...options }) });
}

export async function retagTrack(id) {
  return request(`/jobs/${id}/retag`, { method: "POST", body: "{}" });
}

export async function uploadArtwork(id, dataUrl) {
  return request(`/jobs/${id}/artwork`, { method: "POST", body: JSON.stringify({ dataUrl }) });
}

export function connectEvents(onMessage, onError) {
  const token = storedToken();
  if (!token) return null;
  const url = new URL(`${helperBaseUrl}/events`);
  url.searchParams.set("token", token);
  const events = new EventSource(url.toString());
  events.onmessage = (event) => onMessage(JSON.parse(event.data));
  events.onerror = onError;
  return events;
}

export function helperSetupCommand() {
  return "npm run helper";
}
