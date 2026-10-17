import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 18790 + Math.floor(Math.random() * 500);
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), META_ACCESS_TOKEN: "test-token-not-real", META_GRAPH_API_VERSION: "v22.0" },
  stdio: "ignore"
});
const base = `http://127.0.0.1:${port}`;

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error("Server exited before it became ready.");
    try { return await fetch(base + "/api/health"); } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start in time.");
}

try {
  const health = await waitForServer();
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);
  assert.equal(healthBody.tokenConfigured, true);
  assert.equal(healthBody.graphVersionConfigured, true);

  const emptySearch = await fetch(base + "/api/ads");
  assert.equal(emptySearch.status, 400);
  assert.match((await emptySearch.json()).error, /search keyword/i);

  const badDates = await fetch(base + "/api/ads?q=sample&from=2026-99-45");
  assert.equal(badDates.status, 400);
  assert.match((await badDates.json()).error, /YYYY-MM-DD/);

  const notFound = await fetch(base + "/not-a-route");
  assert.equal(notFound.status, 404);

  console.log("Meta Ad Library checks passed (4 assertions groups). No external Meta API call was made.");
} finally {
  child.kill("SIGTERM");
}
