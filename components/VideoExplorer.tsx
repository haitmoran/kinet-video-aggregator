"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { VideoCard } from "@/components/VideoCard";
import { categories, videos } from "@/data/videos";

type Theme = "light" | "dark";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2.4v2M12 19.6v2M21.6 12h-2M4.4 12h-2M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4M18.8 18.8l-1.4-1.4M6.6 6.6 5.2 5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function TvIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 21h6M12 18v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function columnCount(): number {
  const width = window.innerWidth;
  if (width < 480) return 1;
  if (width < 768) return 2;
  if (width < 1024) return 3;
  if (width < 1440) return 4;
  if (width < 1800) return 5;
  return 6;
}

export function VideoExplorer() {
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<Theme>("light");
  const [tvMode, setTvMode] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Trending");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    const savedTheme = document.documentElement.dataset.theme;
    setTheme(savedTheme === "dark" ? "dark" : "light");

    const savedTvMode = window.localStorage.getItem("kinet-tv") === "true";
    setTvMode(savedTvMode);
    document.documentElement.dataset.tv = String(savedTvMode);
  }, []);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  const filteredVideos = useMemo(() => {
    const matching = videos.filter((video) => {
      const matchesCategory = category === "All" || video.category === category;
      const haystack = `${video.title} ${video.creator} ${video.platform} ${video.category}`.toLowerCase();
      return matchesCategory && (!deferredQuery || haystack.includes(deferredQuery));
    });

    if (sort === "Newest") return [...matching].reverse();
    if (sort === "Shortest") {
      return [...matching].sort((a, b) => a.duration.localeCompare(b.duration));
    }

    return matching;
  }, [category, deferredQuery, sort]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [category, deferredQuery, sort]);

  const changeTheme = () => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("kinet-theme", nextTheme);
  };

  const changeTvMode = () => {
    const nextValue = !tvMode;
    setTvMode(nextValue);
    document.documentElement.dataset.tv = String(nextValue);
    window.localStorage.setItem("kinet-tv", String(nextValue));

    if (nextValue) {
      window.setTimeout(() => {
        const firstCard = gridRef.current?.querySelector<HTMLAnchorElement>(
          '[data-video-index="0"]',
        );
        firstCard?.focus();
      }, 0);
    }
  };

  const handleGridKeyDown = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number,
  ) => {
    if (!tvMode || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }

    const columns = columnCount();
    let target = index;

    if (event.key === "ArrowLeft" && index % columns !== 0) target = index - 1;
    if (event.key === "ArrowRight" && index % columns !== columns - 1) target = index + 1;
    if (event.key === "ArrowUp") target = index - columns;
    if (event.key === "ArrowDown") target = index + columns;

    target = Math.max(0, Math.min(filteredVideos.length - 1, target));
    if (target === index) return;

    event.preventDefault();
    setFocusedIndex(target);

    const nextCard = gridRef.current?.querySelector<HTMLAnchorElement>(
      `[data-video-index="${target}"]`,
    );
    nextCard?.focus();
    nextCard?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  return (
    <div className="site-frame">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Kinet home">
          <span className="brand__mark" aria-hidden="true">
            <span />
          </span>
          <span className="brand__word">kinet</span>
        </a>

        <nav className="primary-nav" aria-label="Primary navigation">
          <a className="is-active" href="#discover">Discover</a>
          <a href="#latest">Latest</a>
          <a href="#collections">Collections</a>
        </nav>

        <label className="nav-search" aria-label="Search videos">
          <SearchIcon />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={handleSearch}
            placeholder="Search stories, creators, topics"
          />
          <kbd>/</kbd>
        </label>

        <div className="nav-actions">
          <button
            className={`icon-button tv-button ${tvMode ? "is-active" : ""}`}
            type="button"
            onClick={changeTvMode}
            aria-pressed={tvMode}
            aria-label={tvMode ? "Exit TV mode" : "Enter TV mode"}
            title={tvMode ? "Exit TV mode" : "Enter TV mode"}
          >
            <TvIcon />
          </button>

          <button
            className="icon-button"
            type="button"
            onClick={changeTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>

          <button className="avatar" type="button" aria-label="Open profile">
            MH
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero" id="discover" aria-labelledby="hero-title">
          <div className="hero__eyebrow">
            <span className="live-dot" />
            One beautiful feed. Every platform.
          </div>
          <h1 id="hero-title">
            Find your next
            <br />
            <span>rabbit hole.</span>
          </h1>
          <p>
            Exceptional films, explainers, and documentaries from across the web—curated into one calm place.
          </p>
          <a className="hero__cta" href="#latest">
            Start exploring <ArrowIcon />
          </a>

          <div className="hero__note" aria-label="Preview instructions">
            <span className="hero__note-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="m8 5 11 7-11 7V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
            </span>
            <span><strong>Smart previews</strong> Hover, focus, or long-press any story.</span>
          </div>
        </section>

        <section className="catalog" id="latest" aria-labelledby="catalog-title">
          <div className="catalog__header">
            <div>
              <p className="section-kicker">Curated today</p>
              <h2 id="catalog-title">Trending across the web</h2>
            </div>

            <div className="catalog__tools">
              <span className="result-count">{filteredVideos.length} stories</span>
              <label className="sort-control">
                <span className="sr-only">Sort videos</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option>Trending</option>
                  <option>Newest</option>
                  <option>Shortest</option>
                </select>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>
            </div>
          </div>

          <div className="category-bar" role="toolbar" aria-label="Video categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "is-active" : ""}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          {filteredVideos.length > 0 ? (
            <div
              ref={gridRef}
              className="video-grid"
              onFocusCapture={(event) => {
                const card = (event.target as HTMLElement).closest<HTMLElement>("[data-video-index]");
                if (card) setFocusedIndex(Number(card.dataset.videoIndex));
              }}
            >
              {filteredVideos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  priority={index < 6}
                  tabIndex={tvMode ? (focusedIndex === index ? 0 : -1) : 0}
                  onKeyDown={(event) => handleGridKeyDown(event, index)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon"><SearchIcon /></span>
              <h3>No stories found</h3>
              <p>Try a broader search or choose another category.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="collections" id="collections" aria-labelledby="collections-title">
          <div className="collection-copy">
            <p className="section-kicker">Watch with intention</p>
            <h2 id="collections-title">Less scrolling.<br />More discovering.</h2>
            <p>Follow topics you care about and turn a noisy internet into a considered watchlist.</p>
          </div>

          <div className="collection-stack" aria-hidden="true">
            <div className="mini-card mini-card--one"><span>01</span><strong>Slow travel</strong><small>24 stories</small></div>
            <div className="mini-card mini-card--two"><span>02</span><strong>Designing tomorrow</strong><small>18 stories</small></div>
            <div className="mini-card mini-card--three"><span>03</span><strong>The curious mind</strong><small>31 stories</small></div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="brand brand--footer" aria-label="Kinet">
          <span className="brand__mark" aria-hidden="true"><span /></span>
          <span className="brand__word">kinet</span>
        </div>
        <p>A fast, focused prototype for video discovery.</p>
        <div className="footer__links">
          <a href="#top">About</a>
          <a href="#top">Sources</a>
          <a href="#top">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
