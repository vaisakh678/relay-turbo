import type { AppRow, PlanLimitRow, PromptVersionRow, requestStatusEnum } from "@repo/db";
import { streamText, type LanguageModel } from "ai";
import { v7 as uuidv7 } from "uuid";

import { BadRequest, Forbidden, ServiceUnavailable, TooManyRequests } from "../lib/api-error";
import type { RelayEvent } from "../lib/events";
import { nextUtcDay, renderTemplate, startOfUtcDay } from "../lib/helpers";
import { logger } from "../lib/logger";
import { createModel, providerOptionsFor } from "../lib/models";
import { costMicros, isPricedModel } from "../lib/pricing";
import type { ChatRequest } from "../lib/validators";
import { sendWebhook } from "../lib/webhook";
import { getActivePrompt, getPlanLimit } from "./app-service";
import { countRequestsSince, countTestRequestsSince, insertLog } from "./log-service";
import { getProviderKey } from "./provider-key-service";
import type { ChatAuth } from "./token-service";

type RequestStatus = (typeof requestStatusEnum.enumValues)[number];

export type PreparedChat = {
  id: string;
  auth: ChatAuth;
  messages: ChatRequest["messages"];
  /** Client vars overlaid with token vars (token wins). */
  vars: Record<string, string>;
  app: AppRow;
  prompt: PromptVersionRow;
  limit: PlanLimitRow;
  apiKey: string;
};

// Across all test tokens for one app, per UTC day — caps the damage a leaked one can do.
export const TEST_TOKEN_DAILY_CAP = 100;

/**
 * Everything that can fail *before* we open the stream, so the client gets a
 * plain HTTP status (403/429/503) instead of an SSE error event.
 */
export async function prepareChat(auth: ChatAuth, body: ChatRequest): Promise<PreparedChat> {
  const { app, user, plan } = auth;
  if (app.status !== "live") throw Forbidden(`App "${app.slug}" is paused`);

  const [prompt, limit, apiKey] = await Promise.all([
    getActivePrompt(app),
    getPlanLimit(app.id, plan),
    getProviderKey(app.provider),
  ]);
  if (!prompt) throw ServiceUnavailable(`App "${app.slug}" has no active prompt`);
  if (!limit) throw BadRequest(`Unknown plan "${plan}" for app "${app.slug}"`);
  if (!apiKey) throw ServiceUnavailable(`No ${app.provider} API key configured`);

  const rejectAs = async (message: string, meta: Record<string, unknown>) => {
    await insertLog({
      appId: app.id,
      externalUserId: user,
      plan,
      tokenKind: auth.kind,
      testTokenId: auth.testTokenId,
      provider: app.provider,
      model: app.model,
      promptVersion: prompt.version,
      status: "rate_limited",
      durationMs: 0,
    });
    throw TooManyRequests(message, { ...meta, resetAt: nextUtcDay().toISOString() });
  };

  if (auth.kind === "test") {
    const used = await countTestRequestsSince(app.id, startOfUtcDay());
    if (used >= TEST_TOKEN_DAILY_CAP) {
      await rejectAs(`Daily test-token cap reached for "${app.slug}"`, { code: "test_cap", limit: TEST_TOKEN_DAILY_CAP, used });
    }
  }

  const used = await countRequestsSince(app.id, user, startOfUtcDay());
  if (used >= limit.messagesPerDay) {
    await rejectAs(`Daily message limit reached for plan "${plan}"`, { code: "rate_limited", limit: limit.messagesPerDay, used });
  }

  return {
    id: uuidv7(),
    auth,
    messages: body.messages,
    vars: { ...body.vars, ...auth.vars },
    app,
    prompt,
    limit,
    apiKey,
  };
}

/**
 * Stream one reply. Emits protocol events through `emit`, then logs the
 * request and fires the app's webhook. Never throws: failures become an
 * `error` event plus an `error`/`aborted` log row.
 */
export async function runChat(
  chat: PreparedChat,
  emit: (e: RelayEvent) => Promise<void>,
  signal: AbortSignal,
  // Injectable for tests (ai/test MockLanguageModelV4); defaults to the app's real provider.
  model: LanguageModel = createModel(chat.app.provider, chat.app.model, chat.apiKey),
) {
  const { id, auth, app, prompt, limit } = chat;
  const startedAt = performance.now();
  let ttftMs: number | null = null;
  let text = "";
  let status: RequestStatus = "ok";
  let errorMessage: string | null = null;
  let finishReason = "other";
  let usage = { input: 0, output: 0 };

  if (!isPricedModel(app.model)) logger.warn({ model: app.model }, "No pricing for model; cost will be logged as 0");

  try {
    await emit({ event: "start", data: { id, model: app.model, promptVersion: prompt.version } });

    const result = streamText({
      model,
      instructions: renderTemplate(prompt.content, chat.vars),
      messages: chat.messages,
      temperature: app.temperature,
      maxOutputTokens: limit.maxOutputTokens,
      providerOptions: providerOptionsFor(app.provider, app.model),
      abortSignal: signal,
    });

    for await (const part of result.stream) {
      if (part.type === "text-delta") {
        if (ttftMs === null) ttftMs = Math.round(performance.now() - startedAt);
        text += part.text;
        await emit({ event: "delta", data: { text: part.text } });
      } else if (part.type === "error") {
        throw part.error;
      } else if (part.type === "abort") {
        status = "aborted";
      }
    }

    if (status !== "aborted") {
      const total = await result.totalUsage;
      usage = { input: total.inputTokens ?? 0, output: total.outputTokens ?? 0 };
      finishReason = await result.finishReason;
      await emit({ event: "usage", data: usage });
      await emit({ event: "done", data: { finishReason } });
    }
  } catch (err) {
    if (signal.aborted) {
      status = "aborted";
    } else {
      status = "error";
      errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({ err, requestId: id, app: app.slug }, "Chat stream failed");
      // The client may already be gone; nothing more to do if this write fails.
      await emit({
        event: "error",
        data: { code: "upstream_error", message: "The model provider returned an error" },
      }).catch(() => {});
    }
  }

  const durationMs = Math.round(performance.now() - startedAt);
  await insertLog({
    id,
    appId: app.id,
    externalUserId: auth.user,
    plan: auth.plan,
    tokenKind: auth.kind,
    testTokenId: auth.testTokenId,
    provider: app.provider,
    model: app.model,
    promptVersion: prompt.version,
    status,
    inputTokens: usage.input,
    outputTokens: usage.output,
    ttftMs,
    durationMs,
    costMicros: costMicros(app.model, usage.input, usage.output),
    error: errorMessage,
  }).catch((err) => logger.error({ err, requestId: id }, "Failed to write request log"));

  // Delivered even if the client disconnected, so the app's backend still
  // records what was generated (and billed). Playground chats are the
  // dashboard's own and never reach the app's backend.
  if (app.webhookUrl && status !== "error" && auth.kind !== "playground") {
    void sendWebhook(app.webhookUrl, app.signingSecret, {
      id,
      app: app.slug,
      user: auth.user,
      plan: auth.plan,
      tokenKind: auth.kind,
      status,
      model: app.model,
      promptVersion: prompt.version,
      message: { role: "assistant", content: text },
      usage,
      createdAt: new Date().toISOString(),
    });
  }
}
