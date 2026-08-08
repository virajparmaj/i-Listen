/**
 * AppleScript sources for the Apple Music handoff.
 *
 * Convention (do not break it): user data NEVER gets interpolated into a script
 * body. Everything variable arrives through `on run argv`. Only fixed internal
 * constants — the iListen folder name and the legacy "iPod -" prefix — are
 * substituted here, and neither is user input.
 *
 * Field separator is US (0x1F) rather than tab, because track titles and album
 * names legitimately contain tabs far less often than they contain every other
 * punctuation mark, and US can never appear in a filesystem path or a tag.
 */

export const ILISTEN_FOLDER = "iListen";

/** Unit Separator, 0x1F. Must match parseResultLines in appleMusic.js. */
export const FIELD_SEP = "";

/**
 * Snapshot of one playlist, used to build the identity index before deciding
 * what to add and what to refresh.
 *
 * argv[0] = playlist name.
 * Emits per track: DATABASE_ID ␟ PERSISTENT_ID ␟ PATH ␟ TITLE ␟ ARTIST ␟ ALBUM
 * Returns the literal "NO_PLAYLIST" when the playlist does not exist yet.
 */
export const LIST_PLAYLIST_SCRIPT = `on run argv
  set plName to item 1 of argv
  set US to (character id 31)
  tell application "Music"
    if not (exists user playlist plName) then return "NO_PLAYLIST"
    set pl to (first user playlist whose name is plName)
    set n to 0
    try
      set n to (count of tracks of pl)
    end try
    if n is 0 then return ""
    set dbids to {}
    set pids to {}
    set pathList to {}
    set nameList to {}
    set artistList to {}
    set albumList to {}
    set bulkOk to true
    try
      set dbids to (get database ID of every track of pl)
      set pids to (get persistent ID of every track of pl)
      set nameList to (get name of every track of pl)
      set artistList to (get artist of every track of pl)
      set albumList to (get album of every track of pl)
      repeat with l in (get location of every track of pl)
        set lc to contents of l
        if lc is missing value then
          set end of pathList to ""
        else
          set end of pathList to (POSIX path of lc)
        end if
      end repeat
    on error
      set bulkOk to false
    end try
    if not bulkOk then
      set dbids to {}
      set pids to {}
      set pathList to {}
      set nameList to {}
      set artistList to {}
      set albumList to {}
      repeat with i from 1 to n
        set t to track i of pl
        set d to ""
        set pd to ""
        set lp to ""
        set nm to ""
        set ar to ""
        set al to ""
        try
          set d to ((database ID of t) as text)
        end try
        try
          set pd to (persistent ID of t)
        end try
        try
          set l to (location of t)
          if l is not missing value then set lp to (POSIX path of l)
        end try
        try
          set nm to (name of t as text)
        end try
        try
          set ar to (artist of t as text)
        end try
        try
          set al to (album of t as text)
        end try
        set end of dbids to d
        set end of pids to pd
        set end of pathList to lp
        set end of nameList to nm
        set end of artistList to ar
        set end of albumList to al
      end repeat
    end if
    set outLines to {}
    repeat with i from 1 to n
      set end of outLines to (((item i of dbids) as text) & US & (item i of pids) & US & (item i of pathList) & US & (item i of nameList) & US & (item i of artistList) & US & (item i of albumList))
    end repeat
    set AppleScript's text item delimiters to linefeed
    return outLines as text
  end tell
end run`;

/**
 * Add ordered POSIX paths to one playlist inside the iListen folder.
 *
 * argv[0] = playlist name, argv[1..] = POSIX paths.
 * Emits per file: STATUS ␟ REQUESTED_PATH ␟ DATABASE_ID ␟ PERSISTENT_ID ␟ ACTUAL_PATH ␟ REASON
 *
 * Two things here are load-bearing and were previously wrong:
 *  - ACTUAL_PATH is read back from the added track. Music copies files into its
 *    own Media folder by default, so the path it stores is not the path we asked
 *    for. Without recording it, the next handoff cannot recognise the track and
 *    appends a duplicate.
 *  - The SKIPPED branch returns the EXISTING track's identity. It used to return
 *    empty strings, which the caller then wrote over a perfectly good stored id.
 */
export const ADD_TO_PLAYLIST_SCRIPT = `on run argv
  set plName to item 1 of argv
  if (count of argv) < 2 then return ""
  set paths to rest of argv
  set US to (character id 31)
  set outLines to {}
  tell application "Music"
    if not (exists folder playlist "${ILISTEN_FOLDER}") then
      make new folder playlist with properties {name:"${ILISTEN_FOLDER}"}
    end if
    set iFolder to folder playlist "${ILISTEN_FOLDER}"
    if not (exists user playlist plName) then
      set newPl to make new user playlist with properties {name:plName}
      try
        move newPl to iFolder
      end try
    end if
    set pl to (first user playlist whose name is plName)

    set existing to {}
    set existDbids to {}
    set existPids to {}
    set n to 0
    try
      set n to (count of tracks of pl)
    end try
    if n > 0 then
      set bulkOk to true
      try
        set existDbids to (get database ID of every track of pl)
        set existPids to (get persistent ID of every track of pl)
        repeat with l in (get location of every track of pl)
          set lc to contents of l
          if lc is missing value then
            set end of existing to ""
          else
            set end of existing to (POSIX path of lc)
          end if
        end repeat
      on error
        set bulkOk to false
      end try
      if not bulkOk then
        set existing to {}
        set existDbids to {}
        set existPids to {}
        repeat with i from 1 to n
          set t to track i of pl
          set d to ""
          set pd to ""
          set lp to ""
          try
            set d to ((database ID of t) as text)
          end try
          try
            set pd to (persistent ID of t)
          end try
          try
            set l to (location of t)
            if l is not missing value then set lp to (POSIX path of l)
          end try
          set end of existDbids to d
          set end of existPids to pd
          set end of existing to lp
        end repeat
      end if
    end if

    repeat with raw in paths
      set p to raw as text
      set statusText to "FAILED"
      set dbid to ""
      set pid to ""
      set actualPath to ""
      set rsn to ""
      try
        set hit to 0
        considering case and diacriticals
          repeat with i from 1 to (count of existing)
            if (item i of existing) is p then
              set hit to i
              exit repeat
            end if
          end repeat
        end considering
        if hit > 0 then
          set statusText to "SKIPPED"
          set rsn to "duplicate"
          try
            set dbid to ((item hit of existDbids) as text)
          end try
          try
            set pid to (item hit of existPids)
          end try
          set actualPath to p
        else
          set addedTrack to (add (POSIX file p) to pl)
          set statusText to "ADDED"
          try
            set dbid to ((database ID of addedTrack) as text)
          end try
          try
            set pid to (persistent ID of addedTrack)
          end try
          try
            set loc2 to (location of addedTrack)
            if loc2 is not missing value then set actualPath to (POSIX path of loc2)
          end try
          if actualPath is "" then set actualPath to p
          set end of existing to actualPath
          set end of existDbids to dbid
          set end of existPids to pid
        end if
      on error e number nErr
        set rsn to (e & " [" & nErr & "]")
      end try
      set end of outLines to (statusText & US & p & US & dbid & US & pid & US & actualPath & US & rsn)
    end repeat
  end tell
  set AppleScript's text item delimiters to linefeed
  return outLines as text
end run`;

/**
 * Push current tags + artwork onto an existing Music track, and optionally
 * relink it to a new file path.
 *
 * argv: path, databaseId, persistentId, title, artist, album, albumArtist,
 *       year, track, disc, artworkPath, relinkPath
 * Emits: STATUS ␟ PATH ␟ DATABASE_ID ␟ PERSISTENT_ID ␟ ACTUAL_PATH ␟ REASON
 *
 * Lookup order is database ID first. The old script looked up by persistent ID
 * taken from `add ... to playlist`, which returns the playlist ENTRY rather than
 * the library track, so that lookup could never match and every refresh fell
 * through to a full linear scan of the library.
 */
export const REFRESH_TRACK_SCRIPT = `on run argv
  set p to item 1 of argv
  set dbid to item 2 of argv
  set pid to item 3 of argv
  set titleText to item 4 of argv
  set artistText to item 5 of argv
  set albumText to item 6 of argv
  set albumArtistText to item 7 of argv
  set yearText to item 8 of argv
  set trackText to item 9 of argv
  set discText to item 10 of argv
  set artPath to item 11 of argv
  set relinkPath to ""
  if (count of argv) > 11 then set relinkPath to item 12 of argv
  set knownPath to ""
  if (count of argv) > 12 then set knownPath to item 13 of argv
  set US to (character id 31)
  tell application "Music"
    set foundTrack to missing value
    if dbid is not "" then
      try
        set matches to (every file track of library playlist 1 whose database ID is (dbid as integer))
        if (count of matches) > 0 then set foundTrack to item 1 of matches
      end try
    end if
    if foundTrack is missing value and pid is not "" then
      try
        set matches to (every file track of library playlist 1 whose persistent ID is pid)
        if (count of matches) > 0 then set foundTrack to item 1 of matches
      end try
    end if
    if foundTrack is missing value then
      set allTracks to (every file track of library playlist 1)
      repeat with candidateTrack in allTracks
        set identityMatch to false
        if dbid is not "" then
          try
            if ((database ID of candidateTrack) as text) is dbid then set identityMatch to true
          end try
        end if
        if not identityMatch and pid is not "" then
          try
            if (persistent ID of candidateTrack) is pid then set identityMatch to true
          end try
        end if
        if not identityMatch then
          try
            set lc to location of candidateTrack
            if lc is not missing value then
              set candidatePath to POSIX path of lc
              considering case and diacriticals
                if candidatePath is p or (knownPath is not "" and candidatePath is knownPath) then set identityMatch to true
              end considering
            end if
          end try
        end if
        if identityMatch then
          set foundTrack to contents of candidateTrack
          exit repeat
        end if
      end repeat
    end if
    if foundTrack is missing value then return ("FAILED" & US & p & US & dbid & US & pid & US & "" & US & "track not found")

    if relinkPath is not "" then
      try
        set location of foundTrack to (POSIX file relinkPath)
      on error e number nErr
        return ("FAILED" & US & p & US & dbid & US & pid & US & "" & US & ("relink: " & e & " [" & nErr & "]"))
      end try
    end if

    if titleText is not "" then set name of foundTrack to titleText
    if artistText is not "" then set artist of foundTrack to artistText
    if albumText is not "" then set album of foundTrack to albumText
    if albumArtistText is not "" then set album artist of foundTrack to albumArtistText
    if yearText is not "" then
      try
        set year of foundTrack to (yearText as integer)
      end try
    end if
    if trackText is not "" then
      try
        set track number of foundTrack to (trackText as integer)
      end try
    end if
    if discText is not "" then
      try
        set disc number of foundTrack to (discText as integer)
      end try
    end if
    if artPath is not "" then
      try
        set data of artwork 1 of foundTrack to (read (POSIX file artPath) as picture)
      on error e number nErr
        return ("FAILED" & US & p & US & dbid & US & pid & US & "" & US & (e & " [" & nErr & "]"))
      end try
    end if

    set outDbid to dbid
    try
      set outDbid to ((database ID of foundTrack) as text)
    end try
    set outPid to pid
    try
      set outPid to (persistent ID of foundTrack)
    end try
    set actualPath to ""
    try
      set l to (location of foundTrack)
      if l is not missing value then set actualPath to (POSIX path of l)
    end try
    return ("UPDATED" & US & p & US & outDbid & US & outPid & US & actualPath & US & "")
  end tell
end run`;

/**
 * Inventory every user playlist.
 *
 * Emits: NAME ␟ PARENT ␟ SPECIAL_KIND ␟ SMART ␟ TRACK_COUNT ␟ NON_FILE_COUNT
 *
 * NON_FILE_COUNT is the number of tracks that are not `file track` — i.e. Apple
 * Music catalog rows, which stop playing when a subscription lapses.
 *
 * Note the honest limit: which playlists Finder has ticked for a device is NOT
 * exposed to scripting. This can only report what exists and how big it is.
 */
export const PREFLIGHT_SCRIPT = `tell application "Music"
  set US to (character id 31)
  set outLines to {}
  repeat with p in (every user playlist)
    set nm to ""
    try
      set nm to (name of p as text)
    end try
    set parentName to ""
    try
      set parentName to (name of (parent of p) as text)
    end try
    set kindText to ""
    try
      set kindText to ((special kind of p) as text)
    end try
    set smartText to "false"
    try
      set smartText to ((smart of p) as text)
    end try
    set total to 0
    try
      set total to (count of tracks of p)
    end try
    set nonFile to 0
    try
      set nonFile to total - (count of file tracks of p)
    end try
    set end of outLines to (nm & US & parentName & US & kindText & US & smartText & US & (total as text) & US & (nonFile as text))
  end repeat
  set AppleScript's text item delimiters to linefeed
  return outLines as text
end tell`;

/**
 * Remove specific entries from a user playlist by 1-based index.
 *
 * argv[0] = playlist name, argv[1..] = indices, which the caller MUST supply in
 * descending order (deleting shifts every later index down).
 *
 * Safety: this only ever removes playlist ENTRIES. `delete t` where t is a track
 * of a user playlist removes the membership; removing from the library would
 * require `delete track i of library playlist 1`, which this never does. It also
 * refuses smart and special playlists outright.
 *
 * Emits: "OK" ␟ removedCount, or "ABORT" ␟ reason.
 */
export const RECONCILE_PLAYLIST_SCRIPT = `on run argv
  set plName to item 1 of argv
  set US to (character id 31)
  if (count of argv) < 2 then return ("ABORT" & US & "no indices supplied")
  set idxList to rest of argv
  tell application "Music"
    if not (exists user playlist plName) then return ("ABORT" & US & "playlist missing")
    set pl to (first user playlist whose name is plName)
    try
      if (smart of pl) then return ("ABORT" & US & "smart playlist")
    end try
    try
      if (special kind of pl) is not none then return ("ABORT" & US & "special playlist")
    end try
    set total to (count of tracks of pl)
    if (count of idxList) is greater than or equal to total then return ("ABORT" & US & "refusing to empty the playlist")
    set removedCount to 0
    repeat with rawIdx in idxList
      set i to (rawIdx as integer)
      if i > 0 and i is less than or equal to (count of tracks of pl) then
        try
          delete track i of pl
          set removedCount to removedCount + 1
        end try
      end if
    end repeat
    return ("OK" & US & (removedCount as text))
  end tell
end run`;

/**
 * Delete legacy auto-generated "iPod - ..." playlists.
 *
 * The prefix is a fixed legacy literal, never user data, so interpolating it is
 * safe. The smart/special filter matters: `folder playlist` inherits from
 * `user playlist`, so a FOLDER named "iPod - ..." was previously in the delete
 * set and would have taken its contents with it.
 */
export const CLEAN_STALE_PLAYLISTS_SCRIPT = `tell application "Music"
  set doomed to {}
  repeat with p in (every user playlist whose name starts with "iPod -")
    try
      if (special kind of p) is none and not (smart of p) and (class of p) is user playlist then
        set end of doomed to (contents of p)
      end if
    end try
  end repeat
  set removedNames to {}
  repeat with p in doomed
    try
      set nm to (name of p as text)
      delete p
      set end of removedNames to nm
    end try
  end repeat
  set AppleScript's text item delimiters to linefeed
  return removedNames as text
end tell`;
