# SKILL: MCP Aggregator — Qualified Tool Name Preservation

## Overview

This document describes a bug in the MCP aggregator of the Creazzy Universal Orchestrator, its root cause, the applied fix, and the operational steps to commit and ship the change on the feat/freetoken-inspired-runtime branch. It is intended as both a post-mortem and a reusable troubleshooting playbook for similar issues in the same codebase.

## 1. Symptom

Running `npm run smoke` fails on the third test in the chain, showing the following assertion error:

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

at file:///.../orchestrator/test/connected-chain.mjs:15:8
```

The first two tests, `smoke.mjs` and `phase2.mjs`, pass. The failure is isolated to `connected-chain.mjs` and cascades into `final-chain.mjs`. The failing line is:

```js
assert.equal(r.mcpAggregator.resolve(["mcp-test__lookup"]).length, 1);
```

`resolve()` returns an empty array whose `.length === 0` instead of one match.

## 2. Root Cause

In `mcp/aggregator.mjs`, the `discover()` method built each tool entry with the spread operator placed after the `name` field:

```js
{
  name: server.name + "__" + tool.name,
  server: server.name,
  ...tool
}
```

Because `...tool` came last, `tool.name` (`"lookup"`) overwrote the qualified identifier `"mcp-test__lookup"`, so every discovered tool carried only its bare local name.

The three match checks fail as follows:

```js
requested.has(tool.name) // "lookup" ≠ "mcp-test__lookup"
requested.has(tool.server) // undefined ≠ "mcp-test__lookup"
requested.has(tool.name.split("__").at(-1)) // "lookup" ≠ "mcp-test__lookup"
```

The result was an empty array, causing the assertion `0 !== 1`. The bug was not in `runtime.mjs` or `mcp/lifecycle.mjs`; the wiring between `MCPLifecycle` and `MCPAggregator` sharing the same `MCPGateway` instance was correct.

## 3. Fix

Reorder the object literal so the qualified name and server fields are applied after the spread.

### Before (buggy)

```js
{
  name: server.name + "__" + tool.name,
  server: server.name,
  ...tool
}
```

### After (fixed)

```js
{
  ...tool,
  name: server.name + "__" + tool.name,
  server: server.name
}
```

The qualified identifier now survives, `resolve()` matches correctly, and both `connected-chain.mjs` and `final-chain.mjs` pass.

## 4. Verification

Run:

```bash
cd orchestrator
npm run smoke
```

Expected output:

```text
CREAZZY ORCHESTRATOR SMOKE TEST: PASS
PHASE 2 SMOKE TEST: PASS
CONNECTED CHAIN TEST: PASS
FINAL CONNECTED CHAIN TEST: PASS
multi-account-auth: ok
account-grid-100: ok
RUNTIME ENHANCEMENTS TEST: PASS
```

Confirm that no merge conflict markers remain in `orchestrator/mcp/aggregator.mjs`:

```bash
grep -nE '^(<<<<<<<|=======|>>>>>>>)' orchestrator/mcp/aggregator.mjs
```

## 5. Guard Rail (Recommended)

Add an explicit assertion in `test/connected-chain.mjs` so future refactors of `discover()` cannot silently break the qualified name again:

```js
const tools = r.mcpAggregator.discover();
assert.equal(tools[0].name, "mcp-test__lookup", "qualified name must survive discovery");
assert.equal(tools[0].server, "mcp-test");
```

## 6. Commit and Push

Commit the fix with a multi-line message titled `fix(mcp): preserve qualified tool name in aggregator.discover`, explaining that `...tool` was spread before `name` and `server` so the qualified `server__tool` identifier is not overwritten by `tool.name`, that this fixes the connected-chain and final-chain tests, and that it also ignores orchestrator build artifacts (`package-lock`, `start-server`, `*.bak`):

```bash
git add orchestrator/mcp/aggregator.mjs .gitignore
git commit -m "fix(mcp): preserve qualified tool name in aggregator.discover" -m "Spread ...tool before name and server so the qualified server__tool identifier is not overwritten by tool.name.

This fixes the connected-chain and final-chain tests.

Also ignore orchestrator build artifacts: package-lock, start-server, and *.bak."
git push origin feat/freetoken-inspired-runtime
```

Drop the obsolete stash named `local-mcp-aggregator-before-sync`:

```bash
git stash show -p stash@{0}
git stash drop stash@{0}
git stash list
```

Final check:

```bash
git log --oneline -5
git status
# Expected: nothing to commit, working tree clean
cd orchestrator && npm run smoke
```

## 7. Lesson

**Order of spread versus explicit keys matters in object literals.** When a payload is spread and shares keys with explicitly-set fields, the last assignment wins. If a field must be authoritative, such as a computed or namespaced identifier, it should always be placed after the spread.

## 8. Files Touched

| File | Change |
| --- | --- |
| `orchestrator/mcp/aggregator.mjs` | Reorder `...tool` before `name` and `server` |
| `.gitignore` | Ignore `package-lock.json`, `start-server.mjs`, `*.bak` under `orchestrator/` |
| `orchestrator/SKILL.md` | This document |

## 9. Branch

`feat/freetoken-inspired-runtime`

## 10. Quick Reference — Full Command Sequence

```bash
# 1. Navigate to the orchestrator and reproduce the failure.
cd ~/Plugins-collectors/orchestrator
npm run smoke

# 2. Inspect the aggregator implementation.
cat mcp/aggregator.mjs

# 3. Apply the fix: spread the tool first, then assign the qualified name and server.
# Edit mcp/aggregator.mjs so the discovered tool object contains:
# {
#   ...tool,
#   name: server.name + "__" + tool.name,
#   server: server.name
# }

# 4. Re-run the smoke tests.
npm run smoke

# 5. Stage the implementation and ignore-file changes.
cd ..
git add orchestrator/mcp/aggregator.mjs .gitignore

# 6. Commit the fix with its full explanation.
git commit -m "fix(mcp): preserve qualified tool name in aggregator.discover" -m "Spread ...tool before name and server so the qualified server__tool identifier is not overwritten by tool.name.

This fixes the connected-chain and final-chain tests.

Also ignore orchestrator build artifacts: package-lock, start-server, and *.bak."

# 7. Push the implementation change.
git push origin feat/freetoken-inspired-runtime

# 8. Drop the obsolete local stash.
git stash drop stash@{0}

# 9. Write this post-mortem skill document.
# Create orchestrator/SKILL.md with this content, then commit it separately.
git add orchestrator/SKILL.md
git commit -m "docs(skill): full post-mortem for MCP aggregator qualified-name bug"
git push origin feat/freetoken-inspired-runtime

# 10. Perform final verification.
git status
cd orchestrator && npm run smoke
```
