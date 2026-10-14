import { validate } from "../lib/validate";
import { Hono } from "hono";

import { workspaceOf } from "../lib/helpers-ctx";
import type { AppEnv } from "../middleware/auth";

import type { APIResponse } from "../lib/types";
import {
  createAppSchema,
  idParamSchema,
  createTestTokenSchema,
  playgroundTokenSchema,
  publishPromptSchema,
  replaceLimitsSchema,
  tokenParamSchema,
  updateAppSchema,
  versionParamSchema,
} from "../lib/validators";
import {
  activatePromptVersion,
  createApp,
  deleteApp,
  getApp,
  listApps,
  publishPrompt,
  replaceLimits,
  revealSigningSecret,
  rotateSigningSecret,
  updateApp,
} from "../services/app-service";
import { createPlaygroundToken, createTestToken, listTestTokens, revokeTestToken } from "../services/token-service";

const appRoute = new Hono<AppEnv>()
  // GET /api/v1/apps
  .get("/", async (c) => {
    const apps = await listApps(workspaceOf(c));
    return c.json<APIResponse<typeof apps>>({ data: apps });
  })
  // POST /api/v1/apps — creates v1 prompt + default free/pro limits
  .post("/", validate("json", createAppSchema), async (c) => {
    const app = await createApp(workspaceOf(c), c.req.valid("json"));
    return c.json<APIResponse<typeof app>>({ data: app }, 201);
  })
  // GET /api/v1/apps/:id — includes prompt history and limits
  .get("/:id", validate("param", idParamSchema), async (c) => {
    const app = await getApp(workspaceOf(c), c.req.valid("param").id);
    return c.json<APIResponse<typeof app>>({ data: app });
  })
  // PATCH /api/v1/apps/:id — model, status, webhook, etc.
  .patch("/:id", validate("param", idParamSchema), validate("json", updateAppSchema), async (c) => {
    const app = await updateApp(workspaceOf(c), c.req.valid("param").id, c.req.valid("json"));
    return c.json<APIResponse<typeof app>>({ data: app });
  })
  // DELETE /api/v1/apps/:id — soft delete
  .delete("/:id", validate("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await deleteApp(workspaceOf(c), id);
    return c.json<APIResponse<{ id: string }>>({ data: { id } });
  })
  // GET /api/v1/apps/:id/secret — full signing secret (reveal/copy in the dashboard)
  .get("/:id/secret", validate("param", idParamSchema), async (c) => {
    const signingSecret = await revealSigningSecret(workspaceOf(c), c.req.valid("param").id);
    return c.json<APIResponse<{ signingSecret: string }>>({ data: { signingSecret } });
  })
  // POST /api/v1/apps/:id/secret/rotate
  .post("/:id/secret/rotate", validate("param", idParamSchema), async (c) => {
    const signingSecret = await rotateSigningSecret(workspaceOf(c), c.req.valid("param").id);
    return c.json<APIResponse<{ signingSecret: string }>>({ data: { signingSecret } });
  })
  // POST /api/v1/apps/:id/prompts — publish a new version and make it live
  .post("/:id/prompts", validate("param", idParamSchema), validate("json", publishPromptSchema), async (c) => {
    const prompt = await publishPrompt(workspaceOf(c), c.req.valid("param").id, c.req.valid("json"));
    return c.json<APIResponse<typeof prompt>>({ data: prompt }, 201);
  })
  // POST /api/v1/apps/:id/prompts/:version/activate — roll back/forward
  .post("/:id/prompts/:version/activate", validate("param", versionParamSchema), async (c) => {
    const { id, version } = c.req.valid("param");
    await activatePromptVersion(workspaceOf(c), id, version);
    return c.json<APIResponse<{ activePromptVersion: number }>>({ data: { activePromptVersion: version } });
  })
  // PUT /api/v1/apps/:id/limits — replace all plan limits
  .put("/:id/limits", validate("param", idParamSchema), validate("json", replaceLimitsSchema), async (c) => {
    const limits = await replaceLimits(workspaceOf(c), c.req.valid("param").id, c.req.valid("json").limits);
    return c.json<APIResponse<typeof limits>>({ data: limits });
  })
  // GET /api/v1/apps/:id/test-tokens — metadata only, never the token strings
  .get("/:id/test-tokens", validate("param", idParamSchema), async (c) => {
    const tokens = await listTestTokens(workspaceOf(c), c.req.valid("param").id);
    return c.json<APIResponse<typeof tokens>>({ data: tokens });
  })
  // POST /api/v1/apps/:id/test-tokens — returns the token string once
  .post("/:id/test-tokens", validate("param", idParamSchema), validate("json", createTestTokenSchema), async (c) => {
    const created = await createTestToken(workspaceOf(c), c.req.valid("param").id, c.req.valid("json"));
    return c.json<APIResponse<typeof created>>({ data: created }, 201);
  })
  // DELETE /api/v1/apps/:id/test-tokens/:tokenId — revoke (takes effect on the next request)
  .delete("/:id/test-tokens/:tokenId", validate("param", tokenParamSchema), async (c) => {
    const { id, tokenId } = c.req.valid("param");
    const token = await revokeTestToken(workspaceOf(c), id, tokenId);
    return c.json<APIResponse<typeof token>>({ data: token });
  })
  // POST /api/v1/apps/:id/playground-token — 5-minute token for the dashboard Playground
  .post("/:id/playground-token", validate("param", idParamSchema), validate("json", playgroundTokenSchema), async (c) => {
    const token = await createPlaygroundToken(workspaceOf(c), c.req.valid("param").id, c.req.valid("json"));
    return c.json<APIResponse<typeof token>>({ data: token }, 201);
  });

export default appRoute;
