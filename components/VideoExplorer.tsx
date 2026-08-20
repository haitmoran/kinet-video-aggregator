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
import { PreferencesPopover } from "@/components/PreferencesPopover";
import { StarDirectory, type StarDirectoryEntry } from "@/components/StarDirectory";
import { VideoCard, type VideoCardAction } from "@/components/VideoCard";
import { categories, moods, videos } from "@/data/videos";
import { getStarSlugsForVideo, starProfiles } from "@/data/stars";
import {
  applyDisplayPreferences,
  DEFAULT_DISPLAY_PREFERENCES,
  readDisplayPreferences,
  saveDisplayPreferences,
  type DisplayPreferences,
} from "@/lib/displayPreferences";
import {
  getLikedVideoIds,
  getSession,
  MANAGER_USERNAME,
  saveLikedVideoIds,
  signOut,
  type SessionUser,
} from "@/lib/localAuth";
import { clearAnalyticsOwnerSession } from "@/lib/analyticsClient";

type Theme = "light" | "dark";
type MainTab = "Trending" | "Latest" | "Categories" | "Stars" | "Liked";
type VideoSortMode = "Featured" | "Newest" | "Most liked" | "Shortest" | "Longest";
type StarSortMode = "Featured" | "Name A–Z" | "Most appearances" | "Most liked" | "Newest work";
type DurationFilter = "Any duration" | "Under 3 min" | "3–6 min" | "6–12 min" | "12+ min";
type SourceFilter = "All sources" | "Internet Archive" | "MDN";
type EraFilter = "Any era" | "Before 2010" | "2010s" | "2020s";
type StarAppearanceFilter = "Any appearances" | "40+ stories" | "Under 40 stories";

const PAGE_SIZE = 24;
const mainTabs: MainTab[] = ["Trending", "Latest", "Categories", "Stars"];
const videoSortModes: VideoSortMode[] = ["Featured", "Newest", "Most liked", "Shortest", "Longest"];
const starSortModes: StarSortMode[] = ["Featured", "Name A–Z", "Most appearances", "Most liked", "Newest work"];
const durationFilters: DurationFilter[] = ["Any duration", "Under 3 min", "3–6 min", "6–12 min", "12+ min"];
const sourceFilters: SourceFilter[] = ["All sources", "Internet Archive", "MDN"];
const eraFilters: EraFilter[] = ["Any era", "Before 2010", "2010s", "2020s"];
const starAppearanceFilters: StarAppearanceFilter[] = ["Any appearances", "40+ stories", "Under 40 stories"];
const starRoles = [...new Set(starProfiles.map((profile) => profile.role))];
const starSpecialties = [...new Set(starProfiles.flatMap((profile) => profile.specialties))].sort();
const starRegions = ["Europe", "Asia", "Africa", "North America"] as const;
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

function columnCount(tvMode: boolean, preferredColumns: DisplayPreferences["columns"]): number {
  if (tvMode) return preferredColumns;
  const width = window.innerWidth;
  if (width < 480) return 1;
  if (width < 768) return 2;
  if (width < 1024) return 3;
  return preferredColumns;
}

function regionForLocation(location: string): (typeof starRegions)[number] {
  if (/Portugal|United Kingdom|Spain/.test(location)) return "Europe";
  if (/South Korea/.test(location)) return "Asia";
  if (/Nigeria/.test(location)) return "Africa";
  return "North America";
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
  const [videoSort, setVideoSort] = useState<VideoSortMode>("Featured");
  const [starSort, setStarSort] = useState<StarSortMode>("Featured");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [moodFilter, setMoodFilter] = useState("Any mood");
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("Any duration");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All sources");
  const [eraFilter, setEraFilter] = useState<EraFilter>("Any era");
  const [selectedStarRoles, setSelectedStarRoles] = useState<string[]>([]);
  const [selectedStarRegions, setSelectedStarRegions] = useState<string[]>([]);
  const [selectedStarSpecialties, setSelectedStarSpecialties] = useState<string[]>([]);
  const [starAppearanceFilter, setStarAppearanceFilter] = useState<StarAppearanceFilter>("Any appearances");
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(
    DEFAULT_DISPLAY_PREFERENCES,
  );
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
    const pageParameters = new URLSearchParams(window.location.search);
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const savedTvMode = window.localStorage.getItem("kinet-tv") === "true";
    setTvMode(savedTvMode);
    document.documentElement.dataset.tv = String(savedTvMode);

    const session = getSession();
    setCurrentUser(session);
    if (session) setLikedVideoIds(getLikedVideoIds(session.normalizedUsername));

    const startsOnStars = pageParameters.get("tab") === "stars";
    if (startsOnStars) {
      setActiveTab("Stars");
      setStarSort("Featured");
    }

    if (pageParameters.get("managerLogin") === "1") {
      setAuthMode("login");
      setAuthOpen(true);
    }

    const savedPreferences = readDisplayPreferences();
    setDisplayPreferences(savedPreferences);
    applyDisplayPreferences(savedPreferences, startsOnStars ? "stars" : "videos");
  }, []);

  useEffect(() => {
    applyDisplayPreferences(
      displayPreferences,
      activeTab === "Stars" ? "stars" : "videos",
    );
  }, [activeTab, displayPreferences.starTextSize, displayPreferences.videoTextSize]);

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

  const videosMatchingFilters = useMemo(
    () => videos.filter((video) => {
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
      return (
        matchesCategories &&
        matchesMood &&
        matchesDuration &&
        matchesSource &&
        matchesEra
      );
    }),
    [durationFilter, eraFilter, moodFilter, selectedCategories, sourceFilter],
  );

  const filteredVideos = useMemo(() => {
    const matching = videosMatchingFilters.filter((video) => {
      const matchesLiked =
        activeTab !== "Liked" || Boolean(currentUser && likedVideoIds.has(video.id));
      const haystack = `${video.title} ${video.creator} ${video.platform} ${video.category} ${video.tags.join(" ")} ${video.mood}`.toLowerCase();
      return matchesLiked && (!deferredQuery || haystack.includes(deferredQuery));
    });

    if (videoSort === "Newest") return [...matching].sort((a, b) => b.publishedYear - a.publishedYear || b.likeCount - a.likeCount);
    if (videoSort === "Most liked") return [...matching].sort((a, b) => b.likeCount - a.likeCount);
    if (videoSort === "Shortest") return [...matching].sort((a, b) => a.durationSeconds - b.durationSeconds);
    if (videoSort === "Longest") return [...matching].sort((a, b) => b.durationSeconds - a.durationSeconds);
    return matching;
  }, [activeTab, currentUser, deferredQuery, likedVideoIds, videoSort, videosMatchingFilters]);

  const filteredStars = useMemo(() => {
    const entries = starProfiles.flatMap<StarDirectoryEntry>((profile) => {
      const relatedVideos = videos.filter((video) =>
        getStarSlugsForVideo(video.id).includes(profile.slug),
      );
      const matchesRole = selectedStarRoles.length === 0 || selectedStarRoles.includes(profile.role);
      const profileRegion = regionForLocation(profile.location);
      const matchesRegion = selectedStarRegions.length === 0 || selectedStarRegions.includes(profileRegion);
      const matchesSpecialty = selectedStarSpecialties.length === 0 ||
        selectedStarSpecialties.some((specialty) => profile.specialties.includes(specialty));
      const matchesAppearances =
        starAppearanceFilter === "Any appearances" ||
        (starAppearanceFilter === "40+ stories" && relatedVideos.length >= 40) ||
        (starAppearanceFilter === "Under 40 stories" && relatedVideos.length < 40);
      const profileText = `${profile.name} ${profile.role} ${profile.location} ${profile.specialties.join(" ")}`.toLowerCase();
      const matchesSearch =
        !deferredQuery ||
        profileText.includes(deferredQuery) ||
        relatedVideos.some((video) =>
          `${video.title} ${video.creator} ${video.tags.join(" ")}`.toLowerCase().includes(deferredQuery),
        );
      if (
        !relatedVideos.length ||
        !matchesSearch ||
        !matchesRole ||
        !matchesRegion ||
        !matchesSpecialty ||
        !matchesAppearances
      ) return [];

      return [{
        profile,
        appearances: relatedVideos.length,
        totalLikes: relatedVideos.reduce((total, video) => total + video.likeCount, 0),
        newestYear: Math.max(...relatedVideos.map((video) => video.publishedYear)),
      }];
    });

    if (starSort === "Name A–Z") return entries.sort((a, b) => a.profile.name.localeCompare(b.profile.name));
    if (starSort === "Most appearances") return entries.sort((a, b) => b.appearances - a.appearances || b.totalLikes - a.totalLikes);
    if (starSort === "Most liked") return entries.sort((a, b) => b.totalLikes - a.totalLikes);
    if (starSort === "Newest work") return entries.sort((a, b) => b.newestYear - a.newestYear || b.totalLikes - a.totalLikes);
    return entries;
  }, [deferredQuery, selectedStarRegions, selectedStarRoles, selectedStarSpecialties, starAppearanceFilter, starSort]);

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
  }, [activeTab, deferredQuery, durationFilter, eraFilter, moodFilter, selectedCategories, sourceFilter, starAppearanceFilter, starSort, selectedStarRegions, selectedStarRoles, selectedStarSpecialties, videoSort]);

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

  const resetVideoFilters = () => {
    setSelectedCategories([]);
    setMoodFilter("Any mood");
    setDurationFilter("Any duration");
    setSourceFilter("All sources");
    setEraFilter("Any era");
  };

  const resetStarFilters = () => {
    setSelectedStarRoles([]);
    setSelectedStarRegions([]);
    setSelectedStarSpecialties([]);
    setStarAppearanceFilter("Any appearances");
  };

  const resetActiveFilters = () => {
    if (activeTab === "Stars") resetStarFilters();
    else resetVideoFilters();
  };

  const toggleCategory = (nextCategory: string) => {
    setSelectedCategories((current) =>
      current.includes(nextCategory)
        ? current.filter((item) => item !== nextCategory)
        : [...current, nextCategory],
    );
  };

  const activeVideoFilterCount =
    selectedCategories.length +
    Number(moodFilter !== "Any mood") +
    Number(durationFilter !== "Any duration") +
    Number(sourceFilter !== "All sources") +
    Number(eraFilter !== "Any era");
  const activeStarFilterCount =
    selectedStarRoles.length +
    selectedStarRegions.length +
    selectedStarSpecialties.length +
    Number(starAppearanceFilter !== "Any appearances");
  const activeFilterCount = activeTab === "Stars" ? activeStarFilterCount : activeVideoFilterCount;

  const updateDisplayPreferences = (preferences: DisplayPreferences) => {
    setDisplayPreferences(preferences);
    saveDisplayPreferences(preferences, activeTab === "Stars" ? "stars" : "videos");

    if (displayPreferences.metadata.stars && !preferences.metadata.stars) {
      setFocusedAction("open");
    }
  };

  const selectTab = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === "Trending") {
      setVideoSort("Featured");
      resetVideoFilters();
    }
    if (tab === "Latest") {
      setVideoSort("Newest");
      resetVideoFilters();
    }
    if (tab === "Categories") {
      setFilterOpen(true);
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

    if (
      user.normalizedUsername === MANAGER_USERNAME &&
      new URLSearchParams(window.location.search).get("managerLogin") === "1"
    ) {
      window.location.assign("analytics/");
    }
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
    clearAnalyticsOwnerSession();
    setCurrentUser(null);
    setLikedVideoIds(new Set());
    setAccountMenuOpen(false);
  };

  const openLikedVideos = () => {
    setActiveTab("Liked");
    resetVideoFilters();
    setVideoSort("Featured");
    setAccountMenuOpen(false);
    catalogRef.current?.scrollIntoView({ block: "start" });
  };

  const isManager = currentUser?.normalizedUsername === MANAGER_USERNAME;

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
    const columns = columnCount(tvMode, displayPreferences.columns);
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
        if (displayPreferences.metadata.stars) {
          targetAction = "star-1";
        } else if (index % columns !== 0) {
          targetIndex = index - 1;
          targetAction = "like";
        }
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

    if (targetIndex < 0 && normalizedKey === "ArrowUp") {
      filterButtonRef.current?.focus();
      filterButtonRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
      return;
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

  useEffect(() => {
    const enterGridWithArrows = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const normalizedKey =
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
          ? event.key
          : legacyRemoteKeys[event.keyCode] ?? event.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(normalizedKey)) return;

      const eventTarget = event.target as HTMLElement | null;
      if (eventTarget?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (filterOpen || authOpen) return;
      if (activeTab === "Stars" ? filteredStars.length === 0 : visibleVideos.length === 0) return;

      const activeElement = document.activeElement as HTMLElement | null;
      const toolbar = activeElement?.closest<HTMLElement>(".topbar, .catalog__header");
      if (toolbar && activeElement && ["ArrowLeft", "ArrowRight"].includes(normalizedKey)) {
        const controls = [...toolbar.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )].filter((control) => control.getClientRects().length > 0);
        const activeIndex = controls.indexOf(activeElement);
        const offset = normalizedKey === "ArrowRight" ? 1 : -1;
        const nextControl = controls[activeIndex + offset];
        if (nextControl) {
          event.preventDefault();
          nextControl.focus();
        }
        return;
      }

      if (
        activeElement &&
        activeElement !== document.body &&
        activeElement !== document.documentElement &&
        !(toolbar && normalizedKey === "ArrowDown")
      ) {
        return;
      }

      event.preventDefault();
      if (activeTab === "Stars") {
        const firstStar = catalogRef.current?.querySelector<HTMLElement>(
          '[data-star-card-index="0"]',
        );
        firstStar?.focus();
        firstStar?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        return;
      }

      const safeAction = displayPreferences.metadata.stars || !focusedAction.startsWith("star-")
        ? focusedAction
        : "open";
      const nextControl = gridRef.current?.querySelector<HTMLElement>(
        `[data-video-index="${Math.min(focusedIndex, visibleVideos.length - 1)}"][data-card-action="${safeAction}"]`,
      ) ?? gridRef.current?.querySelector<HTMLElement>(
        '[data-video-index="0"][data-card-action="open"]',
      );
      nextControl?.focus();
      nextControl?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    };

    window.addEventListener("keydown", enterGridWithArrows);
    return () => window.removeEventListener("keydown", enterGridWithArrows);
  }, [activeTab, authOpen, displayPreferences.metadata.stars, filterOpen, filteredStars.length, focusedAction, focusedIndex, visibleVideos.length]);

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
          {isManager && <a className="manager-tab" href="analytics/">Analytics</a>}
        </nav>

        <label className="nav-search" aria-label="Search videos">
          <SearchIcon />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder={activeTab === "Stars" ? "Search stars, roles, skills" : "Search stories, creators, topics"}
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
                    onClick={openLikedVideos}
                  >
                    Liked videos
                  </button>
                  {!isManager && (
                    <button type="button" role="menuitem" onClick={() => openAuth("change")}>Change password</button>
                  )}
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
        <section
          ref={catalogRef}
          className="catalog"
          id="catalog"
          aria-label={activeTab === "Stars" ? "Star directory" : "Video catalog"}
        >
          <div className="catalog__header">
            <div className="catalog__left-tools">
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
              <PreferencesPopover
                view={activeTab === "Stars" ? "stars" : "videos"}
                preferences={displayPreferences}
                onChange={updateDisplayPreferences}
              />
              {activeTab === "Liked" && <span className="catalog-view-label">Liked videos</span>}
            </div>
            <div className="catalog__tools">
              <span className="result-count">
                {activeTab === "Stars"
                  ? `${filteredStars.length} stars`
                  : `${visibleVideos.length} of ${filteredVideos.length} stories`}
              </span>
              <label className="sort-control">
                <span className="sort-control__label">
                  Sort by
                </span>
                <select
                  value={activeTab === "Stars" ? starSort : videoSort}
                  aria-label={activeTab === "Stars" ? "Sort stars by" : "Sort videos by"}
                  onChange={(event) => activeTab === "Stars"
                    ? setStarSort(event.target.value as StarSortMode)
                    : setVideoSort(event.target.value as VideoSortMode)}
                >
                  {(activeTab === "Stars" ? starSortModes : videoSortModes).map((sortMode) => (
                    <option key={sortMode}>{sortMode}</option>
                  ))}
                </select>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path d="m8 10 4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </label>
            </div>
          </div>

          {activeTab === "Stars" ? (
            filteredStars.length > 0 ? (
              <StarDirectory
                entries={filteredStars}
                tvMode={tvMode}
                columns={displayPreferences.starColumns}
                details={displayPreferences.starMetadata}
              />
            ) : (
              <div className="empty-state">
                <span className="empty-state__icon"><SearchIcon /></span>
                <h2>No stars found</h2>
                <p>Try a broader search or reset the star filters.</p>
                <button type="button" onClick={() => { setQuery(""); resetStarFilters(); }}>Clear filters</button>
              </div>
            )
          ) : activeTab === "Liked" && !currentUser ? (
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
                Use arrow keys to move. Each card opens by default; move right for its heart
                {displayPreferences.metadata.stars ? " or left for its featured stars" : ""}.
                {" "}Press Enter or OK to activate.
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
                    metadata={displayPreferences.metadata}
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
              <h2>{activeTab === "Liked" ? "No liked videos yet" : "No stories found"}</h2>
              <p>
                {activeTab === "Liked"
                  ? "Tap the heart on any video to save it here."
                  : "Try a broader search or choose another category."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  resetVideoFilters();
                  setActiveTab("Trending");
                  setVideoSort("Featured");
                }}
              >
                {activeTab === "Liked" ? "Explore videos" : "Clear filters"}
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
                <p>{activeTab === "Stars" ? "Talent filters" : "Discovery filters"}</p>
                <h2 id="filter-title">{activeTab === "Stars" ? "Find your stars" : "Shape your feed"}</h2>
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
              {activeTab === "Stars" ? (
                <>
                  <fieldset className="filter-group">
                    <legend className="filter-group__heading">
                      <span>Role</span>
                      <small>Select one or more</small>
                    </legend>
                    <div className="filter-chip-grid">
                      {starRoles.map((item) => {
                        const selected = selectedStarRoles.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            className={selected ? "is-selected" : ""}
                            aria-pressed={selected}
                            onClick={() => setSelectedStarRoles((current) =>
                              current.includes(item)
                                ? current.filter((value) => value !== item)
                                : [...current, item])}
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
                      <span>Region</span>
                      <small>Where they are based</small>
                    </legend>
                    <div className="filter-pill-list">
                      {starRegions.map((item) => {
                        const selected = selectedStarRegions.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            className={selected ? "is-selected" : ""}
                            aria-pressed={selected}
                            onClick={() => setSelectedStarRegions((current) =>
                              current.includes(item)
                                ? current.filter((value) => value !== item)
                                : [...current, item])}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="filter-group">
                    <legend className="filter-group__heading">
                      <span>Specialties</span>
                      <small>Creative skills</small>
                    </legend>
                    <div className="filter-chip-grid">
                      {starSpecialties.map((item) => {
                        const selected = selectedStarSpecialties.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            className={selected ? "is-selected" : ""}
                            aria-pressed={selected}
                            onClick={() => setSelectedStarSpecialties((current) =>
                              current.includes(item)
                                ? current.filter((value) => value !== item)
                                : [...current, item])}
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
                      <span>Appearances</span>
                      <small>Related stories</small>
                    </legend>
                    <div className="filter-option-list">
                      {starAppearanceFilters.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={starAppearanceFilter === item ? "is-selected" : ""}
                          aria-pressed={starAppearanceFilter === item}
                          onClick={() => setStarAppearanceFilter(item)}
                        >
                          <span>{item}</span><span aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            <footer className="filter-drawer__footer">
              <button type="button" className="filter-reset" disabled={activeFilterCount === 0} onClick={resetActiveFilters}>
                Reset all
              </button>
              <button type="button" className="filter-apply" onClick={() => closeFilters()}>
                Show {activeTab === "Stars" ? filteredStars.length : filteredVideos.length}{" "}
                {activeTab === "Stars"
                  ? filteredStars.length === 1 ? "star" : "stars"
                  : filteredVideos.length === 1 ? "video" : "videos"}
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
