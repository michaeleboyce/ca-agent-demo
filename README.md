# USDR Demo – Chat over Scraped Resources

A full-stack Next.js app that:

1. **Scrapes** seed links and limited same‑origin subpages (depth/page limits)
2. **Parses** HTML and PDF (ArcGIS app text via Playwright)
3. **Chunks** and token‑counts text
4. **Indexes** locally to `data/index.json`
5. **Chats** over the documents using OpenAI tool calls with a visible **Tool Trace**
6. **Adds citations** with quoted source snippets
7. **Stays in scope** for five predefined California resources

### Quick Start

```bash
pnpm i

# One‑time (Playwright browsers)
npx playwright install chromium --with-deps

# Environment
touch .env.local
echo "OPENAI_API_KEY=sk-..." >> .env.local

# Crawl + build index
pnpm crawl
pnpm index

# Run
pnpm dev
```

### What it can answer

- Emergency alerts signup (Listos California)
- California unemployment (EDD)
- South Coast air quality map (ArcGIS)
- LA County Hazardous Tree Removal waiver (PDF)
- USCIS N-565 (replacement naturalization/citizenship docs)

### Notes

- Crawler uses modest depth/page limits (see `scripts/crawl.ts`).
- The UI shows search/read tool steps and inline citations.

### Security & Respect for Sites

- Demonstration scraper—be courteous. Keep concurrency modest, consider honoring robots.txt if you expand scope, and set reasonable rate limits.

### License

MIT