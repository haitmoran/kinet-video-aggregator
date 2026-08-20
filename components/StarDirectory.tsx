"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { StarPortrait } from "@/components/StarPortrait";
import type { StarProfile } from "@/data/stars";
import type { StarCardPreferences } from "@/lib/displayPreferences";
import styles from "./StarDirectory.module.css";

export type StarDirectoryEntry = {
  profile: StarProfile;
  appearances: number;
  totalLikes: number;
  newestYear: number;
};

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const remoteKeys: Record<number, string> = {
  13: "Enter",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
};

function directoryColumns(tvMode: boolean, preferredColumns: number): number {
  if (tvMode || window.innerWidth >= 1024) return preferredColumns;
  if (window.innerWidth >= 576) return 2;
  return 1;
}

type StarDirectoryProps = {
  entries: StarDirectoryEntry[];
  tvMode: boolean;
  columns: number;
  details: StarCardPreferences;
};

export function StarDirectory({ entries, tvMode, columns, details }: StarDirectoryProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const key = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "OK", "Select", "Accept"].includes(event.key)
      ? event.key
      : remoteKeys[event.keyCode] ?? event.key;

    if (["OK", "Select", "Accept"].includes(key) || (key === "Enter" && event.key !== "Enter")) {
      event.preventDefault();
      event.currentTarget.click();
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;

    const activeColumns = directoryColumns(tvMode, columns);
    let target = index;
    if (key === "ArrowLeft" && index % activeColumns !== 0) target -= 1;
    if (key === "ArrowRight" && index % activeColumns !== activeColumns - 1) target += 1;
    if (key === "ArrowUp") target -= activeColumns;
    if (key === "ArrowDown") target += activeColumns;
    if (target < 0 && key === "ArrowUp") {
      event.preventDefault();
      document.querySelector<HTMLElement>(".filter-trigger")?.focus();
      return;
    }
    target = Math.max(0, Math.min(entries.length - 1, target));
    if (target === index) return;

    event.preventDefault();
    setFocusedIndex(target);
    const nextCard = gridRef.current?.querySelector<HTMLAnchorElement>(`[data-star-card-index="${target}"]`);
    nextCard?.focus();
    nextCard?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };

  return (
    <div ref={gridRef} className={styles.grid} role="list" aria-label="Featured stars">
      {entries.map(({ profile, appearances, totalLikes, newestYear }, index) => (
        <Link
          key={profile.slug}
          className={styles.card}
          href={`/stars/${profile.slug}/`}
          role="listitem"
          tabIndex={tvMode ? (focusedIndex === index ? 0 : -1) : 0}
          data-star-card-index={index}
          aria-label={`${profile.name}, ${profile.role}, ${profile.location}`}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter"
          onFocus={() => setFocusedIndex(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          <StarPortrait star={profile} className={styles.portrait} decorative={false} />
          <div className={styles.shade} aria-hidden="true" />
          <span className={styles.prototype}>Demo profile</span>
          <div className={styles.copy}>
            {details.role && <p>{profile.role}</p>}
            {details.name && <h2>{profile.name}</h2>}
            {details.location && <span>{profile.location}</span>}
            {(details.appearances || details.likes || details.latest) && (
              <div className={styles.meta}>
                {details.appearances && <span>{appearances} stories</span>}
                {details.likes && <span>{compactNumber.format(totalLikes)} likes</span>}
                {details.latest && <span>Latest {newestYear}</span>}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
