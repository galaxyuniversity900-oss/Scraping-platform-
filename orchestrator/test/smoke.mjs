import { createOrchestrator } from "../index.mjs";

const o = createOrchestrator();
o.registry.register({
  id:"demo-openai", provider:"openai",
  capabilities:["chat","code"], priority:80
});
o.registry.register({
  id:"demo-ollama", provider:"ollama",
  capabilities:["chat","code"], priority:60
});
o.mcp.register({
  name:"demo-tools", capabilities:["search"], permissions:["read"]
});

const ranked = o.router.rank({capabilities:["code"]});
if (ranked[0]?.id !== "demo-openai") throw new Error("routing smoke test failed");
if (!o.mcp.authorize("demo-tools","read")) throw new Error("MCP authorization smoke test failed");
console.log("CREAZZY ORCHESTRATOR SMOKE TEST: PASS");
