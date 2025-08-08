import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DocChunk } from './types';

const DATA_PATH = path.join(process.cwd(), 'data');
const INDEX_PATH = path.join(DATA_PATH, 'index.json');

export function loadIndex(): DocChunk[] {
  if (!fs.existsSync(INDEX_PATH)) return [];
  const raw = fs.readFileSync(INDEX_PATH, 'utf-8');
  return JSON.parse(raw);
}

export function saveIndex(chunks: DocChunk[]) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(chunks, null, 2));
}