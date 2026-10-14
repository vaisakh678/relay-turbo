import { validate } from "../lib/validate";
import { Hono } from "hono";

import type { APIResponse } from "../lib/types";
import { providerParamSchema, setProviderKeySchema } from "../lib/validators";
import { deleteProviderKey, listProviderKeys, setProviderKey } from "../services/provider-key-service";

// Keys are write-only over the API: responses only ever include a masked preview.
const providerKeyRoute = new Hono()
  // GET /api/v1/provider-keys
  .get("/", async (c) => {
    const keys = await listProviderKeys();
    return c.json<APIResponse<typeof keys>>({ data: keys });
  })
  // PUT /api/v1/provider-keys/:provider
  .put("/:provider", validate("param", providerParamSchema), validate("json", setProviderKeySchema), async (c) => {
    const key = await setProviderKey(c.req.valid("param").provider, c.req.valid("json").apiKey);
    return c.json<APIResponse<typeof key>>({ data: key });
  })
  // DELETE /api/v1/provider-keys/:provider
  .delete("/:provider", validate("param", providerParamSchema), async (c) => {
    const { provider } = c.req.valid("param");
    await deleteProviderKey(provider);
    return c.json<APIResponse<{ provider: string }>>({ data: { provider } });
  });

export default providerKeyRoute;
