import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { providerEnum } from "@repo/db";
import type { streamText } from "ai";

type Provider = (typeof providerEnum.enumValues)[number];
type ProviderOptions = Parameters<typeof streamText>[0]["providerOptions"];

/** Build a model handle with the key from the DB (keys are per-provider, not per-env). */
export function createModel(provider: Provider, model: string, apiKey: string) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogle({ apiKey })(model);
  }
}

/**
 * Provider-specific request options.
 *
 * Reasoning/"thinking" models count hidden reasoning tokens against
 * maxOutputTokens. At default effort they can spend a small plan limit
 * (e.g. 600) entirely on thinking and return little or no text, so chat
 * replies ask for the least thinking each model supports.
 */
export function providerOptionsFor(provider: Provider, model: string): ProviderOptions {
  if (provider === "openai" && /^(gpt-5|o\d)/.test(model)) {
    // The original GPT-5 models accept "minimal"; later ones use "none"/"low". "low" is accepted by all.
    const reasoningEffort = /^gpt-5(-mini|-nano)?$/.test(model) ? "minimal" : "low";
    return { openai: { reasoningEffort, reasoningSummary: null } };
  }
  if (provider === "google" && /^gemini-/.test(model)) {
    // Gemini 2.5 uses a token budget (Flash can turn thinking off; Pro's minimum is 128)
    if (/^gemini-2\.5/.test(model)) return { google: { thinkingConfig: { thinkingBudget: /pro/.test(model) ? 128 : 0 } } };
    // Gemini 3+ (and the *-latest aliases) use levels. Support for "minimal" varies by model
    // (gemini-3.8-flash rejects it), but every Gemini 3+ model accepts "low".
    return { google: { thinkingConfig: { thinkingLevel: "low" } } };
  }
  return undefined;
}
