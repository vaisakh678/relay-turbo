import db, { sessionSchema, workspaceMemberSchema } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { Forbidden, Unauthorized } from "../lib/api-error";
import { auth, firstWorkspaceId } from "../lib/auth";

export type WorkspaceRole = "owner" | "admin" | "member";

export type DashboardAuth = {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
};

export type AppEnv = { Variables: { auth: DashboardAuth } };

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Dashboard routes: a signed-in session with an active workspace the user is
 * a member of. Members are read-only; owners and admins can change things
 * (Better Auth's default role semantics).
 */
export const requireWorkspace = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) throw Unauthorized("Sign in required");

  let workspaceId = result.session.activeOrganizationId;
  if (!workspaceId) {
    // Sign-up creates the session a moment before the user's workspace exists, and a
    // deleted workspace clears it; fall back to the user's first workspace and remember it.
    workspaceId = await firstWorkspaceId(result.user.id);
    if (!workspaceId) throw Forbidden("No workspace: create one to continue");
    await db.update(sessionSchema).set({ activeWorkspaceId: workspaceId }).where(eq(sessionSchema.id, result.session.id));
  }

  // The session only stores the ID; confirm membership (and get the role) on every request
  const [member] = await db
    .select({ role: workspaceMemberSchema.role })
    .from(workspaceMemberSchema)
    .where(and(eq(workspaceMemberSchema.workspaceId, workspaceId), eq(workspaceMemberSchema.userId, result.user.id)))
    .limit(1);
  if (!member) throw Forbidden("Not a member of this workspace");

  const role = member.role as WorkspaceRole;
  if (role === "member" && !READ_METHODS.has(c.req.method)) throw Forbidden("Your role in this workspace is read-only");

  c.set("auth", { userId: result.user.id, email: result.user.email, workspaceId, role });
  await next();
});
