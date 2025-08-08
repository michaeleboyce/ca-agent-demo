import * as fs from 'node:fs';
import * as path from 'node:path';
import { saveIndex } from '../lib/index';
import { countTokens } from '../lib/tokens';
import type { DocChunk } from '../lib/types';

const RAW = path.join(process.cwd(), 'data', 'raw.json');

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function main() {
  const raw: DocChunk[] = JSON.parse(fs.readFileSync(RAW, 'utf-8'));

  // Build index preserving each raw chunk and making titles unique/traceable
  const indexed: DocChunk[] = raw.map((chunk, index) => {
    const baseTitle = (chunk.title && chunk.title.trim()) || 'Untitled';
    const domain = getDomainFromUrl(chunk.url);
    const uniqueTitle = `${baseTitle} — Row ${index + 1} — Source: ${domain}`;
    const tokens = countTokens(chunk.content);

    const updated: DocChunk = {
      id: chunk.id, // keep original id for traceability
      url: chunk.url,
      title: uniqueTitle,
      headings: chunk.headings,
      content: chunk.content,
      tokens,
      type: chunk.type
    };

    return updated;
  });

  saveIndex(indexed);
  console.log(`Saved index: data/index.json (${indexed.length} documents from ${raw.length} raw chunks)`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});