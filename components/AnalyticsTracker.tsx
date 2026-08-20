"use client";

import { useEffect } from "react";
import { analyticsEnabled, trackAnalyticsEvent } from "@/lib/analyticsClient";

export function AnalyticsTracker() {
  useEffect(() => {
    if (!analyticsEnabled() || window.location.pathname.endsWith("/analytics/")) return;

    const sendPageView = () => trackAnalyticsEvent({ type: "page_view" });
    const browserWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (browserWindow.requestIdleCallback) {
      const handle = browserWindow.requestIdleCallback(sendPageView, { timeout: 2200 });
      return () => browserWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(sendPageView, 900);
    return () => window.clearTimeout(handle);
  }, []);

  return null;
}
