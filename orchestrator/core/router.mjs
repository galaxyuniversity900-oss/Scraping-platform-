export class CapabilityRouter {
  constructor(registry) { this.registry = registry; this.policy = null; this.circuitBreaker = null; }

  rank(request = {}) {
    const candidates = this.registry.models
      .filter(m => m.enabled !== false)
      .filter(m => !this.policy || this.policy.accepts(m, request))
      .filter(m => (request.capabilities ?? []).every(c => (m.capabilities ?? []).includes(c)))
      .filter(m => m.health?.state !== "down" && m.health?.state !== "quota_exhausted")
      .filter(m => !this.circuitBreaker || this.circuitBreaker.canTry(m.id));

    return candidates.sort((a,b) => {
      const bs = this.policy?.score ? this.policy.score(b, request) : ((b.health?.score ?? 0) + (b.priority ?? 0));
      const as = this.policy?.score ? this.policy.score(a, request) : ((a.health?.score ?? 0) + (a.priority ?? 0));
      return bs - as;
    });
  }

  async execute(request = {}, invoke) {
    const candidates = this.rank(request);
    if (!candidates.length) throw Object.assign(new Error("NO_CAPABLE_PROVIDER"), {code:"NO_CAPABLE_PROVIDER"});
    const failures = [];
    const maxAttempts = request.maxAttempts ?? this.policy?.forTask?.(request.taskClass)?.maxAttempts ?? 4;

    for (const model of candidates.slice(0, maxAttempts)) {
      try {
        const started = Date.now();
        const result = await invoke(model, request);
        model.health = {state:"healthy", score:Math.min(100,(model.health?.score ?? 80)+5), latencyMs:Date.now()-started};
        this.circuitBreaker?.success(model.id);
        return {model:model.id, result, attempts:failures.length+1};
      } catch (error) {
        const code = error.code || "MODEL_ERROR";
        failures.push({model:model.id, code, message:String(error.message || error)});
        this.circuitBreaker?.failure(model.id);
        if (["AUTH_ERROR","QUOTA_EXHAUSTED","PROVIDER_DOWN"].includes(code))
          model.health = {state: code === "QUOTA_EXHAUSTED" ? "quota_exhausted" : "down", score:0};
        else
          model.health = {...(model.health ?? {}), state:"degraded", score:Math.max(0,(model.health?.score ?? 50)-10)};
      }
    }
    const e = new Error("ALL_MODELS_FAILED"); e.code="ALL_MODELS_FAILED"; e.failures=failures; throw e;
  }
}
