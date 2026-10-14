import db, {
  accountSchema,
  sessionSchema,
  userSchema,
  verificationSchema,
  workspaceInvitationSchema,
  workspaceMemberSchema,
  workspaceSchema,
} from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, organization } from "better-auth/plugins";
import { asc, eq, notExists } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import { env } from "../config/env";
import { slugify } from "./helpers";
import { sendEmail } from "./mailer";
import { logger } from "./logger";

const social = <T extends string | undefined>(clientId: T, clientSecret: T) =>
  clientId && clientSecret ? { clientId, clientSecret } : undefined;

/**
 * New users get a workspace straight away. On a fresh install the first
 * user claims the "Default workspace" (the one the migration/seed put
 * existing apps in) if nobody owns it yet; everyone else gets their own.
 */
async function provisionWorkspace(user: { id: string; name: string; email: string }) {
  await db.transaction(async (tx) => {
    const [unclaimed] = await tx
      .select({ id: workspaceSchema.id })
      .from(workspaceSchema)
      .where(
        notExists(tx.select().from(workspaceMemberSchema).where(eq(workspaceMemberSchema.workspaceId, workspaceSchema.id))),
      )
      .orderBy(asc(workspaceSchema.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    let workspaceId = unclaimed?.id;
    if (!workspaceId) {
      const base = slugify(user.name || user.email.split("@")[0]!) || "workspace";
      const [created] = await tx
        .insert(workspaceSchema)
        .values({ name: `${user.name || "My"}'s workspace`, slug: `${base}-${uuidv7().slice(-6)}` })
        .returning({ id: workspaceSchema.id });
      workspaceId = created!.id;
    }
    await tx.insert(workspaceMemberSchema).values({ workspaceId, userId: user.id, role: "owner" });
    logger.info({ userId: user.id, workspaceId, claimed: !!unclaimed }, "Provisioned workspace for new user");
  });
}

/** The user's oldest membership, used as the active workspace for new sessions. */
export async function firstWorkspaceId(userId: string): Promise<string | null> {
  const [m] = await db
    .select({ workspaceId: workspaceMemberSchema.workspaceId })
    .from(workspaceMemberSchema)
    .where(eq(workspaceMemberSchema.userId, userId))
    .orderBy(asc(workspaceMemberSchema.createdAt))
    .limit(1);
  return m?.workspaceId ?? null;
}

export const auth = betterAuth({
  appName: "Relay",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.WEB_ORIGINS,
  database: drizzleAdapter(db, {
    provider: "pg",
    // Keys are Better Auth's model names (organization models renamed below)
    schema: {
      user: userSchema,
      session: sessionSchema,
      account: accountSchema,
      verification: verificationSchema,
      workspace: workspaceSchema,
      workspaceMember: workspaceMemberSchema,
      workspaceInvitation: workspaceInvitationSchema,
    },
  }),
  // Email sign-in is passwordless (emailOTP below); no passwords to leak or reset.
  emailAndPassword: { enabled: false },
  account: {
    // Signing in with Google, then GitHub (same verified email) lands on one Relay user
    // instead of failing; both providers verify the email address they report.
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
  },
  socialProviders: {
    google: social(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    github: social(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
  },
  advanced: {
    // Same time-ordered UUIDs as the rest of the schema
    database: { generateId: () => uuidv7() },
  },
  plugins: [
    // Passwordless email sign-in: a 6-digit code, 5-minute expiry, 3 attempts.
    // Also creates the account on first use (sign-up and sign-in are one flow).
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      // Only a hash is stored, so a database leak doesn't expose live codes
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }) {
        // Not awaited: response time shouldn't reveal whether an email was sent
        void sendEmail({
          to: email,
          subject: `${otp} is your Relay sign-in code`,
          text: `Your Relay sign-in code is ${otp}. It expires in 5 minutes. If you didn't request it, ignore this email.`,
        });
      },
    }),
    organization({
      // "Organization" is "workspace" everywhere in Relay: tables, fields and UI.
      schema: {
        organization: { modelName: "workspace" },
        member: { modelName: "workspaceMember", fields: { organizationId: "workspaceId" } },
        invitation: { modelName: "workspaceInvitation", fields: { organizationId: "workspaceId" } },
        session: { fields: { activeOrganizationId: "activeWorkspaceId" } },
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: { after: async (user) => provisionWorkspace(user) },
    },
    session: {
      create: {
        before: async (session) => ({
          data: { ...session, activeOrganizationId: await firstWorkspaceId(session.userId) },
        }),
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;

/** Which social providers are configured, so the login page only offers working buttons. */
export const enabledSocialProviders = {
  google: !!social(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  github: !!social(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
};
