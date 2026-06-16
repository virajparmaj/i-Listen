import { useCallback, useMemo, useState } from "react";
import { importLibraryMatches, parseLibrary, searchLibraryMatches } from "../utils/localHelper.js";

const SEARCH_BATCH = 4;

export function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/** Ordered, de-duplicated track ids across the selected playlists, minus excluded ids. */
export function selectedTrackIds(library, selectedPlaylistIds, excludedIds) {
  if (!library) return [];
  const excluded = excludedIds instanceof Set ? excludedIds : new Set(excludedIds);
  const seen = new Set();
  const ids = [];
  library.playlists
    .filter((playlist) => selectedPlaylistIds.has(playlist.id))
    .forEach((playlist) => {
      playlist.trackIds.forEach((id) => {
        if (seen.has(id) || excluded.has(id)) return;
        seen.add(id);
        ids.push(id);
      });
    });
  return ids;
}

/** Selected playlist names that contain the given track — used to recreate playlists. */
export function playlistsForTrack(library, selectedPlaylistIds, trackId) {
  if (!library) return [];
  return library.playlists
    .filter((playlist) => selectedPlaylistIds.has(playlist.id) && playlist.trackIds.includes(trackId))
    .map((playlist) => playlist.name);
}

/** The YouTube URL a reviewer settled on for a match: a manual paste wins, else the chosen candidate. */
export function chosenUrl(match) {
  if (!match) return "";
  const manual = String(match.manualUrl || "").trim();
  if (manual) return manual;
  const candidate = match.candidates?.[match.chosenIndex ?? 0];
  return candidate?.url || match.best?.url || "";
}

/** Turn the review state into the `/library/import` payload (only tracks with a usable URL). */
export function buildImportMatches({ library, selectedPlaylistIds, matches }) {
  return Object.values(matches)
    .map((match) => {
      const youtubeUrl = chosenUrl(match);
      const track = library?.tracksById?.[String(match.trackId)];
      if (!youtubeUrl || !track) return null;
      return {
        youtubeUrl,
        metadata: {
          title: track.title,
          artist: track.artist,
          album: track.album,
          albumArtist: track.albumArtist || track.artist,
          year: track.year,
          genre: track.genre,
          track: track.trackNumber != null ? String(track.trackNumber) : "",
        },
        playlists: playlistsForTrack(library, selectedPlaylistIds, match.trackId),
      };
    })
    .filter(Boolean);
}

const EMPTY = {
  step: "upload",
  library: null,
  selectedPlaylistIds: new Set(),
  excludedIds: new Set(),
  matches: {},
  progress: null,
  busy: false,
  error: "",
};

export function useXmlImport({ onImported, onLog } = {}) {
  const [state, setState] = useState(EMPTY);
  const patch = useCallback((next) => setState((prev) => ({ ...prev, ...next })), []);

  const reset = useCallback(() => setState(EMPTY), []);

  const parseFile = useCallback(async (file) => {
    patch({ busy: true, error: "" });
    try {
      const xml = await file.text();
      const library = await parseLibrary(xml);
      // Pre-exclude songs already in the library so we don't re-download them.
      const excludedIds = new Set(
        Object.values(library.tracksById).filter((track) => track.existing).map((track) => track.id),
      );
      setState({ ...EMPTY, step: "select", library, excludedIds });
      onLog?.(`Loaded ${library.playlists.length} playlist(s) from the library file.`, "ok", "Import:");
    } catch (error) {
      patch({ busy: false, error: error.message });
    }
  }, [patch, onLog]);

  const togglePlaylist = useCallback((id) => {
    setState((prev) => {
      const next = new Set(prev.selectedPlaylistIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selectedPlaylistIds: next };
    });
  }, []);

  const toggleTrack = useCallback((trackId) => {
    setState((prev) => {
      const next = new Set(prev.excludedIds);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return { ...prev, excludedIds: next };
    });
  }, []);

  const runSearch = useCallback(async () => {
    const ids = selectedTrackIds(state.library, state.selectedPlaylistIds, state.excludedIds);
    if (!ids.length) {
      patch({ error: "Select at least one playlist with tracks to search." });
      return;
    }
    const tracks = ids.map((id) => state.library.tracksById[String(id)]);
    patch({ busy: true, error: "", progress: { done: 0, total: tracks.length }, matches: {} });

    const collected = {};
    let done = 0;
    try {
      for (const batch of chunk(tracks, SEARCH_BATCH)) {
        const payload = batch.map((track) => ({
          id: track.id, title: track.title, artist: track.artist, album: track.album, durationSec: track.durationSec,
        }));
        const { results } = await searchLibraryMatches(payload);
        results.forEach((result) => {
          collected[result.id] = { trackId: result.id, chosenIndex: 0, manualUrl: "", ...result };
        });
        done += batch.length;
        patch({ progress: { done, total: tracks.length }, matches: { ...collected } });
      }
      patch({ step: "review", busy: false, progress: null });
      onLog?.(`Found YouTube matches for ${Object.keys(collected).length} track(s).`, "ok", "Import:");
    } catch (error) {
      patch({ busy: false, progress: null, error: error.message });
    }
  }, [state.library, state.selectedPlaylistIds, state.excludedIds, patch, onLog]);

  const setMatchCandidate = useCallback((trackId, chosenIndex) => {
    setState((prev) => ({
      ...prev,
      matches: { ...prev.matches, [trackId]: { ...prev.matches[trackId], chosenIndex, manualUrl: "" } },
    }));
  }, []);

  const setManualUrl = useCallback((trackId, manualUrl) => {
    setState((prev) => ({
      ...prev,
      matches: { ...prev.matches, [trackId]: { ...prev.matches[trackId], manualUrl } },
    }));
  }, []);

  const dropMatch = useCallback((trackId) => {
    setState((prev) => {
      const matches = { ...prev.matches };
      delete matches[trackId];
      return { ...prev, matches };
    });
  }, []);

  const runImport = useCallback(async () => {
    const matches = buildImportMatches(state);
    if (!matches.length) {
      patch({ error: "No tracks have a YouTube match to import." });
      return;
    }
    patch({ busy: true, error: "" });
    try {
      const result = await importLibraryMatches(matches);
      reset();
      onImported?.(result);
    } catch (error) {
      patch({ busy: false, error: error.message });
    }
  }, [state, patch, reset, onImported]);

  const importMatches = useMemo(() => buildImportMatches(state), [state]);

  return {
    ...state,
    importCount: importMatches.length,
    actions: {
      parseFile, togglePlaylist, toggleTrack, runSearch,
      setMatchCandidate, setManualUrl, dropMatch, runImport, reset,
    },
  };
}
