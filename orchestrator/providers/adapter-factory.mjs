import { getConnector } from "./connectors.mjs";
import { OpenAICompatibleAdapter } from "./openai-compatible.mjs";
import { AnthropicAdapter } from "./anthropic-adapter.mjs";
import { GoogleAdapter } from "./google-adapter.mjs";
import { MockAdapter } from "./mock-adapter.mjs";
import { adapterError, assertAdapter, mapHttpError } from "./adapter-contract.mjs";
import { normalizeResponse } from "./response-normalizer.mjs";

export function createAdapter(definition = {}) {
  const provider = definition.provider ?? definition.id;
  if (!provider) throw adapterError("PROVIDER_REQUIRED", "CONFIGURATION_ERROR");
  if (provider === "mock" || definition.family === "mock") {
    const secret = String(definition.apiKey ?? "");
    const fail =
      secret.startsWith("fail:")
        ? { alwaysFail: true, failCode: secret.slice(5) || "RATE_LIMIT", failMessage: secret.slice(5) || "RATE_LIMIT" }
        : {};
    return assertAdapter(new MockAdapter({ ...definition, ...fail }));
  }

  const connector = getConnector(provider);
  const baseUrl = definition.baseUrl ?? connector?.baseUrl;
  const family =
    definition.family ??
    (provider === "anthropic" ? "anthropic" : provider === "google" ? "google" : "openai-compatible");

  let inner;
  if (family === "anthropic" || provider === "anthropic") {
    inner = new AnthropicAdapter({
      apiKey: definition.apiKey,
      baseUrl,
      model: definition.model,
      timeoutMs: definition.timeoutMs
    });
  } else if (family === "google" || provider === "google") {
    inner = new GoogleAdapter({
      apiKey: definition.apiKey,
      baseUrl,
      model: definition.model,
      timeoutMs: definition.timeoutMs
    });
  } else {
    inner = new OpenAICompatibleAdapter({
      ...definition,
      id: definition.id ?? provider,
      provider,
      baseUrl: baseUrl ?? "https://api.openai.com/v1",
      apiKey: definition.apiKey,
      model: definition.model
    });
  }

  return assertAdapter(new ContractAdapter(inner, { ...definition, provider, baseUrl, family }));
}

class ContractAdapter {
  constructor(inner, definition) {
    this.inner = inner;
    this.definition = definition;
  }

  async connect() {
    return { ok: true, provider: this.definition.provider };
  }

  async validate() {
    const health = await this.healthCheck();
    if (health.state === "auth_error") {
      throw adapterError("INVALID_API_KEY", "AUTH_ERROR", { provider: this.definition.provider });
    }
    return { ok: health.state !== "down", health };
  }

  async listModels() {
    if (typeof this.inner.listModels === "function") return this.inner.listModels();
    const baseUrl = (this.definition.baseUrl ?? "").replace(/\/$/, "");
    if (!baseUrl) return [{ id: this.definition.model, provider: this.definition.provider }];
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: this.inner.headers?.() ?? (this.definition.apiKey ? { Authorization: `Bearer ${this.definition.apiKey}` } : {})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw mapHttpError(response.status, body, this.definition.provider);
      return (body.data ?? []).map((model) => ({
        id: model.id,
        provider: this.definition.provider,
        capabilities: this.definition.capabilities ?? ["chat"]
      }));
    } catch (error) {
      if (error.code) throw error;
      throw adapterError(String(error.message || error), "NETWORK_ERROR", { provider: this.definition.provider });
    }
  }

  getCapabilities() {
    return this.definition.capabilities ?? ["chat"];
  }

  async healthCheck() {
    if (typeof this.inner.health === "function") {
      try {
        const result = await this.inner.health();
        return result?.state ? result : { state: "healthy", ...result };
      } catch (error) {
        return {
          state: error.code === "AUTH_ERROR" ? "auth_error" : error.code === "RATE_LIMIT" ? "rate_limited" : "down",
          score: 0,
          error: error.code ?? "PROVIDER_DOWN"
        };
      }
    }
    return { state: "unknown", score: 50 };
  }

  async chat(request = {}) {
    try {
      const raw = await this.inner.invoke({
        ...request,
        model: request.model ?? this.definition.model
      });
      return this.normalizeResponse(raw, {
        model: request.model ?? this.definition.model,
        provider: this.definition.provider,
        accountId: this.definition.accountId ?? null
      });
    } catch (error) {
      if (error.code) throw error;
      throw adapterError(String(error.message || error), "MODEL_ERROR", { provider: this.definition.provider });
    }
  }

  async stream(request = {}, onDelta) {
    const result = await this.chat(request);
    if (typeof onDelta === "function" && result.text) onDelta(result.text);
    return result;
  }

  countUsage(response) {
    return response?.usage ?? { inputTokens: null, outputTokens: null, totalTokens: null, source: "unknown" };
  }

  normalizeResponse(body, meta = {}) {
    return normalizeResponse(body, {
      provider: this.definition.provider,
      model: this.definition.model,
      accountId: this.definition.accountId ?? null,
      ...meta
    });
  }
}
