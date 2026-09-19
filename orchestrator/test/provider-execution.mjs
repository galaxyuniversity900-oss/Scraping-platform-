import assert from "node:assert/strict";
import { createRuntime } from "../runtime.mjs";
import { createAdapter } from "../providers/adapter-factory.mjs";
import { MockAdapter } from "../providers/mock-adapter.mjs";
import { assertAdapter, ADAPTER_METHODS } from "../providers/adapter-contract.mjs";
import { normalizeOpenAI, normalizeAnthropic, normalizeGoogle } from "../providers/response-normalizer.mjs";

const contract = createAdapter({ provider: "mock", id: "contract-mock" });
assertAdapter(contract);
for (const method of ADAPTER_METHODS) assert.equal(typeof contract[method], "function");
await contract.connect();
assert.equal((await contract.validate()).ok, true);
assert.ok((await contract.listModels()).length >= 1);
assert.ok(contract.getCapabilities().includes("chat"));
assert.equal((await contract.healthCheck()).state, "healthy");

const openai = normalizeOpenAI({
  model: "gpt-test",
  choices: [{ message: { content: "hi", tool_calls: [{ id: "1", function: { name: "lookup", arguments: "{\"q\":\"a\"}" } }] } }],
  usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
}, { provider: "openai" });
assert.equal(openai.text, "hi");
assert.equal(openai.toolCalls[0].name, "lookup");
assert.equal(openai.usage.source, "reported");
assert.equal(normalizeAnthropic({ content: [{ type: "text", text: "claude" }], usage: { input_tokens: 1, output_tokens: 1 } }).text, "claude");
assert.equal(normalizeGoogle({ candidates: [{ content: { parts: [{ text: "gem" }] } }] }).text, "gem");

const r = createRuntime({
  masterKey: "provider-execution-master",
  routing: { preferredProviders: ["mock"], maxAttempts: 4 }
});

const flaky = new MockAdapter({ id: "flaky", provider: "mock", model: "flaky", failTimes: 1, failCode: "RATE_LIMIT" });
const backup = new MockAdapter({ id: "backup", provider: "mock", model: "backup", prefix: "[backup]" });
r.registry.register({
  id: "mock-flaky",
  provider: "mock",
  capabilities: ["chat", "code"],
  priority: 90,
  adapter: flaky
});
r.registry.register({
  id: "mock-backup",
  provider: "mock",
  capabilities: ["chat", "code"],
  priority: 40,
  adapter: backup
});

const ping = await r.execution.chat({
  messages: [{ role: "user", content: "ping" }],
  capabilities: ["chat"]
});
assert.match(ping.text, /ping/);
assert.equal(ping.provider, "mock");
assert.equal(r.health.snapshot("mock-flaky").state, "rate_limited");
assert.equal(r.health.snapshot("mock-backup").state, "healthy");
assert.equal(r.quota.list().length, 0);
assert.ok(r.usage.totals().requests >= 1);

const accountRuntime = createRuntime({ masterKey: "account-failover-master" });
accountRuntime.connections.add({ provider: "mock", secret: "fail:RATE_LIMIT", label: "bad" });
accountRuntime.connections.add({ provider: "mock", secret: "ok-secret-account", label: "good" });
accountRuntime.registry.register({
  id: "mock-pooled",
  provider: "mock",
  capabilities: ["chat"],
  priority: 50
});
const rotated = await accountRuntime.execution.chat({
  messages: [{ role: "user", content: "rotate me" }]
});
assert.match(rotated.text, /rotate me/);
assert.ok(rotated.accountId);
const listed = accountRuntime.connections.list("mock");
assert.equal(listed.length, 2);
assert.ok(listed.some((item) => item.status === "cooling" || item.status === "available"));

const mcpRuntime = createRuntime({ masterKey: "mcp-exec-master", demo: true });
const tools = mcpRuntime.mcpAggregator.discover();
assert.equal(tools[0].name, "creazzy-local__lookup");
assert.equal(tools[0].server, "creazzy-local");
const mcp = await mcpRuntime.mcpExecutor.execute("creazzy-local__lookup", { query: "models" });
assert.equal(mcp.ok, true);
assert.equal(mcp.result.query, "models");
const viaChat = await mcpRuntime.execution.chat({
  messages: [{ role: "user", content: "lookup catalog" }],
  mcp: [{ name: "creazzy-local__lookup", arguments: { query: "catalog" } }]
});
assert.equal(viaChat.mcpCalls[0].result.query, "catalog");

const files = await mcpRuntime.fileRouter.prepare([
  { name: "notes.txt", mime: "text/plain", size: 12, text: "budget 42" },
  { name: "shot.png", mime: "image/png", size: 100 }
]);
assert.equal(files[0].kind, "document");
assert.equal(files[0].extracted.text, "budget 42");
assert.equal(files[1].kind, "image");
const vision = await mcpRuntime.execution.chat({
  messages: [{ role: "user", content: "describe this image" }],
  files: [{ name: "shot.png", mime: "image/png", size: 80 }]
});
assert.ok(vision.analysis.capabilities.includes("vision"));

const collab = await mcpRuntime.execution.chat({
  mode: "critic",
  messages: [{ role: "user", content: "plan a refactor" }]
});
assert.equal(collab.collaboration.mode, "critic");
assert.equal(collab.collaboration.stages.length, 2);

const cached = await mcpRuntime.execution.chat({
  messages: [{ role: "user", content: "lookup catalog" }],
  mcp: [{ name: "creazzy-local__lookup", arguments: { query: "catalog" } }]
});
assert.equal(cached.cached, true);

const exhausted = createRuntime({ masterKey: "quota-master" });
const dying = new MockAdapter({
  id: "dying",
  provider: "mock",
  alwaysFail: true,
  failCode: "QUOTA_EXHAUSTED",
  failMessage: "insufficient credits"
});
const alive = new MockAdapter({ id: "alive", provider: "openai", model: "alive", prefix: "[openai]" });
exhausted.registry.register({
  id: "mock-dead",
  provider: "mock",
  capabilities: ["chat"],
  priority: 99,
  adapter: dying
});
exhausted.registry.register({
  id: "openai-alive",
  provider: "openai",
  capabilities: ["chat"],
  priority: 10,
  adapter: alive
});
const failedOver = await exhausted.execution.chat({
  messages: [{ role: "user", content: "still there" }]
});
assert.match(failedOver.text, /still there/);
assert.equal(failedOver.provider, "openai");
assert.equal(exhausted.health.snapshot("mock-dead").state, "quota_exhausted");

const openaiPayload = await mcpRuntime.execution.completeOpenAI({
  model: "auto",
  messages: [{ role: "user", content: "hello orchestrator" }]
});
assert.equal(openaiPayload.object, "chat.completion");
assert.match(openaiPayload.choices[0].message.content, /hello orchestrator/);

console.log("PROVIDER EXECUTION TEST: PASS");
