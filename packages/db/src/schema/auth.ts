import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { createdAt, id, updatedAt } from "./helpers";

// Tables owned by Better Auth (apps/api/src/lib/auth.ts). Column sets match
// what Better Auth 1.7 expects (generated with `auth generate`), adapted to
// this repo: UUIDv7 ids, timestamptz, plural table names. The organization
// plugin is renamed to "workspace" throughout (models and fields).
// Property names are what Better Auth reads/writes; don't rename them.

export const userSchema = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessionSchema = pgTable(
  "sessions",
  {
    id: id(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    // The workspace the dashboard is currently scoped to.
    activeWorkspaceId: uuid("active_workspace_id").references(() => workspaceSchema.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accountSchema = pgTable(
  "accounts",
  {
    id: id(),
    // Provider's user ID (or the user ID itself for email/password).
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    // Hashed by Better Auth; only set for email/password accounts.
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verificationSchema = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const workspaceSchema = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: createdAt(),
});

export const workspaceMemberSchema = pgTable(
  "workspace_members",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaceSchema.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    // owner | admin | member (Better Auth's defaults)
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [
    // One membership per user per workspace; also serves workspace_id lookups.
    uniqueIndex("workspace_members_workspace_user_key").on(t.workspaceId, t.userId),
    index("workspace_members_user_idx").on(t.userId),
  ],
);

export const workspaceInvitationSchema = pgTable(
  "workspace_invitations",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaceSchema.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => userSchema.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("workspace_invitations_workspace_idx").on(t.workspaceId),
    index("workspace_invitations_email_idx").on(t.email),
    index("workspace_invitations_inviter_idx").on(t.inviterId),
  ],
);

export type UserRow = typeof userSchema.$inferSelect;
export type WorkspaceRow = typeof workspaceSchema.$inferSelect;
export type WorkspaceMemberRow = typeof workspaceMemberSchema.$inferSelect;
