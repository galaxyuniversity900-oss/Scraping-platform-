export function emptyNormalized(partial = {}) {
  return {
    text: "",
    reasoning: null,
    toolCalls: [],
    mcpCalls: [],
    structuredOutput: null,
    usage: { inputTokens: null, outputTokens: null, totalTokens: null, source: "unknown" },
    model: null,
    provider: null,
    accountId: null,
    error: null,
    raw: null,
    ...partial
  };
}

export function usageFrom(raw, source = "reported") {
  if (!raw || typeof raw !== "object") {
    return { inputTokens: null, outputTokens: null, totalTokens: null, source: "unknown" };
  }
  const input =
    raw.prompt_tokens ??
    raw.input_tokens ??
    raw.promptTokenCount ??
    null;
  const output =
    raw.completion_tokens ??
    raw.output_tokens ??
    raw.candidatesTokenCount ??
    null;
  const total = raw.total_tokens ?? raw.totalTokenCount ?? (input != null && output != null ? input + output : null);
  const hasAny = input != null || output != null || total != null;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    source: hasAny ? source : "unknown"
  };
}

export function normalizeOpenAI(body, meta = {}) {
  const choice = body?.choices?.[0];
  const message = choice?.message ?? {};
  const toolCalls = (message.tool_calls ?? []).map((call) => ({
    id: call.id,
    name: call.function?.name,
    arguments: safeJson(call.function?.arguments)
  }));
  return emptyNormalized({
    text: message.content ?? "",
    reasoning: message.reasoning_content ?? message.reasoning ?? null,
    toolCalls,
    usage: usageFrom(body?.usage, "reported"),
    model: body?.model ?? meta.model ?? null,
    provider: meta.provider ?? null,
    accountId: meta.accountId ?? null,
    raw: body
  });
}

export function normalizeAnthropic(body, meta = {}) {
  const text = (body?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const toolCalls = (body?.content ?? [])
    .filter((part) => part.type === "tool_use")
    .map((part) => ({ id: part.id, name: part.name, arguments: part.input }));
  return emptyNormalized({
    text,
    toolCalls,
    usage: usageFrom(body?.usage, "reported"),
    model: body?.model ?? meta.model ?? null,
    provider: meta.provider ?? "anthropic",
    accountId: meta.accountId ?? null,
    raw: body
  });
}

export function normalizeGoogle(body, meta = {}) {
  const candidate = body?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("");
  return emptyNormalized({
    text,
    usage: usageFrom(body?.usageMetadata, "reported"),
    model: meta.model ?? null,
    provider: meta.provider ?? "google",
    accountId: meta.accountId ?? null,
    raw: body
  });
}

export function normalizeResponse(body, meta = {}) {
  if (!body || typeof body !== "object") return emptyNormalized({ ...meta, raw: body });
  if (body.text != null && body.usage && body.provider != null && body.raw !== undefined) {
    return { ...emptyNormalized(), ...body, ...meta };
  }
  if (Array.isArray(body.choices)) return normalizeOpenAI(body, meta);
  if (Array.isArray(body.content) && (body.type === "message" || body.role === "assistant" || body.stop_reason)) {
    return normalizeAnthropic(body, meta);
  }
  if (Array.isArray(body.candidates)) return normalizeGoogle(body, meta);
  if (typeof body.text === "string") return emptyNormalized({ ...meta, text: body.text, raw: body });
  return emptyNormalized({ ...meta, text: JSON.stringify(body), raw: body });
}

function safeJson(value) {
  if (value == null) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return { raw: String(value) };
  }
}
