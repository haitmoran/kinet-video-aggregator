export type TextSizePreference = "small" | "default" | "large";

export type VideoMetadataPreferences = {
  stars: boolean;
  title: boolean;
  creator: boolean;
  source: boolean;
  likes: boolean;
  year: boolean;
  duration: boolean;
};

export type StarCardPreferences = {
  name: boolean;
  role: boolean;
  location: boolean;
  appearances: boolean;
  likes: boolean;
  latest: boolean;
};

export type DisplayPreferences = {
  columns: 3 | 4 | 5 | 6;
  starColumns: 3 | 4 | 5 | 6;
  videoTextSize: TextSizePreference;
  starTextSize: TextSizePreference;
  metadata: VideoMetadataPreferences;
  starMetadata: StarCardPreferences;
};

export type DisplayPreferenceView = "videos" | "stars";

export const DISPLAY_PREFERENCES_KEY = "kinet-display-preferences-v1";

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  columns: 5,
  starColumns: 5,
  videoTextSize: "default",
  starTextSize: "default",
  metadata: {
    stars: true,
    title: true,
    creator: true,
    source: true,
    likes: true,
    year: true,
    duration: true,
  },
  starMetadata: {
    name: true,
    role: true,
    location: true,
    appearances: true,
    likes: true,
    latest: true,
  },
};

function isColumnCount(value: unknown): value is DisplayPreferences["columns"] {
  return value === 3 || value === 4 || value === 5 || value === 6;
}

function isStarColumnCount(value: unknown): value is DisplayPreferences["starColumns"] {
  return value === 3 || value === 4 || value === 5 || value === 6;
}

function isTextSize(value: unknown): value is TextSizePreference {
  return value === "small" || value === "default" || value === "large";
}

export function readDisplayPreferences(): DisplayPreferences {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DISPLAY_PREFERENCES_KEY) ?? "{}",
    ) as Partial<DisplayPreferences> & { textSize?: unknown };

    const storedMetadata: Partial<VideoMetadataPreferences> = parsed.metadata ?? {};
    const storedStarMetadata: Partial<StarCardPreferences> = parsed.starMetadata ?? {};
    const legacyTextSize = isTextSize(parsed.textSize) ? parsed.textSize : "default";
    return {
      columns: isColumnCount(parsed.columns)
        ? parsed.columns
        : DEFAULT_DISPLAY_PREFERENCES.columns,
      starColumns: isStarColumnCount(parsed.starColumns)
        ? parsed.starColumns
        : DEFAULT_DISPLAY_PREFERENCES.starColumns,
      videoTextSize: isTextSize(parsed.videoTextSize)
        ? parsed.videoTextSize
        : legacyTextSize,
      starTextSize: isTextSize(parsed.starTextSize)
        ? parsed.starTextSize
        : legacyTextSize,
      metadata: {
        stars: typeof storedMetadata.stars === "boolean" ? storedMetadata.stars : true,
        title: typeof storedMetadata.title === "boolean" ? storedMetadata.title : true,
        creator: typeof storedMetadata.creator === "boolean" ? storedMetadata.creator : true,
        source: typeof storedMetadata.source === "boolean" ? storedMetadata.source : true,
        likes: typeof storedMetadata.likes === "boolean" ? storedMetadata.likes : true,
        year: typeof storedMetadata.year === "boolean" ? storedMetadata.year : true,
        duration: typeof storedMetadata.duration === "boolean" ? storedMetadata.duration : true,
      },
      starMetadata: {
        name: typeof storedStarMetadata.name === "boolean" ? storedStarMetadata.name : true,
        role: typeof storedStarMetadata.role === "boolean" ? storedStarMetadata.role : true,
        location: typeof storedStarMetadata.location === "boolean" ? storedStarMetadata.location : true,
        appearances: typeof storedStarMetadata.appearances === "boolean" ? storedStarMetadata.appearances : true,
        likes: typeof storedStarMetadata.likes === "boolean" ? storedStarMetadata.likes : true,
        latest: typeof storedStarMetadata.latest === "boolean" ? storedStarMetadata.latest : true,
      },
    };
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

export function applyDisplayPreferences(
  preferences: DisplayPreferences,
  view: DisplayPreferenceView = "videos",
): void {
  document.documentElement.dataset.textSize = view === "stars"
    ? preferences.starTextSize
    : preferences.videoTextSize;
  document.documentElement.style.setProperty(
    "--preferred-video-columns",
    String(preferences.columns),
  );
  document.documentElement.style.setProperty(
    "--preferred-star-columns",
    String(preferences.starColumns),
  );
}

export function saveDisplayPreferences(
  preferences: DisplayPreferences,
  view: DisplayPreferenceView = "videos",
): void {
  try {
    window.localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain active for the current page if storage is unavailable.
  }
  applyDisplayPreferences(preferences, view);
}
