import { adapterError } from "../providers/adapter-contract.mjs";

export class ExecutionEngine {
  constructor(runtime) {
    this.runtime = runtime;
  }

  async chat(request = {}) {
    const analysis = this.runtime.analyzer.analyze(request);
    const files = await this.runtime.fileRouter.prepare(request.files ?? request.attachments ?? []);
    const skillText = request.skills ? this.runtime.skills.compose(request.skills) : "";
    const system = this.runtime.instructions.compose({
      ...request,
      skill: skillText || request.skill
    });
    const cacheKey = {
      system,
      prompt: request.prompt ?? null,
      messages: request.messages ?? [],
      tools: request.tools ?? [],
      skills: request.skills ?? [],
      mcp: request.mcp ?? [],
      files: files.map((file) => ({ name: file.name, kind: file.kind, size: file.size }))
    };
    if (request.useCache !== false) {
      const cached = this.runtime.contextCache.get(cacheKey);
      if (cached) return { ...cached, cached: true };
    }

    const prepared = {
      ...request,
      analysis,
      files,
      system,
      capabilities: analysis.capabilities,
      taskClass: analysis.taskClass,
      messages: withFileContext(request.messages ?? [], files, request.prompt)
    };

    let mcpCalls = [];
    if (prepared.mcp?.length) {
      mcpCalls = await this.runtime.mcpExecutor.executeMany(
        prepared.mcp.map((item) => (typeof item === "string" ? { name: item, arguments: {} } : item))
      );
      prepared.messages = [
        ...prepared.messages,
        {
          role: "system",
          content: `MCP results:\n${JSON.stringify(mcpCalls)}`
        }
      ];
    }

    const mode = request.mode ?? "single";
    let result;
    if (mode === "single" || mode === "normal" || mode === "chat") {
      result = await this.runtime.failover.chat(prepared);
    } else {
      result = await this.runtime.collaboration.execute(mode, prepared, (next) =>
        this.runtime.failover.chat({ ...prepared, ...next })
      );
    }

    result.mcpCalls = mcpCalls;
    result.analysis = analysis;
    result.cached = false;
    this.runtime.contextCache.set(cacheKey, result);
    this.runtime.events?.emit?.("chat", {
      model: result.model,
      provider: result.provider,
      taskClass: analysis.taskClass
    });
    return result;
  }

  async completeOpenAI(payload = {}) {
    const result = await this.chat({
      model: payload.model,
      messages: payload.messages ?? [],
      tools: payload.tools,
      mcp: payload.mcp,
      files: payload.files,
      mode: payload.mode ?? "single",
      capabilities: payload.capabilities,
      taskClass: payload.taskClass,
      conversationId: payload.conversationId,
      requestId: payload.requestId,
      maxAttempts: payload.maxAttempts,
      preferredProvider: payload.preferredProvider,
      preferredModel: payload.preferredModel
    });
    return {
      id: `chatcmpl-${result.model ?? "creazzy"}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      provider: result.provider,
      account: result.accountId,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: result.text },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: result.usage?.inputTokens ?? 0,
        completion_tokens: result.usage?.outputTokens ?? 0,
        total_tokens: result.usage?.totalTokens ?? 0
      },
      analysis: result.analysis,
      mcpCalls: result.mcpCalls,
      attempts: result.attempts,
      cached: result.cached
    };
  }
}

function withFileContext(messages, files, prompt) {
  const next = [...messages];
  if (prompt && !next.some((message) => message.role === "user" && message.content === prompt)) {
    next.push({ role: "user", content: prompt });
  }
  if (files.length) {
    next.push({
      role: "system",
      content: `Attached files:\n${files
        .map((file) => `- ${file.name} (${file.kind}${file.extracted?.text ? `: ${file.extracted.text.slice(0, 500)}` : ""})`)
        .join("\n")}`
    });
  }
  if (!next.length) throw adapterError("messages is required", "INVALID_REQUEST");
  return next;
}
