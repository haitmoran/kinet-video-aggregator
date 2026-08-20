import Script from "next/script";

const analyticsToken = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN?.trim();

export function CloudflareAnalytics() {
  if (!analyticsToken) return null;

  return (
    <Script
      id="cloudflare-web-analytics"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="lazyOnload"
      data-cf-beacon={JSON.stringify({ token: analyticsToken })}
    />
  );
}
