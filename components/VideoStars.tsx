"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEventHandler,
  type MouseEvent,
} from "react";
import { getStarsForVideo, type StarProfile } from "@/data/stars";
import { StarPortrait } from "@/components/StarPortrait";
import styles from "./VideoStars.module.css";

type VideoStarsProps = {
  videoId: string;
  videoTitle: string;
  videoIndex?: number;
  className?: string;
  tabIndex?: number;
  tabIndexes?: readonly [number, number];
  onStarKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
};

export function VideoStars({
  videoId,
  videoTitle,
  videoIndex,
  className,
  tabIndex = 0,
  tabIndexes,
  onStarKeyDown,
}: VideoStarsProps) {
  const stars = getStarsForVideo(videoId);
  const dialogId = useId();
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const profileLinkRef = useRef<HTMLAnchorElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const activeIndexRef = useRef(0);
  const [activeStar, setActiveStar] = useState<StarProfile | null>(null);

  const closeProfile = useCallback((restoreFocus = true) => {
    setActiveStar(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRefs.current[activeIndexRef.current]?.focus());
    }
  }, []);

  useEffect(() => {
    if (!activeStar) return;

    window.requestAnimationFrame(() => profileLinkRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeProfile();
        return;
      }

      if (["OK", "Select", "Accept"].includes(event.key)) {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.click();
        return;
      }

      if (["ArrowUp", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      if (["ArrowDown", "ArrowLeft"].includes(event.key)) {
        event.preventDefault();
        profileLinkRef.current?.focus();
        return;
      }

      if (event.key === "Tab") {
        const focusable = [profileLinkRef.current, closeButtonRef.current].filter(
          (element): element is HTMLAnchorElement | HTMLButtonElement => Boolean(element),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (dialogRef.current?.contains(target)) return;
      if (triggerRefs.current.some((trigger) => trigger?.contains(target))) return;
      closeProfile(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [activeStar, closeProfile]);

  const openProfile = (star: StarProfile, starIndex: number, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activeIndexRef.current = starIndex;
    setActiveStar(star);
  };

  const rootClassName = className ? `${styles.root} ${className}` : styles.root;

  return (
    <>
      <div className={rootClassName} role="group" aria-label={`Featured stars in ${videoTitle}`}>
        {stars.map((star, starIndex) => (
          <button
            key={star.slug}
            ref={(element) => { triggerRefs.current[starIndex] = element; }}
            className={styles.indicator}
            type="button"
            tabIndex={tabIndexes?.[starIndex] ?? tabIndex}
            aria-label={`Meet ${star.name}, ${star.role}`}
            aria-haspopup="dialog"
            aria-expanded={activeStar?.slug === star.slug}
            aria-controls={activeStar?.slug === star.slug ? dialogId : undefined}
            aria-keyshortcuts="Enter Space"
            data-card-action={`star-${starIndex}`}
            data-video-index={videoIndex}
            data-star-index={starIndex}
            onKeyDown={onStarKeyDown}
            onClick={(event) => openProfile(star, starIndex, event)}
          >
            <StarPortrait star={star} className={styles.indicatorPortrait} />
            <span className={styles.indicatorName}>{star.firstName}</span>
          </button>
        ))}
      </div>

      {activeStar && (
        <section
          ref={dialogRef}
          id={dialogId}
          className={styles.dialog}
          role="dialog"
          aria-labelledby={`${dialogId}-title`}
          aria-describedby={`${dialogId}-description`}
        >
          <button
            ref={closeButtonRef}
            className={styles.close}
            type="button"
            aria-label="Close star preview"
            onClick={() => closeProfile()}
            onKeyDown={(event) => {
              if (["OK", "Select", "Accept"].includes(event.key)) {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <Link
            ref={profileLinkRef}
            className={styles.profileLink}
            href={`/stars/${activeStar.slug}/`}
            onClick={() => closeProfile(false)}
            onKeyDown={(event) => {
              if (["OK", "Select", "Accept"].includes(event.key)) {
                event.preventDefault();
                event.currentTarget.click();
              }
            }}
          >
            <StarPortrait star={activeStar} className={styles.dialogPortrait} decorative={false} />
            <div className={styles.dialogCopy}>
              <span className={styles.prototype}>Featured star</span>
              <h2 id={`${dialogId}-title`}>{activeStar.name}</h2>
              <p className={styles.role}>{activeStar.role}</p>
              <p id={`${dialogId}-description`} className={styles.bio}>{activeStar.shortBio}</p>
              <span className={styles.cta}>
                View profile
                <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                  <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </Link>
        </section>
      )}
    </>
  );
}
