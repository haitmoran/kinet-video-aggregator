export const ANALYTICS_API_URL = (
  process.env.NEXT_PUBLIC_ANALYTICS_API_URL ?? ""
).replace(/\/$/, "");

const VISITOR_KEY = "kinet-analytics-visitor-v1";
const SESSION_KEY = "kinet-analytics-session-v1";
export const OWNER_SESSION_KEY = "kinet-owner-analytics-session-v1";

type AnalyticsEvent = {
  type: "page_view" | "video_open";
  path?: string;
  itemId?: string;
  itemLabel?: string;
};

function randomId(): string {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function storageId(storage: Storage, key: string): string {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const created = randomId();
    storage.setItem(key, created);
    return created;
  } catch {
    return randomId();
  }
}

function deviceClass(): "Mobile" | "Tablet" | "Desktop" | "TV" {
  if (document.documentElement.dataset.tv === "true") return "TV";
  if (window.innerWidth < 768) return "Mobile";
  if (window.innerWidth < 1100) return "Tablet";
  return "Desktop";
}

function referrerHost(): string {
  if (!document.referrer) return "";
  try {
    const referrer = new URL(document.referrer);
    return referrer.hostname === window.location.hostname ? "" : referrer.hostname;
  } catch {
    return "";
  }
}

export function analyticsEnabled(): boolean {
  return Boolean(ANALYTICS_API_URL);
}

export function trackAnalyticsEvent(event: AnalyticsEvent): void {
  if (!ANALYTICS_API_URL || typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;

  const payload = JSON.stringify({
    eventType: event.type,
    visitorId: storageId(window.localStorage, VISITOR_KEY),
    sessionId: storageId(window.sessionStorage, SESSION_KEY),
    path: event.path ?? window.location.pathname,
    referrer: referrerHost(),
    device: deviceClass(),
    itemId: event.itemId ?? "",
    itemLabel: event.itemLabel ?? "",
  });
  const endpoint = `${ANALYTICS_API_URL}/v1/collect`;

  try {
    if (navigator.sendBeacon) {
      const body = new Blob([payload], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(endpoint, body)) return;
    }

    void fetch(endpoint, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  } catch {
    // Analytics must never interfere with browsing.
  }
}
