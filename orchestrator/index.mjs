import { ModelRegistry } from "./core/registry.mjs";
import { CapabilityRouter } from "./core/router.mjs";
import { MCPGateway } from "./mcp/gateway.mjs";

export function createOrchestrator() {
  const registry = new ModelRegistry();
  return { registry, router:new CapabilityRouter(registry), mcp:new MCPGateway() };
}
