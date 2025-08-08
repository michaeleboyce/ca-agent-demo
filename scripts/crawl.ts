import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
const pdfParse = require('pdf-parse');
import { v4 as uuidv4 } from 'uuid';
import { countTokens } from '../lib/tokens';
import type { DocChunk } from '../lib/types';

const START_URLS = [
  'https://www.listoscalifornia.org/alerts/',
  'https://edd.ca.gov/en/unemployment/',
  'https://experience.arcgis.com/experience/6a6a058a177440fdac6be881d41d4c2c/',
  'https://file.lacounty.gov/SDSInter/lac/1178475_WaiverofHazardousTreeRemoval.pdf',
  'https://www.uscis.gov/n-565'
];

const OUT_DIR = path.join(process.cwd(), 'data');
const OUT_INDEX = path.join(OUT_DIR, 'raw.json');

const MAX_PAGES_PER_DOMAIN = 10; // keep this modest; adjust as needed
const MAX_DEPTH = 1; // follow subcontent within 1 click

function sameOrigin(u: string, base: URL) {
  try { const x = new URL(u, base.href); return x.origin === base.origin; } catch { return false; }
}

function normalizeUrl(u: string) { try { return new URL(u).toString(); } catch { return u; } }

async function fetchPdf(url: string) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const parsed = await pdfParse(buf);
  return parsed.text;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const seen = new Set<string>();
  const perDomainCount: Record<string, number> = {};
  const queue: { url: string; depth: number; seed: string }[] = [];
  for (const u of START_URLS) queue.push({ url: u, depth: 0, seed: new URL(u).origin });

  const chunks: DocChunk[] = [];

  while (queue.length) {
    const { url, depth, seed } = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    const base = new URL(seed);
    const origin = new URL(url).origin;
    perDomainCount[origin] ||= 0;
    if (perDomainCount[origin] >= MAX_PAGES_PER_DOMAIN) continue;

    let type: DocChunk['type'] = 'html';
    let title = '';
    let text = '';

    try {
      if (url.endsWith('.pdf')) {
        type = 'pdf';
        text = await fetchPdf(url);
        title = 'PDF Document';
      } else {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        // attempt to capture dynamic content (ArcGIS app)
        await page.waitForTimeout(2000);
        const html = await page.content();
        const $ = cheerio.load(html);
        title = ($('title').text() || '').trim();
        $('script, style, noscript, iframe').remove();
        const headings = $('h1, h2, h3').map((_, el)=>$(el).text().trim()).get();
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        text = bodyText;

        // enqueue same-origin links within depth
        if (depth < MAX_DEPTH) {
          const links = $('a[href]').map((_, el)=>$(el).attr('href')).get();
          for (const href of links) {
            try {
              const abs = new URL(href!, url).toString();
              if (!sameOrigin(abs, base)) continue; // stay on site of seed
              queue.push({ url: abs, depth: depth + 1, seed });
            } catch {}
          }
        }
      }

      const clean = text.replace(/\u0000/g, ' ').trim();
      if (clean.length < 50) continue; // skip empties

      const baseChunk: Omit<DocChunk, 'id'|'content'|'tokens'> = {
        url: normalizeUrl(url),
        title: title || url,
        headings: [],
        type
      } as any;

      // chunking ~1000 tokens per chunk
      const approxChars = 3500;
      for (let i=0;i<clean.length;i+=approxChars) {
        const slice = clean.slice(i, i+approxChars);
        const id = uuidv4();
        const tokens = countTokens(slice);
        chunks.push({ id, ...baseChunk as any, content: slice, tokens });
      }

      perDomainCount[origin]++;
      console.log(`Saved: ${url}`);
    } catch (err) {
      console.warn('Failed', url, err);
    }
  }

  fs.writeFileSync(OUT_INDEX, JSON.stringify(chunks, null, 2));
  console.log(`Wrote ${chunks.length} chunks -> ${OUT_INDEX}`);

  await browser.close();
}

run().catch(e=>{ console.error(e); process.exit(1); });