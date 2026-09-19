import { ModelRegistry } from "./core/registry.mjs";
import { CapabilityRouter } from "./core/router.mjs";
import { RoutingPolicy } from "./core/policy.mjs";
import { CircuitBreaker } from "./core/circuit-breaker.mjs";
import { UsageLedger } from "./core/usage-ledger.mjs";
import { AgentGraph } from "./core/agent-graph.mjs";
import { MCPGateway } from "./mcp/gateway.mjs";
import { MCPAggregator } from "./mcp/aggregator.mjs";
import { MCPLifecycle } from "./mcp/lifecycle.mjs";
import { MCPExecutor } from "./mcp/executor.mjs";
import { PluginRegistry } from "./plugins/registry.mjs";
import { SkillLoader } from "./skills/loader.mjs";
import { CredentialPool } from "./credentials/key-pool.mjs";
import { Planner } from "./agents/planner.mjs";
import { Collaboration } from "./agents/collaboration.mjs";
import { ConnectionManager } from "./auth/connection-manager.mjs";
import { AdaptiveScheduler } from "./core/adaptive-scheduler.mjs";
import { ContextCache } from "./core/context-cache.mjs";
import { HealthMonitor } from "./core/health-monitor.mjs";
import { QuotaTracker } from "./core/quota-tracker.mjs";
import { AccountPool } from "./core/account-pool.mjs";
import { CapabilityAnalyzer } from "./core/capability-analyzer.mjs";
import { FailoverEngine } from "./core/failover-engine.mjs";
import { ExecutionEngine } from "./core/execution-engine.mjs";
import { InstructionStack } from "./core/instructions.mjs";
import { FileRouter } from "./media/file-router.mjs";
import { EventBus } from "./observability/events.mjs";
import { bootstrapDemo } from "./core/bootstrap-demo.mjs";

export function createRuntime(config = {}) {
  const registry = new ModelRegistry();
  const policy = new RoutingPolicy(config.routing);
  const router = new CapabilityRouter(registry);
  router.policy = policy;

  const runtime = {
    registry,
    policy,
    router,
    usage: new UsageLedger(),
    graph: new AgentGraph(config.graph),
    mcp: new MCPGateway(),
    plugins: new PluginRegistry(),
    skills: new SkillLoader(),
    credentials: new CredentialPool(),
    events: new EventBus(),
    health: new HealthMonitor(),
    quota: new QuotaTracker(),
    analyzer: new CapabilityAnalyzer(),
    fileRouter: new FileRouter(),
    instructions: new InstructionStack()
  };

  runtime.connections =
    (config.masterKey ?? process.env.APP_MASTER_KEY)
      ? new ConnectionManager({
          masterKey: config.masterKey ?? process.env.APP_MASTER_KEY,
          maxAccounts: config.maxAccounts,
          maxProviders: config.maxProviders,
          perProvider: config.perProvider
        })
      : null;

  runtime.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  router.circuitBreaker = runtime.circuitBreaker;
  runtime.contextCache = new ContextCache(config.cache);
  runtime.scheduler = new AdaptiveScheduler({
    registry,
    policy,
    circuitBreaker: runtime.circuitBreaker
  });
  runtime.mcpLifecycle = new MCPLifecycle(runtime.mcp);
  runtime.mcpAggregator = new MCPAggregator(runtime.mcp);
  runtime.mcpExecutor = new MCPExecutor({
    aggregator: runtime.mcpAggregator,
    gateway: runtime.mcp,
    lifecycle: runtime.mcpLifecycle
  });
  runtime.planner = new Planner(runtime.router);
  runtime.collaboration = new Collaboration(runtime.graph);
  runtime.accountPool = new AccountPool({
    connections: runtime.connections,
    credentials: runtime.credentials,
    health: runtime.health,
    quota: runtime.quota
  });
  runtime.failover = new FailoverEngine(runtime);
  runtime.execution = new ExecutionEngine(runtime);

  if (config.demo) bootstrapDemo(runtime, { includeXai: config.includeXai !== false });
  return runtime;
}
