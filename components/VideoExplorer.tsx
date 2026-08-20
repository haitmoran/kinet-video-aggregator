"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { AuthDialog, type AuthMode } from "@/components/AuthDialog";
import { VideoCard } from "@/components/VideoCard";
import { categories, videos } from "@/data/videos";
import {
  getLikedVideoIds,
  getSession,
  saveLikedVideoIds,
  signOut,
  type SessionUser,
} from "@/lib/localAuth";

type Theme = "light" | "dark";
type MainTab = "Trending" | "Latest" | "Categories" | "Stars";

const PAGE_SIZE = 24;
const mainTabs: MainTab[] = ["Trending", "Latest", "Categories", "Stars"];

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
  const catalogRef = useRef<HTMLElement>(null);
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<Theme>("light");
  const [tvMode, setTvMode] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("Trending");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Trending");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [likedVideoIds, setLikedVideoIds] = useState<Set<string>>(new Set());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const savedTvMode = window.localStorage.getItem("kinet-tv") === "true";
    setTvMode(savedTvMode);
    document.documentElement.dataset.tv = String(savedTvMode);

    const session = getSession();
    setCurrentUser(session);
    if (session) setLikedVideoIds(getLikedVideoIds(session.normalizedUsername));
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [accountMenuOpen]);

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
      const matchesStars =
        activeTab !== "Stars" || Boolean(currentUser && likedVideoIds.has(video.id));
      const haystack = `${video.title} ${video.creator} ${video.platform} ${video.category}`.toLowerCase();
      return matchesCategory && matchesStars && (!deferredQuery || haystack.includes(deferredQuery));
    });

    if (sort === "Newest") return [...matching].reverse();
    if (sort === "Shortest") {
      return [...matching].sort((a, b) => a.duration.localeCompare(b.duration));
    }
    return matching;
  }, [activeTab, category, currentUser, deferredQuery, likedVideoIds, sort]);

  const visibleVideos = useMemo(
    () => filteredVideos.slice(0, visibleCount),
    [filteredVideos, visibleCount],
  );
  const hasMore = visibleCount < filteredVideos.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setFocusedIndex(0);
  }, [activeTab, category, deferredQuery, sort]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore) return;

    const loadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredVideos.length));
      },
      { root: null, rootMargin: "800px 0px", threshold: 0 },
    );

    loadObserver.observe(sentinel);
    return () => loadObserver.disconnect();
  }, [filteredVideos.length, hasMore]);

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
        gridRef.current?.querySelector<HTMLAnchorElement>('[data-video-index="0"]')?.focus();
      }, 0);
    }
  };

  const selectTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === "Trending") {
      setSort("Trending");
      setCategory("All");
    }
    if (tab === "Latest") {
      setSort("Newest");
      setCategory("All");
    }
    if (tab === "Categories") {
      window.setTimeout(() => categoryBarRef.current?.scrollIntoView({ block: "center" }), 0);
    }
    if (tab === "Stars") {
      setCategory("All");
      setSort("Trending");
    }
    catalogRef.current?.scrollIntoView({ block: "start" });
  };

  const openAuth = (mode: AuthMode, pendingVideoId: string | null = null) => {
    setAuthMode(mode);
    setPendingLikeId(pendingVideoId);
    setAuthOpen(true);
    setAccountMenuOpen(false);
  };

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setPendingLikeId(null);
  }, []);

  const handleAuthenticated = (user: SessionUser) => {
    const nextLikes = getLikedVideoIds(user.normalizedUsername);
    if (pendingLikeId) {
      nextLikes.add(pendingLikeId);
      saveLikedVideoIds(user.normalizedUsername, nextLikes);
    }
    setCurrentUser(user);
    setLikedVideoIds(new Set(nextLikes));
  };

  const toggleLike = (videoId: string) => {
    if (!currentUser) {
      openAuth("login", videoId);
      return;
    }

    const nextLikes = new Set(likedVideoIds);
    if (nextLikes.has(videoId)) nextLikes.delete(videoId);
    else nextLikes.add(videoId);
    saveLikedVideoIds(currentUser.normalizedUsername, nextLikes);
    setLikedVideoIds(nextLikes);
  };

  const handleSignOut = () => {
    signOut();
    setCurrentUser(null);
    setLikedVideoIds(new Set());
    setAccountMenuOpen(false);
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
    if (event.key === "ArrowDown" && index + columns >= visibleVideos.length && hasMore) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredVideos.length));
    }
    if (event.key === "ArrowLeft" && index % columns !== 0) target = index - 1;
    if (event.key === "ArrowRight" && index % columns !== columns - 1) target = index + 1;
    if (event.key === "ArrowUp") target = index - columns;
    if (event.key === "ArrowDown") target = index + columns;

    target = Math.max(0, Math.min(visibleVideos.length - 1, target));
    if (target === index) return;

    event.preventDefault();
    setFocusedIndex(target);
    const nextCard = gridRef.current?.querySelector<HTMLAnchorElement>(
      `[data-video-index="${target}"]`,
    );
    nextCard?.focus();
    nextCard?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };

  const title =
    activeTab === "Latest"
      ? "The latest stories"
      : activeTab === "Categories"
        ? category === "All"
          ? "Browse every category"
          : category
        : activeTab === "Stars"
          ? currentUser
            ? "Your liked videos"
            : "Your Stars collection"
          : "Trending across the web";

  return (
    <div className="site-frame">
      <header className="topbar">
        <a className="brand" href="#catalog" aria-label="Kinet home">
          <span className="brand__mark" aria-hidden="true"><span /></span>
          <span className="brand__word">kinet</span>
        </a>

        <nav className="primary-nav" aria-label="Browse videos">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "is-active" : ""}
              aria-pressed={activeTab === tab}
              onClick={() => selectTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        <label className="nav-search" aria-label="Search videos">
          <SearchIcon />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
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

          {currentUser ? (
            <div ref={accountRef} className="account-control">
              <button
                className="account-button"
                type="button"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="avatar" aria-hidden="true">
                  {currentUser.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="account-button__name">{currentUser.username}</span>
              </button>

              {accountMenuOpen && (
                <div className="account-menu" role="menu">
                  <div className="account-menu__identity">
                    <strong>@{currentUser.username}</strong>
                    <span>{likedVideoIds.size} liked videos</span>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      selectTab("Stars");
                      setAccountMenuOpen(false);
                    }}
                  >
                    Open Stars
                  </button>
                  <button type="button" role="menuitem" onClick={() => openAuth("change")}>Change password</button>
                  <button className="is-danger" type="button" role="menuitem" onClick={handleSignOut}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="guest-actions">
              <button className="sign-in-button" type="button" onClick={() => openAuth("login")}>Sign in</button>
              <button className="register-button" type="button" onClick={() => openAuth("register")}>Register</button>
            </div>
          )}
        </div>
      </header>

      <main id="top">
        <section ref={catalogRef} className="catalog" id="catalog" aria-labelledby="catalog-title">
          <div className="catalog__header">
            <div>
              <p className="section-kicker">{activeTab}</p>
              <h1 id="catalog-title">{title}</h1>
            </div>
            <div className="catalog__tools">
              <span className="result-count">
                {visibleVideos.length} of {filteredVideos.length} stories
              </span>
              <label className="sort-control">
                <span className="sr-only">Sort videos</span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    if (event.target.value === "Newest") setActiveTab("Latest");
                  }}
                >
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

          <div ref={categoryBarRef} className="category-bar" role="toolbar" aria-label="Video categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "is-active" : ""}
                aria-pressed={category === item}
                onClick={() => {
                  setCategory(item);
                  setActiveTab("Categories");
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {activeTab === "Stars" && !currentUser ? (
            <div className="auth-gate">
              <span className="auth-gate__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                  <path d="M12 20.3 4.2 12.8A4.8 4.8 0 0 1 11 6l1 1 1-1a4.8 4.8 0 0 1 6.8 6.8L12 20.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              </span>
              <h2>Keep every favorite in one place</h2>
              <p>Register or sign in to like videos and see them here whenever you return.</p>
              <div className="auth-gate__actions">
                <button type="button" onClick={() => openAuth("register")}>Register</button>
                <button type="button" onClick={() => openAuth("login")}>Sign in</button>
              </div>
            </div>
          ) : visibleVideos.length > 0 ? (
            <>
              <div
                ref={gridRef}
                className="video-grid"
                onFocusCapture={(event) => {
                  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-video-index]");
                  if (card) setFocusedIndex(Number(card.dataset.videoIndex));
                }}
              >
                {visibleVideos.map((video, index) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    index={index}
                    liked={likedVideoIds.has(video.id)}
                    onToggleLike={() => toggleLike(video.id)}
                    priority={index < 6}
                    tabIndex={tvMode ? (focusedIndex === index ? 0 : -1) : 0}
                    onKeyDown={(event) => handleGridKeyDown(event, index)}
                  />
                ))}
              </div>

              <div ref={loadMoreRef} className="auto-loader" aria-live="polite">
                {hasMore ? (
                  <>
                    <span className="auto-loader__spinner" aria-hidden="true" />
                    <span>More stories load automatically as you scroll.</span>
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleCount((count) =>
                          Math.min(count + PAGE_SIZE, filteredVideos.length),
                        )
                      }
                    >
                      Load more
                    </button>
                  </>
                ) : (
                  <span>You’ve reached all {filteredVideos.length} stories.</span>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon"><SearchIcon /></span>
              <h2>{activeTab === "Stars" ? "No liked videos yet" : "No stories found"}</h2>
              <p>
                {activeTab === "Stars"
                  ? "Tap the heart on any video to save it here."
                  : "Try a broader search or choose another category."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                  setActiveTab("Trending");
                }}
              >
                {activeTab === "Stars" ? "Explore videos" : "Clear filters"}
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="brand brand--footer" aria-label="Kinet">
          <span className="brand__mark" aria-hidden="true"><span /></span>
          <span className="brand__word">kinet</span>
        </div>
        <p>A fast, focused prototype for video discovery.</p>
        <div className="footer__links">
          <a href="#catalog">About</a>
          <a href="#catalog">Sources</a>
          <a href="#catalog">Privacy</a>
        </div>
      </footer>

      <AuthDialog
        open={authOpen}
        mode={authMode}
        currentUser={currentUser}
        onModeChange={setAuthMode}
        onAuthenticated={handleAuthenticated}
        onClose={closeAuth}
      />
    </div>
  );
}
