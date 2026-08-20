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

export type DisplayPreferences = {
  columns: 3 | 4 | 5 | 6;
  textSize: TextSizePreference;
  metadata: VideoMetadataPreferences;
};

export const DISPLAY_PREFERENCES_KEY = "kinet-display-preferences-v1";

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  columns: 5,
  textSize: "default",
  metadata: {
    stars: true,
    title: true,
    creator: true,
    source: true,
    likes: true,
    year: true,
    duration: true,
  },
};

function isColumnCount(value: unknown): value is DisplayPreferences["columns"] {
  return value === 3 || value === 4 || value === 5 || value === 6;
}

function isTextSize(value: unknown): value is TextSizePreference {
  return value === "small" || value === "default" || value === "large";
}

export function readDisplayPreferences(): DisplayPreferences {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DISPLAY_PREFERENCES_KEY) ?? "{}",
    ) as Partial<DisplayPreferences>;

    const storedMetadata: Partial<VideoMetadataPreferences> = parsed.metadata ?? {};
    return {
      columns: isColumnCount(parsed.columns)
        ? parsed.columns
        : DEFAULT_DISPLAY_PREFERENCES.columns,
      textSize: isTextSize(parsed.textSize)
        ? parsed.textSize
        : DEFAULT_DISPLAY_PREFERENCES.textSize,
      metadata: {
        stars: typeof storedMetadata.stars === "boolean" ? storedMetadata.stars : true,
        title: typeof storedMetadata.title === "boolean" ? storedMetadata.title : true,
        creator: typeof storedMetadata.creator === "boolean" ? storedMetadata.creator : true,
        source: typeof storedMetadata.source === "boolean" ? storedMetadata.source : true,
        likes: typeof storedMetadata.likes === "boolean" ? storedMetadata.likes : true,
        year: typeof storedMetadata.year === "boolean" ? storedMetadata.year : true,
        duration: typeof storedMetadata.duration === "boolean" ? storedMetadata.duration : true,
      },
    };
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

export function applyDisplayPreferences(preferences: DisplayPreferences): void {
  document.documentElement.dataset.textSize = preferences.textSize;
  document.documentElement.style.setProperty(
    "--preferred-video-columns",
    String(preferences.columns),
  );
}

export function saveDisplayPreferences(preferences: DisplayPreferences): void {
  try {
    window.localStorage.setItem(DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain active for the current page if storage is unavailable.
  }
  applyDisplayPreferences(preferences);
}
