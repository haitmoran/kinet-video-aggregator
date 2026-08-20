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
import { VideoCard, type VideoCardAction } from "@/components/VideoCard";
import { categories, moods, videos } from "@/data/videos";
import {
  getLikedVideoIds,
  getSession,
  saveLikedVideoIds,
  signOut,
  type SessionUser,
} from "@/lib/localAuth";

type Theme = "light" | "dark";
type MainTab = "Trending" | "Latest" | "Categories" | "Stars";
type RankMode = "Featured" | "Newest" | "Most liked" | "Shortest" | "Longest";
type DurationFilter = "Any duration" | "Under 3 min" | "3–6 min" | "6–12 min" | "12+ min";
type SourceFilter = "All sources" | "Internet Archive" | "MDN";
type EraFilter = "Any era" | "Before 2010" | "2010s" | "2020s";

const PAGE_SIZE = 24;
const mainTabs: MainTab[] = ["Trending", "Latest", "Categories", "Stars"];
const rankModes: RankMode[] = ["Featured", "Newest", "Most liked", "Shortest", "Longest"];
const durationFilters: DurationFilter[] = ["Any duration", "Under 3 min", "3–6 min", "6–12 min", "12+ min"];
const sourceFilters: SourceFilter[] = ["All sources", "Internet Archive", "MDN"];
const eraFilters: EraFilter[] = ["Any era", "Before 2010", "2010s", "2020s"];
const legacyRemoteKeys: Record<number, string> = {
  13: "Enter",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
};

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

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function columnCount(tvMode: boolean): number {
  if (tvMode) return 4;
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
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterDrawerRef = useRef<HTMLElement>(null);
  const filterCloseRef = useRef<HTMLButtonElement>(null);
  const pendingGridFocusRef = useRef<{
    index: number;
    action: VideoCardAction;
  } | null>(null);

  const [theme, setTheme] = useState<Theme>("light");
  const [tvMode, setTvMode] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("Trending");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RankMode>("Featured");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [moodFilter, setMoodFilter] = useState("Any mood");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("Any duration");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All sources");
  const [eraFilter, setEraFilter] = useState<EraFilter>("Any era");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [focusedAction, setFocusedAction] = useState<VideoCardAction>("open");
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [likedVideoIds, setLikedVideoIds] = useState<Set<string>>(new Set());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const closeFilters = useCallback((restoreFocus = true) => {
    setFilterOpen(false);
    if (restoreFocus) window.setTimeout(() => filterButtonRef.current?.focus(), 0);
  }, []);

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
    if (!filterOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => filterCloseRef.current?.focus(), 0);

    const handleFilterKeys = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilters();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = filterDrawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleFilterKeys);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleFilterKeys);
    };
  }, [closeFilters, filterOpen]);

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
      const matchesCategories =
        selectedCategories.length === 0 ||
        selectedCategories.some((selectedCategory) => video.tags.includes(selectedCategory));
      const matchesMood = moodFilter === "Any mood" || video.mood === moodFilter;
      const matchesDuration =
        durationFilter === "Any duration" ||
        (durationFilter === "Under 3 min" && video.durationSeconds < 180) ||
        (durationFilter === "3–6 min" && video.durationSeconds >= 180 && video.durationSeconds < 360) ||
        (durationFilter === "6–12 min" && video.durationSeconds >= 360 && video.durationSeconds < 720) ||
        (durationFilter === "12+ min" && video.durationSeconds >= 720);
      const matchesSource = sourceFilter === "All sources" || video.platform === sourceFilter;
      const matchesEra =
        eraFilter === "Any era" ||
        (eraFilter === "Before 2010" && video.publishedYear < 2010) ||
        (eraFilter === "2010s" && video.publishedYear >= 2010 && video.publishedYear < 2020) ||
        (eraFilter === "2020s" && video.publishedYear >= 2020);
      const matchesStars =
        activeTab !== "Stars" || Boolean(currentUser && likedVideoIds.has(video.id));
      const haystack = `${video.title} ${video.creator} ${video.platform} ${video.category} ${video.tags.join(" ")} ${video.mood}`.toLowerCase();
      return (
        matchesCategories &&
        matchesMood &&
        matchesDuration &&
        matchesSource &&
        matchesEra &&
        matchesStars &&
        (!deferredQuery || haystack.includes(deferredQuery))
      );
    });

    if (sort === "Newest") return [...matching].sort((a, b) => b.publishedYear - a.publishedYear || b.likeCount - a.likeCount);
    if (sort === "Most liked") return [...matching].sort((a, b) => b.likeCount - a.likeCount);
    if (sort === "Shortest") return [...matching].sort((a, b) => a.durationSeconds - b.durationSeconds);
    if (sort === "Longest") return [...matching].sort((a, b) => b.durationSeconds - a.durationSeconds);
    return matching;
  }, [activeTab, currentUser, deferredQuery, durationFilter, eraFilter, likedVideoIds, moodFilter, selectedCategories, sort, sourceFilter]);

  const visibleVideos = useMemo(
    () => filteredVideos.slice(0, visibleCount),
    [filteredVideos, visibleCount],
  );
  const hasMore = visibleCount < filteredVideos.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setFocusedIndex(0);
    setFocusedAction("open");
    pendingGridFocusRef.current = null;
  }, [activeTab, deferredQuery, durationFilter, eraFilter, moodFilter, selectedCategories, sort, sourceFilter]);

  useEffect(() => {
    const pendingFocus = pendingGridFocusRef.current;
    if (!pendingFocus || pendingFocus.index >= visibleVideos.length) return;

    const animationFrame = window.requestAnimationFrame(() => {
      const nextControl = gridRef.current?.querySelector<HTMLElement>(
        `[data-video-index="${pendingFocus.index}"][data-card-action="${pendingFocus.action}"]`,
      );
      if (!nextControl) return;

      pendingGridFocusRef.current = null;
      nextControl.focus();
      nextControl.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [visibleVideos.length]);

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
      setFocusedIndex(0);
      setFocusedAction("open");
      window.setTimeout(() => {
        gridRef.current
          ?.querySelector<HTMLAnchorElement>('[data-video-index="0"][data-card-action="open"]')
          ?.focus();
      }, 0);
    }
  };

  const resetFilters = () => {
    setSelectedCategories([]);
    setMoodFilter("Any mood");
    setDurationFilter("Any duration");
    setSourceFilter("All sources");
    setEraFilter("Any era");
  };

  const toggleCategory = (nextCategory: string) => {
    setSelectedCategories((current) =>
      current.includes(nextCategory)
        ? current.filter((item) => item !== nextCategory)
        : [...current, nextCategory],
    );
  };

  const activeFilterCount =
    selectedCategories.length +
    Number(moodFilter !== "Any mood") +
    Number(durationFilter !== "Any duration") +
    Number(sourceFilter !== "All sources") +
    Number(eraFilter !== "Any era");

  const selectTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === "Trending") {
      setSort("Featured");
      resetFilters();
    }
    if (tab === "Latest") {
      setSort("Newest");
      resetFilters();
    }
    if (tab === "Categories") {
      setFilterOpen(true);
    }
    if (tab === "Stars") {
      resetFilters();
      setSort("Featured");
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
    event: KeyboardEvent<HTMLElement>,
    index: number,
    action: VideoCardAction,
  ) => {
    const normalizedKey =
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "OK", "Select", "Accept"].includes(event.key)
        ? event.key
        : legacyRemoteKeys[event.keyCode] ?? event.key;

    if (
      ["OK", "Select", "Accept"].includes(normalizedKey) ||
      (normalizedKey === "Enter" && event.key !== "Enter")
    ) {
      event.preventDefault();
      event.currentTarget.click();
      return;
    }

    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(normalizedKey)) {
      return;
    }

    event.preventDefault();
    const columns = columnCount(tvMode);
    let targetIndex = index;
    let targetAction = action;

    if (normalizedKey === "ArrowRight") {
      if (action === "star-0") {
        targetAction = "star-1";
      } else if (action === "star-1") {
        targetAction = "open";
      } else if (action === "open") {
        targetAction = "like";
      } else if (index % columns !== columns - 1) {
        targetIndex = index + 1;
        targetAction = "open";
      }
    } else if (normalizedKey === "ArrowLeft") {
      if (action === "like") {
        targetAction = "open";
      } else if (action === "open") {
        targetAction = "star-1";
      } else if (action === "star-1") {
        targetAction = "star-0";
      } else if (index % columns !== 0) {
        targetIndex = index - 1;
        targetAction = "like";
      }
    } else if (normalizedKey === "ArrowUp") {
      targetIndex = index - columns;
    } else if (normalizedKey === "ArrowDown") {
      targetIndex = index + columns;
    }

    if (targetIndex < 0 || targetIndex >= filteredVideos.length) return;
    if (targetIndex === index && targetAction === action) return;

    setFocusedIndex(targetIndex);
    setFocusedAction(targetAction);

    if (targetIndex >= visibleVideos.length) {
      pendingGridFocusRef.current = { index: targetIndex, action: targetAction };
      setVisibleCount((count) =>
        Math.min(
          filteredVideos.length,
          Math.max(count + PAGE_SIZE, targetIndex + 1),
        ),
      );
      return;
    }

    const nextControl = gridRef.current?.querySelector<HTMLElement>(
      `[data-video-index="${targetIndex}"][data-card-action="${targetAction}"]`,
    );
    nextControl?.focus();
    nextControl?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  };

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
        <section ref={catalogRef} className="catalog" id="catalog" aria-label="Video catalog">
          <div className="catalog__header">
            <button
              ref={filterButtonRef}
              className={`filter-trigger ${activeFilterCount > 0 ? "has-filters" : ""}`}
              type="button"
              aria-expanded={filterOpen}
              aria-controls="filter-drawer"
              onClick={() => setFilterOpen(true)}
            >
              <FilterIcon />
              <span>Filters</span>
              {activeFilterCount > 0 && <span className="filter-trigger__count">{activeFilterCount}</span>}
            </button>
            <div className="catalog__tools">
              <span className="result-count">
                {visibleVideos.length} of {filteredVideos.length} stories
              </span>
              <label className="sort-control">
                <span className="sort-control__label">Rank by</span>
                <select
                  value={sort}
                  aria-label="Rank videos by"
                  onChange={(event) => setSort(event.target.value as RankMode)}
                >
                  {rankModes.map((rankMode) => <option key={rankMode}>{rankMode}</option>)}
                </select>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>
            </div>
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
              <p className="grid-nav-hint" id="grid-navigation-help">
                <span aria-hidden="true">D-pad</span>
                Use arrow keys to move. Each card opens by default; move right for its heart or
                left for its featured stars. Press Enter or OK to activate.
              </p>
              <div
                ref={gridRef}
                className="video-grid"
                role="list"
                aria-label="Video results"
                aria-describedby="grid-navigation-help"
                onFocusCapture={(event) => {
                  const control = (event.target as HTMLElement).closest<HTMLElement>(
                    "[data-video-index][data-card-action]",
                  );
                  if (!control) return;
                  setFocusedIndex(Number(control.dataset.videoIndex));
                  setFocusedAction(control.dataset.cardAction as VideoCardAction);
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
                    tabIndex={
                      tvMode && !(focusedIndex === index && focusedAction === "open")
                        ? -1
                        : 0
                    }
                    likeTabIndex={
                      tvMode && !(focusedIndex === index && focusedAction === "like")
                        ? -1
                        : 0
                    }
                    starTabIndexes={[
                      tvMode && !(focusedIndex === index && focusedAction === "star-0") ? -1 : 0,
                      tvMode && !(focusedIndex === index && focusedAction === "star-1") ? -1 : 0,
                    ]}
                    onKeyDown={(event) => handleGridKeyDown(event, index, "open")}
                    onLikeKeyDown={(event) => handleGridKeyDown(event, index, "like")}
                    onStarKeyDown={(event) =>
                      handleGridKeyDown(
                        event,
                        index,
                        event.currentTarget.dataset.cardAction as VideoCardAction,
                      )
                    }
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
                  resetFilters();
                  setActiveTab("Trending");
                  setSort("Featured");
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
          <a href="analytics/">Analytics</a>
        </div>
      </footer>

      {filterOpen && (
        <>
          <div className="filter-scrim" aria-hidden="true" onPointerDown={() => closeFilters()} />
          <aside
            ref={filterDrawerRef}
            className="filter-drawer"
            id="filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-title"
          >
            <header className="filter-drawer__header">
              <div>
                <p>Discovery filters</p>
                <h2 id="filter-title">Shape your feed</h2>
              </div>
              <button
                ref={filterCloseRef}
                className="filter-drawer__close"
                type="button"
                aria-label="Close filters"
                onClick={() => closeFilters()}
              >
                <CloseIcon />
              </button>
            </header>

            <div className="filter-drawer__content">
              <fieldset className="filter-group">
                <legend className="filter-group__heading">
                  <span>Categories</span>
                  <small>Mix and match</small>
                </legend>
                <div className="filter-chip-grid">
                  {categories.map((item) => {
                    const selected = selectedCategories.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        className={selected ? "is-selected" : ""}
                        aria-pressed={selected}
                        onClick={() => toggleCategory(item)}
                      >
                        <span>{item}</span>
                        <span className="filter-chip__check" aria-hidden="true">
                          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                            <path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="filter-group">
                <legend className="filter-group__heading">
                  <span>Mood</span>
                  <small>Set the tone</small>
                </legend>
                <div className="filter-pill-list">
                  {["Any mood", ...moods].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={moodFilter === item ? "is-selected" : ""}
                      aria-pressed={moodFilter === item}
                      onClick={() => setMoodFilter(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="filter-group">
                <legend className="filter-group__heading">
                  <span>Duration</span>
                  <small>Match your time</small>
                </legend>
                <div className="filter-option-list">
                  {durationFilters.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={durationFilter === item ? "is-selected" : ""}
                      aria-pressed={durationFilter === item}
                      onClick={() => setDurationFilter(item)}
                    >
                      <span>{item}</span><span aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="filter-group--split">
                <fieldset className="filter-group filter-group--compact">
                  <legend className="filter-group__heading"><span>Source</span></legend>
                  <div className="filter-option-list">
                    {sourceFilters.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={sourceFilter === item ? "is-selected" : ""}
                        aria-pressed={sourceFilter === item}
                        onClick={() => setSourceFilter(item)}
                      >
                        <span>{item}</span><span aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="filter-group filter-group--compact">
                  <legend className="filter-group__heading"><span>Era</span></legend>
                  <div className="filter-option-list">
                    {eraFilters.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={eraFilter === item ? "is-selected" : ""}
                        aria-pressed={eraFilter === item}
                        onClick={() => setEraFilter(item)}
                      >
                        <span>{item}</span><span aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            <footer className="filter-drawer__footer">
              <button type="button" className="filter-reset" disabled={activeFilterCount === 0} onClick={resetFilters}>
                Reset all
              </button>
              <button type="button" className="filter-apply" onClick={() => closeFilters()}>
                Show {filteredVideos.length} {filteredVideos.length === 1 ? "video" : "videos"}
              </button>
            </footer>
          </aside>
        </>
      )}

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
