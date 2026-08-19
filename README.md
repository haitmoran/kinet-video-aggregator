# Kinet

A high-performance video aggregation interface built with Next.js, React, and TypeScript.

## Features

- 1–6 column responsive catalog with 192 demo entries
- Shared `IntersectionObserver` for strict thumbnail lazy-loading
- Intent-only WebM previews on hover, focus, or mobile long-press
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

The catalog data is demonstrative. Production ingestion should retrieve provider metadata through official APIs and generate previews only for content the operator is authorized to process.
