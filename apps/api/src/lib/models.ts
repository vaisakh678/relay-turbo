import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { providerEnum } from "@repo/db";

type Provider = (typeof providerEnum.enumValues)[number];

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
