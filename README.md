# Kinet

A high-performance video aggregation interface built with Next.js, React, and TypeScript.

**Live demo:** https://haitmoran.github.io/kinet-video-aggregator/

## Features

- 1–6 column responsive catalog with 192 demo entries
- Shared `IntersectionObserver` for strict thumbnail lazy-loading
- Intent-only H.264 MP4 previews on hover, focus, or mobile long-press
- Automatic 24-item incremental loading with no numbered pages
- Bright and dark themes with no hydration flash
- Smart TV overscan mode, enlarged controls, and D-pad grid navigation
- Search, category filters, and sorting
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
