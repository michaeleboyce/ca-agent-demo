export function countTokens(text: string, model = 'gpt-5') {
  // Simple approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}