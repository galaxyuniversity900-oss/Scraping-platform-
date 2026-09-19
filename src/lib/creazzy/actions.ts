import { createServerFn } from "@tanstack/react-start";
import type { ChatRequest, ConnectionInput, FileInput, OverviewPayload } from "./types";

export const getOverview = createServerFn({ method: "POST" }).handler(async (): Promise<OverviewPayload> => {
  const { getRuntime } = await import("./runtime.server.ts");
  const runtime = getRuntime();
  const models: OverviewPayload["models"] = runtime.registry.models.map((model: {
    id: string;
    provider: string;
    capabilities?: string[];
    priority?: number;
    health?: { state?: string; score?: number };
  }) => ({
    id: String(model.id),
    provider: String(model.provider),
    capabilities: Array.isArray(model.capabilities) ? model.capabilities.map(String) : [],
    priority: Number(model.priority ?? 0),
    health: { state: String(model.health?.state ?? "unknown"), score: Number(model.health?.score ?? 50) },
  }));
  const connections = runtime.connections ? runtime.connections.list() : [];
  const summary = runtime.health.summarize();
  const tools = runtime.mcpAggregator.discover();
  const providers: string[] = [];
  for (const model of models) {
    if (!providers.includes(model.provider)) providers.push(model.provider);
  }
  return {
    status: "ok",
    models,
    providers,
    accounts: connections.map((account: { id: string; provider: string; label?: string; status?: string }) => ({
      id: String(account.id),
      provider: String(account.provider),
      label: String(account.label ?? ""),
      status: String(account.status ?? "stored"),
    })),
    accountCount: connections.length,
    tools: tools.map((tool: { name: string; server: string }) => ({
      name: String(tool.name),
      server: String(tool.server),
    })),
    skills: [...runtime.skills.skills.values()].map((skill: { id: string; name: string }) => ({
      id: String(skill.id),
      name: String(skill.name),
    })),
    plugins: runtime.plugins.list().map((plugin: { id: string; name: string; enabled: boolean }) => ({
      id: String(plugin.id),
      name: String(plugin.name),
      enabled: Boolean(plugin.enabled),
    })),
    health: {
      models: (summary.models ?? []).map((item: { id: string; state: string; score: number; latencyMs?: number | null }) => ({
        id: String(item.id),
        state: String(item.state),
        score: Number(item.score ?? 0),
        latencyMs: item.latencyMs == null ? null : Number(item.latencyMs),
      })),
      accounts: (summary.accounts ?? []).map((item: { id: string; state: string; score: number }) => ({
        id: String(item.id),
        state: String(item.state),
        score: Number(item.score ?? 0),
      })),
      providers: (summary.providers ?? []).map((item: { id: string; state: string; score: number }) => ({
        id: String(item.id),
        state: String(item.state),
        score: Number(item.score ?? 0),
      })),
    },
    quota: runtime.quota.list().map((item: {
      accountId: string;
      requests: number;
      totalTokens: number;
      source: string;
      exhausted: boolean;
    }) => ({
      accountId: String(item.accountId),
      requests: Number(item.requests ?? 0),
      totalTokens: Number(item.totalTokens ?? 0),
      source: String(item.source ?? "unknown"),
      exhausted: Boolean(item.exhausted),
    })),
    usage: {
      requests: Number(runtime.usage.totals().requests ?? 0),
      tokens: Number(runtime.usage.totals().tokens ?? 0),
      cost: Number(runtime.usage.totals().cost ?? 0),
    },
    logs: (runtime.logs ?? []).map((log: Record<string, unknown>) => ({
      at: String(log.at ?? ""),
      type: log.type ? String(log.type) : undefined,
      model: log.model ? String(log.model) : undefined,
      provider: log.provider ? String(log.provider) : undefined,
      taskClass: log.taskClass ? String(log.taskClass) : undefined,
    })),
    xaiReady: Boolean(process.env.XAI_API_KEY),
  };
});

export const listConnectors = createServerFn({ method: "POST" }).handler(async () => {
  const { listConnectors: list } = await import("../../../orchestrator/providers/connectors.mjs");
  return {
    connectors: list().map((connector: { id: string; baseUrl: string; adapter: string; authEnv: string | null }) => ({
      id: connector.id,
      baseUrl: connector.baseUrl,
      adapter: connector.adapter,
      auth: connector.authEnv ? "api_key" : "none",
    })),
  };
});

export const addConnection = createServerFn({ method: "POST" })
  .validator((input: ConnectionInput) => {
    if (!input?.provider || !input?.apiKey) throw new Error("Provider and API key are required");
    return {
      provider: String(input.provider).slice(0, 64),
      apiKey: String(input.apiKey).slice(0, 512),
      label: String(input.label ?? "").slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    const { getRuntime } = await import("./runtime.server.ts");
    const { getConnector } = await import("../../../orchestrator/providers/connectors.mjs");
    const { completeDeepSeekConnection } = await import("../../../orchestrator/auth/deepseek-flow.mjs");
    const runtime = getRuntime();
    if (!runtime.connections) throw new Error("Vault is not available");
    const connector = getConnector(data.provider);
    let id: string;
    if (data.provider === "deepseek") {
      id = completeDeepSeekConnection({
        connectionManager: runtime.connections,
        apiKey: data.apiKey,
        label: data.label,
      });
    } else {
      id = runtime.connections.add({
        provider: data.provider,
        secret: data.apiKey,
        label: data.label,
      });
    }
    if (connector && !runtime.registry.models.some((model: { provider: string }) => model.provider === data.provider)) {
      runtime.registry.register({
        id: `${data.provider}-default`,
        provider: data.provider,
        family: data.provider === "anthropic" || data.provider === "google" ? data.provider : "openai-compatible",
        baseUrl: connector.baseUrl,
        capabilities: ["chat", "code", "reasoning"],
        priority: 72,
        health: { state: "unknown", score: 50 },
      });
    }
    return { ok: true as const, connectionId: id, provider: data.provider };
  });

export const sendChat = createServerFn({ method: "POST" })
  .validator((input: ChatRequest & { files?: FileInput[] }) => ({
    messages: (input.messages ?? []).slice(-24).map((message) => ({
      role: message.role,
      content: String(message.content ?? "").slice(0, 8000),
    })),
    mode: input.mode ?? "single",
    mcp: Boolean(input.mcp),
    files: (input.files ?? []).slice(0, 4).map((file) => ({
      name: String(file.name).slice(0, 120),
      mime: String(file.mime || "application/octet-stream"),
      size: Number(file.size || 0),
      text: file.text ? String(file.text).slice(0, 20_000) : undefined,
    })),
  }))
  .handler(async ({ data }) => {
    const { getRuntime } = await import("./runtime.server.ts");
    const runtime = getRuntime();
    const userMessages = data.messages.filter((message) => message.role !== "system");
    if (!userMessages.length) return { ok: false as const, error: "Write a message first." };
    try {
      const result = await runtime.execution.chat({
        messages: userMessages,
        mode: data.mode,
        mcp: data.mcp ? [{ name: "creazzy-local__lookup", arguments: { query: userMessages.at(-1)?.content ?? "" } }] : undefined,
        files: data.files,
        max_tokens: 512,
        maxAttempts: 4,
      });
      return {
        ok: true as const,
        text: String(result.text ?? ""),
        model: result.model ? String(result.model) : null,
        provider: result.provider ? String(result.provider) : null,
        accountId: result.accountId ? String(result.accountId) : null,
        latencyMs: result.latencyMs == null ? null : Number(result.latencyMs),
        cached: Boolean(result.cached),
        analysis: String(result.analysis?.taskClass ?? "chat"),
        capabilities: Array.isArray(result.analysis?.capabilities) ? result.analysis.capabilities.map(String) : [],
        mcpCalls: Array.isArray(result.mcpCalls)
          ? result.mcpCalls.map((call: { name?: string; server?: string; ok?: boolean }) => ({
              name: String(call.name ?? ""),
              server: String(call.server ?? ""),
              ok: Boolean(call.ok),
            }))
          : [],
        usage: result.usage
          ? {
              inputTokens: result.usage.inputTokens == null ? null : Number(result.usage.inputTokens),
              outputTokens: result.usage.outputTokens == null ? null : Number(result.usage.outputTokens),
              totalTokens: result.usage.totalTokens == null ? null : Number(result.usage.totalTokens),
              source: String(result.usage.source ?? "unknown"),
            }
          : null,
      };
    } catch (error) {
      const err = error as { message?: string; code?: string };
      return { ok: false as const, error: err.message || "Request failed", code: err.code ?? "ERROR" };
    }
  });

export const runMcp = createServerFn({ method: "POST" })
  .validator((input: { name: string; query?: string }) => ({
    name: String(input.name).slice(0, 120),
    query: String(input.query ?? "").slice(0, 400),
  }))
  .handler(async ({ data }) => {
    const { getRuntime } = await import("./runtime.server.ts");
    const runtime = getRuntime();
    const result = await runtime.mcpExecutor.execute(data.name, { query: data.query });
    return {
      ok: true as const,
      result: {
        name: String(result.name),
        server: String(result.server),
        ok: Boolean(result.ok),
        payload: JSON.stringify(result.result ?? null),
      },
    };
  });
