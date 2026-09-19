import { randomUUID } from "node:crypto";
import { createAdapter } from "../providers/adapter-factory.mjs";
import {
  adapterError,
  shouldFailoverAccount,
  shouldFailoverProvider
} from "../providers/adapter-contract.mjs";

export class FailoverEngine {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async chat(request = {}) {
    const requestId = request.requestId ?? randomUUID();
    const conversationId = request.conversationId ?? requestId;
    const analysis = request.analysis ?? this.runtime.analyzer.analyze(request);
    const plan = this.runtime.scheduler.plan({
      ...request,
      capabilities: analysis.capabilities,
      taskClass: analysis.taskClass
    });
    if (!plan.candidates.length) {
      throw adapterError("NO_CAPABLE_PROVIDER", "NO_CAPABLE_PROVIDER", { requestId, conversationId });
    }

    const failures = [];
    const continuity = {
      requestId,
      conversationId,
      system: request.system,
      skills: request.skills,
      tools: request.tools,
      mcp: request.mcp,
      files: request.files,
      messages: request.messages
    };

    for (const modelId of plan.candidates.slice(0, plan.maxAttempts)) {
      const model = this.runtime.registry.models.find((item) => item.id === modelId);
      if (!model) continue;
      try {
        return await this.tryModel(model, { ...request, ...continuity, analysis });
      } catch (error) {
        failures.push({
          model: model.id,
          provider: model.provider,
          code: error.code ?? "MODEL_ERROR",
          message: String(error.message || error)
        });
        this.runtime.circuitBreaker?.failure(model.id);
        this.runtime.health.recordFailure({
          id: model.id,
          kind: "model",
          provider: model.provider,
          code: error.code,
          message: error.message
        });
        if (!shouldFailoverProvider(error) && !shouldFailoverAccount(error) && error.code === "INVALID_REQUEST") {
          error.failures = failures;
          error.continuity = continuity;
          throw error;
        }
      }
    }

    const error = adapterError("ALL_MODELS_FAILED", "ALL_MODELS_FAILED", { failures, continuity });
    throw error;
  }

  async tryModel(model, request) {
    if (model.adapter) {
      return this.invokeAdapter(model, model.adapter, null, request);
    }

    const accounts = this.runtime.accountPool.candidates(model.provider);
    if (!accounts.length) {
      try {
        const lease = this.runtime.accountPool.lease(model.provider);
        return await this.invokeLeased(model, lease, request);
      } catch (error) {
        if (error.code === "NO_CREDENTIAL" || error.code === "NO_AVAILABLE_CONNECTION") {
          throw adapterError(`No eligible account for ${model.provider}`, "NO_AVAILABLE_CONNECTION", {
            provider: model.provider
          });
        }
        throw error;
      }
    }

    let lastError = null;
    for (const candidate of accounts) {
      let lease;
      try {
        lease = this.runtime.accountPool.lease(model.provider);
      } catch (error) {
        lastError = error;
        continue;
      }
      try {
        return await this.invokeLeased(model, lease, request);
      } catch (error) {
        lastError = error;
        lease.report?.(false, error.code);
        this.runtime.health.recordFailure({
          id: lease.id,
          kind: "account",
          provider: model.provider,
          code: error.code,
          message: error.message
        });
        if (error.code === "QUOTA_EXHAUSTED") {
          this.runtime.quota.markExhausted(lease.id, model.provider);
        }
        if (!shouldFailoverAccount(error)) throw error;
      }
    }
    throw lastError ?? adapterError("NO_AVAILABLE_CONNECTION", "NO_AVAILABLE_CONNECTION", {
      provider: model.provider
    });
  }

  async invokeLeased(model, lease, request) {
    const adapter = createAdapter({
      provider: model.provider,
      apiKey: lease.secret,
      model: model.remoteId ?? model.id,
      accountId: lease.id,
      capabilities: model.capabilities,
      baseUrl: model.baseUrl,
      family: model.family
    });
    const result = await this.invokeAdapter(model, adapter, lease, request);
    lease.report?.(true);
    return result;
  }

  async invokeAdapter(model, adapter, lease, request) {
    const started = Date.now();
    const payload = {
      ...request,
      model: request.model && request.model !== "auto" ? request.model : (model.remoteId ?? model.id),
      messages: request.messages ?? []
    };
    const result = await adapter.chat(payload);
    const latencyMs = Date.now() - started;
    this.runtime.circuitBreaker?.success(model.id);
    this.runtime.health.recordSuccess({
      id: model.id,
      kind: "model",
      provider: model.provider,
      latencyMs
    });
    if (lease?.id) {
      this.runtime.health.recordSuccess({
        id: lease.id,
        kind: "account",
        provider: model.provider,
        latencyMs
      });
      this.runtime.quota.record(lease.id, result.usage, {
        provider: model.provider,
        model: result.model ?? model.id
      });
    }
    this.runtime.usage.record({
      provider: model.provider,
      model: result.model ?? model.id,
      accountId: lease?.id ?? null,
      tokens: result.usage?.totalTokens ?? 0,
      latencyMs
    });
    model.health = {
      state: "healthy",
      score: Math.min(100, (model.health?.score ?? 80) + 5),
      latencyMs
    };
    return {
      ...result,
      model: result.model ?? model.id,
      provider: result.provider ?? model.provider,
      accountId: lease?.id ?? result.accountId ?? null,
      latencyMs,
      attempts: request.attempts
    };
  }
}
