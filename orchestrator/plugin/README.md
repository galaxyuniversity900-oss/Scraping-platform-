# Creazzy Universal AI Plugin
Portable provider-agnostic agent runtime for ChatGPT/Codex-style hosts and other AI clients.

## Contract
- BYOK API keys; no browser-cookie or private-token scraping.
- Native Anthropic/Gemini adapters.
- OpenAI-compatible fallback adapter for the extended connector catalog.
- Multi-account rotation with a default 100-account grid.
- Durable local state with optional Redis state backend.
- OpenAI-compatible chat endpoint and browser operations dashboard.

The plugin protocol is an internal stable contract for this repository; host-specific packaging may add an adapter layer.