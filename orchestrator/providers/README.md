# Provider Adapter Boundary

Adapters must normalize providers into the common model contract:

- id
- provider
- model
- capabilities
- priority
- health
- invoke(request)

Initial provider targets: OpenAI, Anthropic, Google Gemini, xAI/Grok, NVIDIA, Ollama and generic OpenAI-compatible endpoints.

API keys must come from runtime environment/secret storage and never be committed.
