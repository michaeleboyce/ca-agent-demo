export function countTokens(text: string, model = 'gpt-4o-mini') {
  // Simple approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}