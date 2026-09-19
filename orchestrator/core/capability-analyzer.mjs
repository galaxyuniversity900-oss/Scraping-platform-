const FILE_CAPABILITIES = {
  image: ["vision", "image"],
  video: ["video"],
  audio: ["audio"],
  document: ["files"],
  binary: ["files"]
};

export class CapabilityAnalyzer {
  analyze(request = {}) {
    const capabilities = new Set(request.capabilities ?? ["chat"]);
    const files = request.files ?? request.attachments ?? [];
    const kinds = [];

    for (const file of files) {
      const kind = file.kind ?? kindFrom(file.mime ?? file.type ?? "", file.name ?? "");
      kinds.push(kind);
      for (const cap of FILE_CAPABILITIES[kind] ?? ["files"]) capabilities.add(cap);
    }

    const text = collectText(request);
    const taskClass = request.taskClass ?? classify(text, [...capabilities], request.mode);

    if (taskClass === "code") capabilities.add("code");
    if (taskClass === "reasoning") capabilities.add("reasoning");
    if (request.tools?.length || request.mcp?.length || request.mode === "mcp") {
      capabilities.add("tool_calling");
      capabilities.add("MCP");
    }
    if (request.structured || request.response_format) capabilities.add("structured_output");
    if (/\b(image|picture|photo|screenshot)\b/i.test(text)) capabilities.add("vision");
    if (/\b(pdf|spreadsheet|document|file)\b/i.test(text)) capabilities.add("files");

    return {
      taskClass,
      capabilities: [...capabilities],
      files: kinds,
      mcpRequired: capabilities.has("MCP"),
      mode: request.mode ?? "single"
    };
  }
}

function kindFrom(mime, name) {
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(name)) return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name)) return "audio";
  if (mime === "application/pdf" || mime.startsWith("text/") || /\.(pdf|txt|md|csv|json)$/i.test(name)) {
    return "document";
  }
  return "binary";
}

function collectText(request) {
  const messages = request.messages ?? [];
  const content = messages
    .map((message) => (typeof message.content === "string" ? message.content : ""))
    .join("\n");
  return `${request.prompt ?? ""} ${content}`.trim();
}

function classify(text, capabilities, mode) {
  if (mode === "mcp") return "mcp";
  if (capabilities.includes("vision") || capabilities.includes("image")) return "vision";
  if (capabilities.includes("video") || capabilities.includes("audio")) return "media";
  if (/\b(code|function|refactor|bug|typescript|python|implement)\b/i.test(text)) return "code";
  if (/\b(why|reason|plan|analyze|compare|debate)\b/i.test(text)) return "reasoning";
  if (/\b(research|search|lookup|find)\b/i.test(text)) return "research";
  return "default";
}
