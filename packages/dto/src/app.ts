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
