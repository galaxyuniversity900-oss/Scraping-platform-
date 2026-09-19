import { adapterError } from "./adapter-contract.mjs";
import { emptyNormalized, usageFrom } from "./response-normalizer.mjs";

export class MockAdapter {
  constructor(definition = {}) {
    this.definition = {
      id: definition.id ?? "mock",
      provider: definition.provider ?? "mock",
      model: definition.model ?? "creazzy-mock",
      capabilities: definition.capabilities ?? [
        "chat",
        "code",
        "reasoning",
        "tool_calling",
        "MCP",
        "files",
        "vision",
        "structured_output"
      ],
      ...definition
    };
    this.calls = 0;
    this.failuresLeft = Number(definition.failTimes ?? 0);
    this.failCode = definition.failCode ?? "RATE_LIMIT";
    this.failMessage = definition.failMessage ?? this.failCode;
    this.connected = false;
  }

  async connect() {
    this.connected = true;
    return { ok: true, provider: this.definition.provider };
  }

  async validate() {
    if (this.definition.invalid) {
      throw adapterError("INVALID_API_KEY", "AUTH_ERROR", { provider: this.definition.provider });
    }
    return { ok: true };
  }

  async listModels() {
    return [
      {
        id: this.definition.model,
        provider: this.definition.provider,
        capabilities: this.definition.capabilities
      }
    ];
  }

  getCapabilities() {
    return [...this.definition.capabilities];
  }

  async healthCheck() {
    if (this.definition.unhealthy) {
      return { state: "down", score: 0 };
    }
    return { state: "healthy", score: 90, latencyMs: 4 };
  }

  async chat(request = {}) {
    this.calls += 1;
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw adapterError(this.failMessage, this.failCode, { provider: this.definition.provider });
    }
    if (this.definition.failCode && this.definition.failTimes == null && this.definition.alwaysFail) {
      throw adapterError(this.failMessage, this.failCode, { provider: this.definition.provider });
    }
    const userText = lastUserText(request.messages);
    const text = this.definition.reply ?? buildReply(userText, request, this.definition);
    const raw = {
      id: `mock-${this.calls}`,
      object: "chat.completion",
      model: request.model ?? this.definition.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: text },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: Math.max(1, Math.ceil(userText.length / 4)),
        completion_tokens: Math.max(1, Math.ceil(text.length / 4)),
        total_tokens: 0
      }
    };
    raw.usage.total_tokens = raw.usage.prompt_tokens + raw.usage.completion_tokens;
    return this.normalizeResponse(raw, {
      model: raw.model,
      provider: this.definition.provider,
      accountId: this.definition.accountId ?? null
    });
  }

  async stream(request = {}, onDelta) {
    const result = await this.chat(request);
    if (typeof onDelta === "function") onDelta(result.text);
    return result;
  }

  countUsage(response) {
    return usageFrom(response?.raw?.usage ?? response?.usage, "reported");
  }

  normalizeResponse(body, meta = {}) {
    if (body?.text != null && body.usage) return { ...body, ...meta };
    return emptyNormalized({
      text: body?.choices?.[0]?.message?.content ?? "",
      usage: usageFrom(body?.usage, "reported"),
      model: meta.model ?? this.definition.model,
      provider: meta.provider ?? this.definition.provider,
      accountId: meta.accountId ?? this.definition.accountId ?? null,
      raw: body
    });
  }
}

function lastUserText(messages = []) {
  const user = [...messages].reverse().find((message) => message.role === "user");
  if (!user) return "";
  return typeof user.content === "string" ? user.content : JSON.stringify(user.content);
}

function buildReply(userText, request, definition) {
  const task = request.taskClass ?? request.analysis?.taskClass ?? "chat";
  const prefix = definition.prefix ?? `[${definition.provider}/${definition.model}]`;
  if (!userText) return `${prefix} ready.`;
  return `${prefix} ${task}: ${userText}`;
}
