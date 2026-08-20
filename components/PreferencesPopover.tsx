"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_DISPLAY_PREFERENCES,
  type DisplayPreferences,
  type TextSizePreference,
  type VideoMetadataPreferences,
} from "@/lib/displayPreferences";
import styles from "./PreferencesPopover.module.css";

type PreferencesPopoverProps = {
  preferences: DisplayPreferences;
  onChange: (preferences: DisplayPreferences) => void;
};

const metadataOptions: Array<{ key: keyof VideoMetadataPreferences; label: string }> = [
  { key: "creator", label: "Creator" },
  { key: "source", label: "Source platform" },
  { key: "likes", label: "Like count" },
  { key: "year", label: "Release year" },
  { key: "duration", label: "Duration badge" },
];

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
      <path d="M5 7h9M18 7h1M5 17h2M11 17h8M14 4v6M8 14v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PreferencesPopover({ preferences, onChange }: PreferencesPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => closeRef.current?.focus(), 0);

    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const updateMetadata = (key: keyof VideoMetadataPreferences) => {
    onChange({
      ...preferences,
      metadata: {
        ...preferences.metadata,
        [key]: !preferences.metadata[key],
      },
    });
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        className={styles.trigger}
        type="button"
        aria-expanded={open}
        aria-controls="display-preferences"
        onClick={() => setOpen((current) => !current)}
      >
        <SettingsIcon />
        <span>Preferences</span>
      </button>

      {open && (
        <section
          className={styles.popover}
          id="display-preferences"
          role="dialog"
          aria-label="Display preferences"
        >
          <header className={styles.header}>
            <div>
              <p>Display</p>
              <h2>Preferences</h2>
            </div>
            <button ref={closeRef} type="button" aria-label="Close preferences" onClick={() => setOpen(false)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <fieldset className={styles.group}>
            <legend>Videos per row</legend>
            <p>Applied on desktop and TV screens.</p>
            <div className={styles.segmented}>
              {([3, 4, 5, 6] as const).map((columns) => (
                <button
                  key={columns}
                  type="button"
                  className={preferences.columns === columns ? styles.selected : ""}
                  aria-pressed={preferences.columns === columns}
                  onClick={() => onChange({ ...preferences, columns })}
                >
                  {columns}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Text size</legend>
            <div className={styles.segmented}>
              {(["small", "default", "large"] as TextSizePreference[]).map((textSize) => (
                <button
                  key={textSize}
                  type="button"
                  className={preferences.textSize === textSize ? styles.selected : ""}
                  aria-pressed={preferences.textSize === textSize}
                  onClick={() => onChange({ ...preferences, textSize })}
                >
                  {textSize === "default" ? "Standard" : `${textSize[0].toUpperCase()}${textSize.slice(1)}`}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Video metadata</legend>
            <p>Choose the details shown on every thumbnail.</p>
            <div className={styles.toggles}>
              {metadataOptions.map((option) => (
                <label key={option.key}>
                  <span>{option.label}</span>
                  <input
                    type="checkbox"
                    checked={preferences.metadata[option.key]}
                    onChange={() => updateMetadata(option.key)}
                  />
                  <span className={styles.switch} aria-hidden="true" />
                </label>
              ))}
            </div>
          </fieldset>

          <button
            className={styles.reset}
            type="button"
            onClick={() => onChange(DEFAULT_DISPLAY_PREFERENCES)}
          >
            Restore defaults
          </button>
        </section>
      )}
    </div>
  );
}
