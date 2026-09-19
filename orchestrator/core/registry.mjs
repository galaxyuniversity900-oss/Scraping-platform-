export class ModelRegistry {
  constructor() { this.models = []; }

  register(model) {
    if (!model?.id || !model?.provider) throw new Error("INVALID_MODEL");
    const normalized = {
      enabled:true, priority:50, capabilities:[],
      health:{state:"unknown",score:50}, ...model
    };
    const i = this.models.findIndex(x => x.id === normalized.id);
    if (i >= 0) this.models[i] = normalized; else this.models.push(normalized);
    return normalized;
  }

  detectProvider(apiBase, modelId="") {
    const s = (apiBase + " " + modelId).toLowerCase();
    if (s.includes("anthropic")) return "anthropic";
    if (s.includes("generativelanguage") || s.includes("gemini")) return "google";
    if (s.includes("x.ai") || s.includes("grok")) return "xai";
    if (s.includes("nvidia")) return "nvidia";
    if (s.includes("ollama")) return "ollama";
    if (s.includes("openai")) return "openai";
    return "generic-openai-compatible";
  }
}
