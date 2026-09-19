export class QuotaTracker {
  constructor() {
    this.accounts = new Map();
  }

  record(accountId, usage = {}, { provider, model, exhausted = false } = {}) {
    const current = this.accounts.get(accountId) ?? {
      accountId,
      provider: provider ?? null,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      source: "unknown",
      exhausted: false,
      lastModel: null
    };
    current.requests += 1;
    current.provider = provider ?? current.provider;
    current.lastModel = model ?? current.lastModel;
    const source = usage.source ?? "unknown";
    if (source === "reported" || source === "estimated") {
      current.inputTokens += Number(usage.inputTokens ?? 0);
      current.outputTokens += Number(usage.outputTokens ?? 0);
      current.totalTokens += Number(usage.totalTokens ?? 0);
      current.source = source;
    }
    if (exhausted || source === "exhausted") {
      current.exhausted = true;
      current.source = "exhausted";
    }
    this.accounts.set(accountId, current);
    return { ...current };
  }

  markExhausted(accountId, provider) {
    return this.record(accountId, { source: "exhausted" }, { provider, exhausted: true });
  }

  get(accountId) {
    return this.accounts.get(accountId) ?? null;
  }

  list() {
    return [...this.accounts.values()];
  }
}
