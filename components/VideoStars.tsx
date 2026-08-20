"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
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

type PopoverPlacement = "right" | "left" | "below" | "above";

type PopoverPosition = {
  top: number;
  left: number;
  maxHeight: number;
  placement: PopoverPlacement;
};

function positionOutsideCard(
  trigger: HTMLButtonElement,
  measuredHeight = 290,
): PopoverPosition {
  const card = trigger.closest<HTMLElement>(".video-card");
  const anchor = card?.getBoundingClientRect() ?? trigger.getBoundingClientRect();
  const gutter = 12;
  const gap = 12;
  const dialogWidth = Math.min(380, window.innerWidth - gutter * 2);
  const viewportHeight = window.innerHeight;
  const availableRight = window.innerWidth - anchor.right - gap - gutter;
  const availableLeft = anchor.left - gap - gutter;
  const maximumHeight = Math.min(520, viewportHeight - gutter * 2);
  const dialogHeight = Math.min(measuredHeight, maximumHeight);

  if (availableRight >= dialogWidth) {
    return {
      top: Math.max(gutter, Math.min(anchor.top, viewportHeight - dialogHeight - gutter)),
      left: anchor.right + gap,
      maxHeight: maximumHeight,
      placement: "right",
    };
  }

  if (availableLeft >= dialogWidth) {
    return {
      top: Math.max(gutter, Math.min(anchor.top, viewportHeight - dialogHeight - gutter)),
      left: anchor.left - dialogWidth - gap,
      maxHeight: maximumHeight,
      placement: "left",
    };
  }

  const availableBelow = Math.max(0, viewportHeight - anchor.bottom - gap - gutter);
  const availableAbove = Math.max(0, anchor.top - gap - gutter);
  const left = Math.max(
    gutter,
    Math.min(anchor.left, window.innerWidth - dialogWidth - gutter),
  );

  if (availableBelow >= availableAbove) {
    return {
      top: anchor.bottom + gap,
      left,
      maxHeight: Math.max(1, availableBelow),
      placement: "below",
    };
  }

  const maxHeight = Math.max(1, availableAbove);
  return {
    top: Math.max(gutter, anchor.top - gap - Math.min(dialogHeight, maxHeight)),
    left,
    maxHeight,
    placement: "above",
  };
}

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
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition>({
    top: 12,
    left: 12,
    maxHeight: 520,
    placement: "right",
  });

  const updatePopoverPosition = useCallback(() => {
    const trigger = triggerRefs.current[activeIndexRef.current];
    if (!trigger) return;

    setPopoverPosition(
      positionOutsideCard(trigger, dialogRef.current?.offsetHeight ?? 290),
    );
  }, []);

  const closeProfile = useCallback((restoreFocus = true) => {
    setActiveStar(null);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRefs.current[activeIndexRef.current]?.focus());
    }
  }, []);

  useEffect(() => {
    if (!activeStar) return;

    updatePopoverPosition();
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
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsidePointer);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [activeStar, closeProfile, updatePopoverPosition]);

  const openProfile = (star: StarProfile, starIndex: number, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    activeIndexRef.current = starIndex;
    setPopoverPosition(positionOutsideCard(event.currentTarget));
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

      {activeStar && typeof document !== "undefined" && createPortal(
        <div className={styles.popoverLayer}>
          <section
            ref={dialogRef}
            id={dialogId}
            className={styles.dialog}
            data-placement={popoverPosition.placement}
            role="dialog"
            aria-labelledby={`${dialogId}-title`}
            aria-describedby={`${dialogId}-description`}
            style={{
              "--popover-top": `${popoverPosition.top}px`,
              "--popover-left": `${popoverPosition.left}px`,
              "--popover-max-height": `${popoverPosition.maxHeight}px`,
            } as CSSProperties}
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
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
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
                <span className={styles.prototype}>Prototype profile</span>
                <h2 id={`${dialogId}-title`}>{activeStar.name}</h2>
                <p className={styles.role}>{activeStar.role}</p>
                <p id={`${dialogId}-description`} className={styles.bio}>{activeStar.shortBio}</p>
                <span className={styles.cta}>
                  View full profile
                  <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                    <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
            </Link>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
