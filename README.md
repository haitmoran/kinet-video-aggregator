# Kinet

A high-performance video aggregation interface built with Next.js, React, and TypeScript.

**Live demo:** https://haitmoran.github.io/kinet-video-aggregator/

## Features

- 1–6 column responsive catalog with 180 demo entries
- Shared `IntersectionObserver` for strict thumbnail lazy-loading
- Intent-only H.264 MP4 previews on hover, focus, or mobile long-press
- Automatic 24-item incremental loading with no numbered pages
- Bright and dark themes with no hydration flash
- Smart TV overscan mode, enlarged controls, and D-pad grid navigation
- Search plus a collapsible filter drawer for categories, mood, duration, source, and era
- Featured, newest, most-liked, shortest, and longest ranking modes
- Browser-local username/password registration with optional recovery email
- Per-user likes surfaced in the Stars tab
- Dense, edge-to-edge cards with high-contrast overlaid metadata
- Fully static production export

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The static site is written to `out/`.

The demo catalog links to real open-film pages on Internet Archive and a CC0 MDN media example. Its thumbnails and short previews are extracted from the matching permitted source footage. Production ingestion should still retrieve provider metadata through official APIs and generate previews only for content the operator is authorized to process.

Authentication in this static demo is device-local. Passwords are stored as salted PBKDF2 hashes; only a hash of the optional recovery email is retained alongside liked-video IDs in browser storage. A production, cross-device release should replace `lib/localAuth.ts` with a server-backed authentication and database adapter.
