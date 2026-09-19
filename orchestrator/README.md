# Universal AI Orchestrator Foundation

Phase 2 extends the original foundation with policy routing, circuit breaking, usage accounting, dependency-aware multi-agent execution, MCP aggregation and an event bus.

Current research was performed against public GitHub repositories before implementation.

Reference projects studied:
- agentgateway/agentgateway — LLM/MCP/A2A gateway, failover, policy and observability.
- DojoGenesis/gateway — provider registry, DAG orchestration, memory/skills, events and MCP.
- ixqSCpxi/mcp-agent — MCP lifecycle, routing, parallel fan-out/fan-in, evaluator/optimizer and orchestrator-workers.
- ramsred/agentic-platform-mcp — multi-server MCP host, policy gating and observability.

The implementation in this repository is original; upstream source code is not vendored.

Next phases:
1. Real provider adapters and API discovery.
2. Secure credential/session vault and quota rotation.
3. File/media pipeline.
4. Persistent MCP connection lifecycle.
5. Chats and memory.
6. Plugin/skill loader.
7. Multi-agent planner/reviewer.
8. UI and end-to-end validation.

## Multi-account authentication

The connection layer supports 10+ independent credentials per provider. Each credential is encrypted at rest with AES-256-GCM and identified by a non-secret hash. Requests can lease a healthy credential and rotate after authentication, rate-limit, quota, or provider failures.

### DeepSeek authentication

DeepSeek API keys are not obtained through a standard OAuth authorization-code flow. The app therefore must not attempt to scrape a DeepSeek login session, browser cookies, or private tokens. The supported BYOK flow is:

1. User clicks Connect DeepSeek.
2. App opens the provider's API-key page/instructions.
3. User creates/copies an API key and submits it to the app over HTTPS.
4. Backend validates the key format, encrypts it, and stores only the encrypted secret plus metadata.
5. Runtime leases one account for a request; on rate-limit/quota/auth/provider failure it rotates to another available account.

Use APP_MASTER_KEY to unlock the vault. Never put provider keys in frontend JavaScript, URLs, query strings, Git, logs, analytics, or browser localStorage.

The frontend helper is web/deepseek-connect.mjs. It intentionally does not automate provider login.
