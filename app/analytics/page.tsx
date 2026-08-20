import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const metadata: Metadata = {
  title: "Private Analytics — Kinet",
  description: "Private owner analytics for Kinet.",
  robots: { index: false, follow: false, nocache: true },
};

export default function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
