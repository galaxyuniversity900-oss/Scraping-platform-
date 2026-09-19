import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  Cable,
  LayoutDashboard,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Shield,
} from "lucide-react";
import { addConnection, getOverview, listConnectors, runMcp, sendChat } from "@/lib/creazzy/actions";
import type { ChatMessage, ChatMode, OverviewPayload } from "@/lib/creazzy/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type View = "overview" | "chat" | "providers" | "mcp" | "health";

const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "providers", label: "Providers", icon: Boxes },
  { id: "mcp", label: "MCP", icon: Cable },
  { id: "health", label: "Health", icon: Activity },
];

type Overview = OverviewPayload;

function healthTone(state?: string): "ok" | "warn" | "danger" | "neutral" {
  if (state === "healthy") return "ok";
  if (state === "degraded" || state === "rate_limited" || state === "unknown") return "warn";
  if (state === "down" || state === "auth_error" || state === "quota_exhausted") return "danger";
  return "neutral";
}

export function CreazzyApp() {
  const [view, setView] = useState<View>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const data = await getOverview();
    setOverview(data);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border lg:flex lg:flex-col lg:px-5 lg:py-8">
          <Brand />
          <nav className="mt-10 flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
                  view === item.id ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/70 hover:text-fg",
                )}
              >
                <item.icon className="size-4" strokeWidth={1.75} />
                {item.label}
              </button>
            ))}
          </nav>
          <p className="mt-6 text-xs leading-5 text-subtle">
            One control plane. Accounts fail over. Providers stay isolated.
          </p>
        </aside>

        <div className="flex min-h-dvh flex-col pb-[4.5rem] lg:pb-0">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="lg:hidden">
                <Brand compact />
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="text-xs uppercase tracking-[0.18em] text-subtle">Universal AI orchestrator</p>
                <h1 className="mt-1 truncate font-display text-2xl text-fg">
                  {NAV.find((item) => item.id === view)?.label}
                </h1>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void refresh()} className="shrink-0">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">
            {loading && <p className="text-sm text-muted">Loading control plane…</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
            {!loading && overview && view === "overview" && <OverviewPanel data={overview} onOpen={setView} />}
            {!loading && overview && view === "chat" && <ChatPanel onComplete={() => void refresh()} />}
            {!loading && overview && view === "providers" && (
              <ProvidersPanel data={overview} onChanged={() => void refresh()} />
            )}
            {!loading && overview && view === "mcp" && <McpPanel data={overview} />}
            {!loading && overview && view === "health" && <HealthPanel data={overview} />}
          </main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur-sm lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                view === item.id ? "text-fg" : "text-muted",
              )}
            >
              <item.icon className="size-4" strokeWidth={1.75} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-md bg-accent text-accent-fg">
        <Shield className="size-4" strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-display text-lg leading-none">Creazzy</p>
        {!compact && <p className="mt-1 text-xs text-subtle">Control plane</p>}
      </div>
    </div>
  );
}

function OverviewPanel({ data, onOpen }: { data: Overview; onOpen: (view: View) => void }) {
  const cards = [
    { label: "Providers", value: data.providers.length, hint: "connected families" },
    { label: "Models", value: data.models.length, hint: "routable endpoints" },
    { label: "Accounts", value: data.accountCount, hint: "encrypted vault" },
    { label: "MCP tools", value: data.tools.length, hint: "qualified names" },
  ];
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-surface p-5 sm:p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-subtle">Ready</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl sm:text-4xl">
          Route any task across models, accounts, and tools.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Demo models are live without keys. Add official provider credentials to expand the pool. Failover keeps the
          conversation if an account hits quota or rate limits.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => onOpen("chat")}>Open chat</Button>
          <Button variant="secondary" onClick={() => onOpen("providers")}>
            Add provider
          </Button>
        </div>
        {data.xaiReady && (
          <p className="mt-4 text-xs text-ok">Platform xAI key detected — Grok is available in the router.</p>
        )}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-lg bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">{card.label}</p>
            <p className="mt-3 font-display text-4xl tabular-nums">{card.value}</p>
            <p className="mt-1 text-sm text-muted">{card.hint}</p>
          </article>
        ))}
      </section>
      <section className="rounded-xl bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl">Model registry</h3>
        </div>
        <div className="divide-y divide-border">
          {data.models.map((model) => (
            <div key={String(model.id)} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{String(model.id)}</p>
                <p className="text-sm text-muted">{String(model.provider)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={healthTone((model.health as { state?: string } | undefined)?.state)}>
                  {(model.health as { state?: string } | undefined)?.state ?? "unknown"}
                </Badge>
                {(model.capabilities).slice(0, 4).map((cap) => (
                  <Badge key={cap}>{cap}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChatPanel({ onComplete }: { onComplete: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Creazzy is online. Ask anything — coding, planning, files, or MCP lookup. The router will pick a capable model and fail over if needed.",
      meta: { provider: "mock", model: "creazzy-demo" },
    },
  ]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatMode>("single");
  const [mcp, setMcp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const content = draft.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    const result = await sendChat({
      data: {
        messages: next.filter((message) => message.role !== "assistant" || Boolean(message.content)),
        mode,
        mcp,
      },
    });
    if (result.ok) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: result.text,
          meta: {
            model: result.model,
            provider: result.provider,
            accountId: result.accountId,
            latencyMs: result.latencyMs,
            cached: result.cached,
            mode,
            analysis: result.analysis,
          },
        },
      ]);
    } else {
      setMessages([...next, { role: "assistant", content: result.error }]);
    }
    setBusy(false);
    onComplete();
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-10.5rem)] max-w-3xl flex-col lg:h-[calc(100dvh-7.5rem)]">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={cn(
              "max-w-[92%] rounded-lg px-4 py-3 text-sm leading-6",
              message.role === "user" ? "ml-auto bg-accent text-accent-fg" : "bg-surface text-fg",
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.meta && message.role === "assistant" && (
              <p className="mt-2 font-mono text-[11px] text-subtle">
                {[message.meta.provider, message.meta.model, message.meta.analysis, message.meta.cached ? "cache" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </article>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle className="size-4 animate-spin" />
            Routing
          </p>
        )}
      </div>
      <form
        className="mt-4 rounded-xl bg-surface p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {(["single", "critic", "sequential", "parallel"] as ChatMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cn(
                "h-9 rounded-full px-3 text-xs capitalize",
                mode === item ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
              )}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMcp((value) => !value)}
            className={cn(
              "h-9 rounded-full px-3 text-xs",
              mcp ? "bg-accent text-accent-fg" : "bg-elevated text-muted",
            )}
          >
            MCP lookup
          </button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask the orchestrator"
            className="min-h-[52px] flex-1 resize-none"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProvidersPanel({ data, onChanged }: { data: Overview; onChanged: () => void }) {
  const [catalog, setCatalog] = useState<{ id: string; baseUrl: string; adapter: string; auth: string }[]>([]);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listConnectors().then((result) => {
      setCatalog(result.connectors);
      if (result.connectors[0]) setProvider(result.connectors[0].id);
    });
  }, []);

  const selected = useMemo(() => catalog.find((item) => item.id === provider), [catalog, provider]);

  async function connect() {
    if (!apiKey.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await addConnection({ data: { provider, apiKey: apiKey.trim(), label } });
      setStatus(`Stored ${result.provider} account ${result.connectionId}`);
      setApiKey("");
      onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not store credential");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Add account</h3>
        <p className="mt-2 text-sm text-muted">
          Keys stay on the server, encrypted at rest. The browser never keeps the secret. DeepSeek uses API keys, not
          OAuth.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Provider</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm text-fg"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Label</span>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Account 01" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">API key</span>
            <Input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={selected?.auth === "none" ? "Optional for local runtimes" : "sk-…"}
            />
          </label>
          <Button onClick={() => void connect()} disabled={busy || !apiKey.trim()}>
            <Plus className="size-4" />
            Store credential
          </Button>
          {status && <p className="text-sm text-muted">{status}</p>}
        </div>
      </section>
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Vault</h3>
        <div className="mt-4 divide-y divide-border">
          {data.accounts.length === 0 && <p className="text-sm text-muted">No stored accounts yet. Demo models still run.</p>}
          {data.accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{account.label || account.provider}</p>
                <p className="font-mono text-xs text-subtle">{account.id}</p>
              </div>
              <Badge tone={account.status === "available" ? "ok" : "warn"}>{account.status ?? "stored"}</Badge>
            </div>
          ))}
        </div>
        <h4 className="mt-6 text-sm uppercase tracking-[0.16em] text-subtle">Catalog</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {catalog.slice(0, 18).map((item) => (
            <Badge key={item.id}>{item.id}</Badge>
          ))}
          {catalog.length > 18 && <Badge>+{catalog.length - 18}</Badge>}
        </div>
      </section>
    </div>
  );
}

function McpPanel({ data }: { data: Overview }) {
  const [query, setQuery] = useState("models");
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function run() {
    const tool = data.tools[0];
    if (!tool) return;
    setBusy(true);
    const result = await runMcp({ data: { name: tool.name, query } });
    setOutput(result.result.payload);
    setBusy(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Qualified tools</h3>
        <p className="mt-2 text-sm text-muted">Names stay namespaced as server__tool. Bare names still resolve.</p>
        <div className="mt-4 divide-y divide-border">
          {data.tools.map((tool) => (
            <div key={tool.name} className="py-3">
              <p className="font-mono text-sm">{tool.name}</p>
              <p className="text-xs text-subtle">{tool.server}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Execute</h3>
        <div className="mt-4 space-y-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="lookup query" />
          <Button onClick={() => void run()} disabled={busy || !data.tools.length}>
            Run {data.tools[0]?.name ?? "tool"}
          </Button>
          {output && <pre className="overflow-x-auto rounded-md bg-elevated p-3 font-mono text-xs text-muted">{output}</pre>}
        </div>
        <div className="mt-6">
          <h4 className="text-sm uppercase tracking-[0.16em] text-subtle">Skills</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.skills.map((skill) => (
              <Badge key={skill.id}>{skill.name}</Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function HealthPanel({ data }: { data: Overview }) {
  const models = data.health.models;
  const accounts = data.health.accounts;
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Requests</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{data.usage.requests}</p>
        </article>
        <article className="rounded-lg bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Tokens reported</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{data.usage.tokens}</p>
        </article>
        <article className="rounded-lg bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Log entries</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{data.logs.length}</p>
        </article>
      </section>
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Model health</h3>
        <div className="mt-3 divide-y divide-border">
          {models.length === 0 && <p className="text-sm text-muted">No live samples yet. Send a chat to populate health.</p>}
          {models.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{item.id}</p>
                <p className="font-mono text-xs text-subtle">
                  score {item.score}
                  {item.latencyMs != null ? ` · ${item.latencyMs}ms` : ""}
                </p>
              </div>
              <Badge tone={healthTone(item.state)}>{item.state}</Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Account health</h3>
        <div className="mt-3 divide-y divide-border">
          {accounts.length === 0 && <p className="text-sm text-muted">Vault accounts appear here after a leased request.</p>}
          {accounts.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3">
              <p className="font-mono text-sm">{item.id}</p>
              <Badge tone={healthTone(item.state)}>{item.state}</Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl bg-surface p-5">
        <h3 className="font-display text-xl">Recent routing</h3>
        <div className="mt-3 space-y-2">
          {data.logs.length === 0 && <p className="text-sm text-muted">No routed chats yet.</p>}
          {data.logs.slice(0, 12).map((log, index) => (
            <p key={index} className="font-mono text-xs text-muted">
              {String(log.at)} · {String(log.provider ?? "—")} · {String(log.model ?? "—")} · {String(log.taskClass ?? "")}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
