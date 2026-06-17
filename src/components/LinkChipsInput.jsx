import React from "react";
import { Icon } from "./ui/Icon.jsx";
import { extractYouTubeLinks, isYouTubeUrl, mergeLinks, linkLabel } from "../utils/links.js";

/**
 * Compact, space-efficient multi-link entry. Pasted/typed YouTube links become
 * removable chips inside a capped, internally-scrolling field — same footprint
 * as a small textarea, but tidy and de-duplicated.
 *
 * @param {{ value: string[], onChange: (links: string[]) => void, inputId?: string, placeholder?: string }} props
 */
export function LinkChipsInput({ value = [], onChange, inputId, placeholder = "Paste YouTube links — one or many" }) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef(null);

  const addFromText = (text) => {
    const incoming = extractYouTubeLinks(text);
    if (!incoming.length) return false;
    onChange(mergeLinks(value, incoming));
    return true;
  };

  const onPaste = (e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (extractYouTubeLinks(text).length) {
      e.preventDefault();
      addFromText(text);
      setDraft("");
    }
  };

  const commitDraft = () => {
    if (addFromText(draft)) setDraft("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && !draft && value.length) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  const removeChip = (url) => {
    onChange(value.filter((link) => link !== url));
    inputRef.current?.focus();
  };

  const draftValid = isYouTubeUrl(draft);

  return (
    <div
      className="il-chips-field il-scroll"
      onClick={() => inputRef.current?.focus()}
      role="group"
      aria-label="YouTube links"
    >
      {value.map((url) => (
        <span key={url} className="il-chip" title={url}>
          <span className="il-chip-label">{linkLabel(url)}</span>
          <button
            type="button"
            className="il-chip-remove"
            aria-label={`Remove ${linkLabel(url)}`}
            onClick={(e) => {
              e.stopPropagation();
              removeChip(url);
            }}
          >
            <Icon name="close" size={8} color="var(--text-lcd)" emboss={false} />
          </button>
        </span>
      ))}
      <input
        id={inputId}
        ref={inputRef}
        className="il-chip-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
        spellCheck={false}
        autoComplete="off"
        placeholder={value.length ? "" : placeholder}
        aria-invalid={draft.length > 0 && !draftValid}
      />
    </div>
  );
}
