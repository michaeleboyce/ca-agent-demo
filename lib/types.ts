export type DocChunk = {
  id: string;
  url: string;
  title: string;
  headings?: string[];
  content: string;
  tokens: number;
  vector?: number[];
  type: 'html'|'pdf'|'app'|'other';
};