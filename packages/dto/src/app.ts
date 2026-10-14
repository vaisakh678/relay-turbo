import type { AppStatus, Provider } from "./common";

export interface AppDTO {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  status: AppStatus;
  provider: Provider;
  model: string;
  temperature: number;
  webhookUrl: string | null;
  /** Kill switch for dashboard-issued test tokens. */
  allowTestTokens: boolean;
  activePromptVersion: number;
  /** Masked; fetch GET /apps/:id/secret for the real value. */
  signingSecretPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersionDTO {
  version: number;
  content: string;
  note: string;
  createdAt: string;
}

export interface PlanLimitDTO {
  plan: string;
  messagesPerDay: number;
  maxOutputTokens: number;
}

export interface AppDetailDTO extends AppDTO {
  prompts: PromptVersionDTO[];
  limits: PlanLimitDTO[];
}

export interface ProviderKeyDTO {
  provider: Provider;
  configured: boolean;
  preview: string | null;
  updatedAt: string | null;
}

export interface TestTokenDTO {
  /** Also the token's `jti`. */
  id: string;
  label: string;
  user: string;
  plan: string;
  vars: Record<string, string>;
  status: "active" | "expired" | "revoked";
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/** POST /apps/:id/test-tokens — the token string is only ever returned here. */
export interface CreatedTestTokenDTO {
  token: string;
  testToken: TestTokenDTO;
}

export interface PlaygroundTokenDTO {
  token: string;
  expiresAt: string;
}
