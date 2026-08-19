"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { VideoItem } from "@/data/videos";

type Intent = "hover" | "focus" | "press";
type VisibilityCallback = (visible: boolean) => void;

const callbacks = new WeakMap<Element, VisibilityCallback>();
let observer: IntersectionObserver | null = null;
let observerTargets = 0;

function observeElement(
  element: Element,
  callback: VisibilityCallback,
): () => void {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          callbacks.get(entry.target)?.(entry.isIntersecting);
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.01 },
    );
  }

  callbacks.set(element, callback);
  observer.observe(element);
  observerTargets += 1;

  let active = true;

  return () => {
    if (!active) return;
    active = false;
    observer?.unobserve(element);
    callbacks.delete(element);
    observerTargets = Math.max(0, observerTargets - 1);

    if (observerTargets === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}

function previewIsAllowed(): boolean {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;

  return (
    !connection?.saveData &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type VideoCardProps = {
  video: VideoItem;
  index: number;
  priority?: boolean;
  tabIndex?: number;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
};

export function VideoCard({
  video,
  index,
  priority = false,
  tabIndex = 0,
  onKeyDown,
}: VideoCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const intents = useRef(new Set<Intent>());
  const longPressTimer = useRef<number | null>(null);
  const lastTouchAt = useRef(0);
  const suppressClick = useRef(false);

  const [hasEnteredViewport, setHasEnteredViewport] = useState(priority);
  const [isInViewport, setIsInViewport] = useState(priority);
  const [hasIntent, setHasIntent] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const addIntent = useCallback(
    (intent: Intent): boolean => {
      if (!video.preview || previewFailed || !previewIsAllowed()) return false;

      intents.current.add(intent);
      setHasIntent(true);
      return true;
    },
    [previewFailed, video.preview],
  );

  const removeIntent = useCallback((intent: Intent) => {
    intents.current.delete(intent);
    const active = intents.current.size > 0;
    setHasIntent(active);
    if (!active) setPreviewReady(false);
  }, []);

  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;

    return observeElement(element, (visible) => {
      setIsInViewport(visible);

      if (visible) {
        setHasEnteredViewport(true);
      } else {
        intents.current.clear();
        setHasIntent(false);
        setPreviewReady(false);
      }
    });
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const handlePointerEnter = (
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      addIntent("hover");
    }
  };

  const handlePointerLeave = (
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    clearLongPress();
    removeIntent("hover");
    if (event.pointerType === "touch") removeIntent("press");
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    if (event.pointerType !== "touch") return;

    lastTouchAt.current = Date.now();
    suppressClick.current = false;
    clearLongPress();

    longPressTimer.current = window.setTimeout(() => {
      suppressClick.current = addIntent("press");
    }, 440);
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    if (event.pointerType !== "touch") return;
    clearLongPress();
    removeIntent("press");
  };

  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!suppressClick.current) return;
    event.preventDefault();
    suppressClick.current = false;
  };

  const mountPreview = hasIntent && isInViewport && !previewFailed;

  return (
    <a
      ref={cardRef}
      className="video-card"
      href={video.href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      tabIndex={tabIndex}
      data-video-index={index}
      data-preview={previewReady ? "ready" : "idle"}
      style={{ "--card-accent": video.accent } as React.CSSProperties}
      aria-label={`${video.title}. ${video.creator} on ${video.platform}. ${video.views}. Duration ${video.duration}.`}
      onKeyDown={onKeyDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        clearLongPress();
        removeIntent("press");
        suppressClick.current = false;
      }}
      onFocus={() => {
        if (Date.now() - lastTouchAt.current > 750) addIntent("focus");
      }}
      onBlur={() => removeIntent("focus")}
      onContextMenu={(event) => {
        if (suppressClick.current) event.preventDefault();
      }}
      onClick={handleClick}
    >
      <div className="video-card__media">
        {hasEnteredViewport ? (
          <img
            className={`video-card__image ${previewReady ? "is-hidden" : ""}`}
            src={video.thumbnail}
            width={640}
            height={360}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "low"}
            decoding="async"
            draggable={false}
          />
        ) : (
          <span className="video-card__placeholder" aria-hidden="true" />
        )}

        {mountPreview && (
          <video
            className={`video-card__preview ${previewReady ? "is-ready" : ""}`}
            muted
            loop
            playsInline
            autoPlay
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
            onCanPlay={(event) => {
              void event.currentTarget.play().catch(() => {
                setPreviewReady(false);
              });
            }}
            onPlaying={() => setPreviewReady(true)}
            onError={() => {
              intents.current.clear();
              setHasIntent(false);
              setPreviewReady(false);
              setPreviewFailed(true);
            }}
          >
            <source src={video.preview} type="video/webm" />
          </video>
        )}

        <span className="video-card__shade" aria-hidden="true" />

        <span className="video-card__play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M8 5.4v13.2L18.5 12 8 5.4Z" />
          </svg>
        </span>

        <span className="video-card__duration" aria-hidden="true">
          {video.duration}
        </span>

        <span className="video-card__category" aria-hidden="true">
          {video.category}
        </span>
      </div>

      <div className="video-card__body">
        <div className={`platform-mark platform-mark--${video.platform.toLowerCase()}`}>
          {video.platform === "YouTube" ? (
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
              <path d="M20.2 7.1a2.7 2.7 0 0 0-1.9-1.9C16.7 4.8 12 4.8 12 4.8s-4.7 0-6.3.4a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 3.4 12c0 1.6.1 3.2.4 4.9a2.7 2.7 0 0 0 1.9 1.9c1.6.4 6.3.4 6.3.4s4.7 0 6.3-.4a2.7 2.7 0 0 0 1.9-1.9c.3-1.6.4-3.3.4-4.9s-.1-3.2-.4-4.9ZM10.2 15.1V8.9l5.4 3.1-5.4 3.1Z" />
            </svg>
          ) : (
            <span>{video.platform === "Vimeo" ? "v" : "d"}</span>
          )}
        </div>

        <div className="video-card__copy">
          <h2 className="video-card__title">{video.title}</h2>
          <p className="video-card__creator">{video.creator}</p>
          <p className="video-card__meta">
            <span>{video.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{video.views}</span>
            <span aria-hidden="true">·</span>
            <span>{video.age}</span>
          </p>
        </div>

        <span className="video-card__more" aria-hidden="true">•••</span>
      </div>
    </a>
  );
}
