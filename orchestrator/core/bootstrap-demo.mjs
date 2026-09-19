import { createAdapter } from "../providers/adapter-factory.mjs";

export function bootstrapDemo(runtime, { includeXai = true } = {}) {
  const general = createAdapter({
    provider: "mock",
    id: "mock-general",
    model: "creazzy-mock",
    capabilities: ["chat", "code", "reasoning", "tool_calling", "MCP", "files", "vision", "structured_output"]
  });
  runtime.registry.register({
    id: "creazzy-demo",
    provider: "mock",
    remoteId: "creazzy-mock",
    family: "mock",
    capabilities: general.getCapabilities(),
    priority: 95,
    adapter: general,
    health: { state: "healthy", score: 92 }
  });
  runtime.registry.register({
    id: "creazzy-code",
    provider: "mock",
    remoteId: "creazzy-code",
    family: "mock",
    capabilities: ["chat", "code", "reasoning", "tool_calling"],
    priority: 80,
    adapter: createAdapter({ provider: "mock", id: "mock-code", model: "creazzy-code", prefix: "[mock/code]" }),
    health: { state: "healthy", score: 84 }
  });
  runtime.registry.register({
    id: "creazzy-vision",
    provider: "mock",
    remoteId: "creazzy-vision",
    family: "mock",
    capabilities: ["chat", "vision", "image", "files"],
    priority: 70,
    adapter: createAdapter({ provider: "mock", id: "mock-vision", model: "creazzy-vision", prefix: "[mock/vision]" }),
    health: { state: "healthy", score: 78 }
  });

  runtime.mcpLifecycle.register({
    name: "creazzy-local",
    capabilities: ["search"],
    permissions: ["read", "execute"],
    tools: [{ name: "lookup", description: "Look up a local catalog entry" }]
  });
  runtime.mcpExecutor.registerHandler("creazzy-local__lookup", async (args = {}) => ({
    query: args.query ?? args.q ?? "",
    found: true,
    source: "creazzy-local"
  }));
  runtime.skills.register({
    id: "precise",
    name: "Precise",
    instructions: "Be precise. Prefer structured answers over filler."
  });
  runtime.plugins.install({
    id: "core-tools",
    name: "Core Tools",
    version: "1.0.0",
    type: "skill",
    capabilities: ["search"],
    instructions: "Use MCP tools when they can ground the answer."
  });
  runtime.instructions.set("global", "You are Creazzy Universal AI, a multi-provider orchestrator.");

  if (includeXai && process.env.XAI_API_KEY) {
    runtime.connections?.add({
      provider: "xai",
      secret: process.env.XAI_API_KEY,
      label: "platform-xai"
    });
    runtime.registry.register({
      id: "grok-4.5",
      provider: "xai",
      remoteId: "grok-4.5",
      family: "openai-compatible",
      baseUrl: "https://api.x.ai/v1",
      capabilities: ["chat", "code", "reasoning", "vision", "tool_calling", "structured_output"],
      priority: 88,
      health: { state: "unknown", score: 70 }
    });
  }
  return runtime;
}
