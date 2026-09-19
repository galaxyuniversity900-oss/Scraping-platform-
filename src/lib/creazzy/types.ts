export type ChatMode = "single" | "critic" | "sequential" | "parallel";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  meta?: {
    model?: string | null;
    provider?: string | null;
    accountId?: string | null;
    latencyMs?: number | null;
    cached?: boolean;
    mode?: string;
    analysis?: string;
  };
};

export type ChatRequest = {
  messages: ChatMessage[];
  mode: ChatMode;
  mcp?: boolean;
};

export type ConnectionInput = {
  provider: string;
  apiKey: string;
  label?: string;
};

export type FileInput = {
  name: string;
  mime: string;
  size: number;
  text?: string;
};

export type ModelInfo = {
  id: string;
  provider: string;
  capabilities: string[];
  priority: number;
  health: { state: string; score?: number };
};

export type OverviewPayload = {
  status: "ok";
  models: ModelInfo[];
  providers: string[];
  accounts: Array<{ id: string; provider: string; label: string; status: string }>;
  accountCount: number;
  tools: Array<{ name: string; server: string }>;
  skills: Array<{ id: string; name: string }>;
  plugins: Array<{ id: string; name: string; enabled: boolean }>;
  health: {
    models: Array<{ id: string; state: string; score: number; latencyMs: number | null }>;
    accounts: Array<{ id: string; state: string; score: number }>;
    providers: Array<{ id: string; state: string; score: number }>;
  };
  quota: Array<{ accountId: string; requests: number; totalTokens: number; source: string; exhausted: boolean }>;
  usage: { requests: number; tokens: number; cost: number };
  logs: Array<{ at: string; type?: string; model?: string; provider?: string; taskClass?: string }>;
  xaiReady: boolean;
};
