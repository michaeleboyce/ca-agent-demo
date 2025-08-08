import * as fs from 'node:fs';
import * as path from 'node:path';
import { saveIndex } from '../lib/index';

const RAW = path.join(process.cwd(), 'data', 'raw.json');

async function main() {
  const raw = JSON.parse(fs.readFileSync(RAW, 'utf-8'));
  
  // Since we're using keyword search, just save the raw chunks
  // No need for embeddings anymore
  saveIndex(raw);
  
  console.log(`Saved index: data/index.json (${raw.length} chunks)`);
}

main().catch(e => { 
  console.error(e); 
  process.exit(1); 
});