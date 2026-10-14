import type { Provider } from '@repo/dto'

export const MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
  openai: ['gpt-5', 'gpt-5-mini'],
  // From Google's models API (Oct 2026); gemini-2.5-* is closed to new users
  google: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview', 'gemini-pro-latest'],
}

// $ per 1M tokens [input, output] — mirrors apps/api/src/lib/pricing.ts
export const PRICING: Record<string, [number, number]> = {
  'claude-opus-5-5': [5, 25],
  'claude-sonnet-5-5': [3, 15],
  'claude-haiku-5-5': [1, 5],
  'gpt-5': [1.25, 10],
  'gpt-5-mini': [0.25, 2],
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.3, 2.5],
}
