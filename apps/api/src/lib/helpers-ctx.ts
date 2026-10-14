import type { Context } from "hono";

import type { AppEnv } from "../middleware/auth";

/** The active workspace of the signed-in dashboard user (set by requireWorkspace). */
export const workspaceOf = (c: Context<AppEnv>) => c.get("auth").workspaceId;
