import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? "/kinet-video-aggregator" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
