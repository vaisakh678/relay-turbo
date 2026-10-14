import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";

import type { APIResponse } from "./types";

/** zValidator that answers 400 in the standard APIResponse shape. */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      return c.json<APIResponse<null>>({ data: null, error: `${where}${issue?.message ?? "Invalid request"}` }, 400);
    }
  });
