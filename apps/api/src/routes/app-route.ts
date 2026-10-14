import { validate } from "../lib/validate";
import { Hono } from "hono";

import type { APIResponse } from "../lib/types";
import {
  createAppSchema,
  idParamSchema,
  publishPromptSchema,
  replaceLimitsSchema,
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

const appRoute = new Hono()
  // GET /api/v1/apps
  .get("/", async (c) => {
    const apps = await listApps();
    return c.json<APIResponse<typeof apps>>({ data: apps });
  })
  // POST /api/v1/apps — creates v1 prompt + default free/pro limits
  .post("/", validate("json", createAppSchema), async (c) => {
    const app = await createApp(c.req.valid("json"));
    return c.json<APIResponse<typeof app>>({ data: app }, 201);
  })
  // GET /api/v1/apps/:id — includes prompt history and limits
  .get("/:id", validate("param", idParamSchema), async (c) => {
    const app = await getApp(c.req.valid("param").id);
    return c.json<APIResponse<typeof app>>({ data: app });
  })
  // PATCH /api/v1/apps/:id — model, status, webhook, etc.
  .patch("/:id", validate("param", idParamSchema), validate("json", updateAppSchema), async (c) => {
    const app = await updateApp(c.req.valid("param").id, c.req.valid("json"));
    return c.json<APIResponse<typeof app>>({ data: app });
  })
  // DELETE /api/v1/apps/:id — soft delete
  .delete("/:id", validate("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    await deleteApp(id);
    return c.json<APIResponse<{ id: string }>>({ data: { id } });
  })
  // GET /api/v1/apps/:id/secret — full signing secret (reveal/copy in the dashboard)
  .get("/:id/secret", validate("param", idParamSchema), async (c) => {
    const signingSecret = await revealSigningSecret(c.req.valid("param").id);
    return c.json<APIResponse<{ signingSecret: string }>>({ data: { signingSecret } });
  })
  // POST /api/v1/apps/:id/secret/rotate
  .post("/:id/secret/rotate", validate("param", idParamSchema), async (c) => {
    const signingSecret = await rotateSigningSecret(c.req.valid("param").id);
    return c.json<APIResponse<{ signingSecret: string }>>({ data: { signingSecret } });
  })
  // POST /api/v1/apps/:id/prompts — publish a new version and make it live
  .post("/:id/prompts", validate("param", idParamSchema), validate("json", publishPromptSchema), async (c) => {
    const prompt = await publishPrompt(c.req.valid("param").id, c.req.valid("json"));
    return c.json<APIResponse<typeof prompt>>({ data: prompt }, 201);
  })
  // POST /api/v1/apps/:id/prompts/:version/activate — roll back/forward
  .post("/:id/prompts/:version/activate", validate("param", versionParamSchema), async (c) => {
    const { id, version } = c.req.valid("param");
    await activatePromptVersion(id, version);
    return c.json<APIResponse<{ activePromptVersion: number }>>({ data: { activePromptVersion: version } });
  })
  // PUT /api/v1/apps/:id/limits — replace all plan limits
  .put("/:id/limits", validate("param", idParamSchema), validate("json", replaceLimitsSchema), async (c) => {
    const limits = await replaceLimits(c.req.valid("param").id, c.req.valid("json").limits);
    return c.json<APIResponse<typeof limits>>({ data: limits });
  });

export default appRoute;
