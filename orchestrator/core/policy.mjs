export class RoutingPolicy {
  constructor(config = {}) {
    this.maxAttempts = config.maxAttempts ?? 4;
    this.maxParallel = config.maxParallel ?? 4;
    this.requireHealthy = config.requireHealthy ?? true;
    this.preferredProviders = config.preferredProviders ?? [];
    this.excludedProviders = new Set(config.excludedProviders ?? []);
    this.taskPolicies = config.taskPolicies ?? {};
  }
  forTask(taskClass = "default") {
    return {...(this.taskPolicies.default ?? {}), ...(this.taskPolicies[taskClass] ?? {}), maxAttempts: this.taskPolicies[taskClass]?.maxAttempts ?? this.maxAttempts};
  }
  accepts(model, request) {
    if (model.enabled === false || this.excludedProviders.has(model.provider)) return false;
    if (this.requireHealthy && ["down","auth_error","quota_exhausted"].includes(model.health?.state)) return false;
    return (request.capabilities ?? []).every(cap => (model.capabilities ?? []).includes(cap));
  }
  score(model, request) {
    let score = model.priority ?? 50;
    const i = this.preferredProviders.indexOf(model.provider);
    if (i >= 0) score += 40 - i * 5;
    if (request.preferredProvider === model.provider) score += 35;
    if (request.preferredModel === model.id) score += 60;
    if (model.health?.state === "degraded") score -= 25;
    if (typeof model.health?.latencyMs === "number") score -= Math.min(25, model.health.latencyMs / 200);
    return score;
  }
}
