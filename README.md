# USDR Demo – Chat over Scraped Resources

A full-stack Next.js app that:

1. **Scrapes** the provided seed links and their subcontent (same-origin, limited depth)
2. **Parses** HTML + PDF (ArcGIS app captured via Playwright), chunks & tokenizes
3. **Embeds** all chunks with `text-embedding-3-large`
4. **Indexes** locally (`data/index.json`)
5. **Chats** over the documents using **tool calls** with a visible **Tool Trace** panel
6. **Produces expandable inline citations** with quoted source snippets
7. **Refuses irrelevant questions** outside the provided topics

## Setup

```bash
pnpm i
# or npm i / yarn

# env
cp .env.example .env.local
# then set OPENAI_API_KEY

# crawl + index
pnpm crawl
pnpm index

# run
pnpm dev
```

## Environment

Create `.env.local` with:

```
OPENAI_API_KEY=sk-...
```

## Notes
- Crawler intentionally limits depth/pages to avoid runaway crawling. Adjust `MAX_DEPTH` and `MAX_PAGES_PER_DOMAIN` in `scripts/crawl.ts` as needed.
- ArcGIS apps can be heavy; Playwright waits briefly to let content render, then extracts text from the DOM.
- PDF is parsed with `pdf-parse`.
- The chat route defines two tools for the model: `searchIndex` (seeded with top candidates) and `fetchChunks` (the model asks for specific chunk IDs). The UI shows each step.
- The system prompt hard-limits scope to the five specified topics, so it **won't answer** outside them.
- Citations are expandable `<details>` blocks appended after the answer.
- This demo uses a simple hybrid (keyword+vector) search over a small local index; for bigger corpora, consider a vector DB.

## Security & Respect for Sites
- This is a demonstration scraper. Be courteous: keep concurrency low, respect robots.txt if you expand it, and set reasonable rate limits.

## License
MIT