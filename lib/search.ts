import type { DocChunk } from './types';

export interface SearchResult {
  chunk: DocChunk;
  matches: {
    text: string;
    context: string;
  }[];
  score: number;
}

/**
 * Performs fuzzy keyword search and returns relevant text snippets around matches
 */
export function fuzzySearch(query: string, index: DocChunk[], maxResults: number = 10): SearchResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
  
  const results: SearchResult[] = [];
  
  for (const chunk of index) {
    const searchableText = [
      chunk.title,
      chunk.headings?.join(' ') || '',
      chunk.content
    ].join(' ').toLowerCase();
    
    const matches: { text: string; context: string }[] = [];
    let score = 0;
    
    // Check each query term
    for (const term of queryTerms) {
      // Exact match gets higher score
      const exactMatches = (searchableText.match(new RegExp(`\\b${term}\\b`, 'gi')) || []).length;
      score += exactMatches * 3;
      
      // Fuzzy match (contains) gets lower score
      if (searchableText.includes(term)) {
        score += 1;
        
        // Extract context around matches (100 chars before and after)
        const regex = new RegExp(`.{0,100}${term}.{0,100}`, 'gi');
        const contextMatches = chunk.content.match(regex) || [];
        
        for (const contextMatch of contextMatches.slice(0, 3)) { // Max 3 contexts per term
          matches.push({
            text: term,
            context: contextMatch.trim()
          });
        }
      }
      
      // Check for partial matches (e.g., "unemploy" matches "unemployment")
      const partialRegex = new RegExp(`\\b\\w*${term}\\w*\\b`, 'gi');
      const partialMatches = (searchableText.match(partialRegex) || []).length;
      score += partialMatches * 0.5;
    }
    
    // Boost score if multiple terms appear close together
    const allTermsRegex = new RegExp(queryTerms.map(t => `(?=.*${t})`).join(''), 'i');
    if (allTermsRegex.test(searchableText.substring(0, 500))) {
      score *= 1.5;
    }
    
    // Boost score for title matches
    if (queryTerms.some(term => chunk.title.toLowerCase().includes(term))) {
      score *= 2;
    }
    
    // Boost score for URL matches (useful for specific page requests)
    if (queryTerms.some(term => chunk.url.toLowerCase().includes(term))) {
      score *= 1.5;
    }
    
    if (score > 0) {
      results.push({
        chunk,
        matches: matches.slice(0, 5), // Limit to 5 context snippets
        score
      });
    }
  }
  
  // Sort by score and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Get full content of specific chunks by ID
 */
export function getChunksByIds(index: DocChunk[], ids: string[]): DocChunk[] {
  return index.filter(chunk => ids.includes(chunk.id));
}

/**
 * Get all chunks from a specific URL
 */
export function getChunksByUrl(index: DocChunk[], url: string): DocChunk[] {
  return index.filter(chunk => chunk.url === url);
}