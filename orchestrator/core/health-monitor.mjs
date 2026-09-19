const STATES = new Set([
  "healthy",
  "degraded",
  "down",
  "quota_exhausted",
  "auth_error",
  "rate_limited",
  "unknown"
]);

function blank(id, kind) {
  return {
    id,
    kind,
    state: "unknown",
    score: 50,
    lastSuccessAt: null,
    lastFailureAt: null,
    failureCount: 0,
    successCount: 0,
    latencyMs: null,
    quota: "unknown",
    auth: "unknown",
    cooldownUntil: 0,
    circuit: "closed",
    lastError: null
  };
}

export class HealthMonitor {
  constructor() {
    this.accounts = new Map();
    this.providers = new Map();
    this.models = new Map();
  }

  snapshot(id, kind = "model") {
    const bag = this.bag(kind);
    return { ...(bag.get(id) ?? blank(id, kind)) };
  }

  recordSuccess({ id, kind = "model", provider, latencyMs, circuit = "closed" } = {}) {
    const item = this.touch(id, kind);
    item.state = "healthy";
    item.score = Math.min(100, (item.score ?? 50) + 8);
    item.lastSuccessAt = Date.now();
    item.successCount += 1;
    item.failureCount = Math.max(0, item.failureCount - 1);
    item.latencyMs = latencyMs ?? item.latencyMs;
    item.auth = "ok";
    item.circuit = circuit;
    item.lastError = null;
    item.cooldownUntil = 0;
    if (provider) this.rollProvider(provider, true, latencyMs);
    return this.snapshot(id, kind);
  }

  recordFailure({ id, kind = "model", provider, code, message, cooldownMs = 0, circuit = "closed" } = {}) {
    const item = this.touch(id, kind);
    item.state = stateFromCode(code);
    item.score = Math.max(0, (item.score ?? 50) - 15);
    item.lastFailureAt = Date.now();
    item.failureCount += 1;
    item.lastError = { code: code ?? "MODEL_ERROR", message: String(message ?? code ?? "error") };
    item.circuit = circuit;
    item.cooldownUntil = cooldownMs ? Date.now() + cooldownMs : 0;
    if (code === "AUTH_ERROR") item.auth = "error";
    if (code === "QUOTA_EXHAUSTED") item.quota = "exhausted";
    if (provider) this.rollProvider(provider, false, null, code);
    return this.snapshot(id, kind);
  }

  summarize() {
    return {
      accounts: [...this.accounts.values()],
      providers: [...this.providers.values()],
      models: [...this.models.values()]
    };
  }

  bag(kind) {
    if (kind === "account") return this.accounts;
    if (kind === "provider") return this.providers;
    return this.models;
  }

  touch(id, kind) {
    const bag = this.bag(kind);
    if (!bag.has(id)) bag.set(id, blank(id, kind));
    return bag.get(id);
  }

  rollProvider(provider, ok, latencyMs, code) {
    if (ok) this.recordSuccess({ id: provider, kind: "provider", latencyMs });
    else this.recordFailure({ id: provider, kind: "provider", code });
  }
}

function stateFromCode(code) {
  if (code === "QUOTA_EXHAUSTED") return "quota_exhausted";
  if (code === "AUTH_ERROR") return "auth_error";
  if (code === "RATE_LIMIT") return "rate_limited";
  if (code === "PROVIDER_DOWN") return "down";
  if (!STATES.has(code)) return "degraded";
  return code;
}
