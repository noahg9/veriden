# Architecture — Foxbagel (Phase 1)

Status: Draft v1 · Source: [prd.md](prd.md) · Downstream: [../ROADMAP.md](../ROADMAP.md)

## 1. System overview

A TypeScript VS Code extension in two halves connected by a typed message bridge:

- Extension host (Node): all logic — agent orchestration, tool gate, staging, checkpoints, context building, verification, auth.
- Webview (React): the primary panel UI — conversation, change stream, hunk review, plan view, verify area, context/cost indicators.

```
webview (React) ⇄ bridge.ts (typed postMessage) ⇄ extension host
                                                    ├─ agent/    (SDK orchestration, prompt, tools)
                                                    ├─ context/  (repo map, retrieval, memory, pins)
                                                    ├─ changes/  (staging, hunk apply, undo)
                                                    ├─ checkpoint/ (snapshots, rollback)
                                                    ├─ verify/   (test runner, failure parsing, loop)
                                                    ├─ auth/     (provider interface, apiKey impl)
                                                    └─ audit/    (run timeline, token/cost)
```

## 2. Module responsibilities and key interfaces

### agent/
Wraps `@anthropic-ai/claude-agent-sdk` (`query()` async-generator API). The SDK runs the agentic loop; we supply options, tools, and consume the message stream. All SDK touchpoints live in `agent/sdk.ts` behind an internal `AgentBackend` interface (NFR-003).

Key decisions:
- Permission model: run the SDK with a restrictive mode and route tool decisions through our own `canUseTool`-style gate so every write/exec passes `agent/tools.ts`. Deny rules (protected paths, forbidden commands) are enforced in our gate and never overridable by approval mode (NFR-002).
- File writes are intercepted: the write tool stages to `changes/` instead of writing to disk. The agent believes the write succeeded; the diff between "agent's view" and disk is exactly the staging layer.
- Command execution: gated per approval mode; output captured and streamed.

`AgentBackend` interface (sketch):
```ts
interface AgentBackend {
  run(input: { intent: string; context: ContextPayload; mode: 'plan' | 'execute' }): AsyncIterable<AgentEvent>;
  interrupt(): void;
}
// AgentEvent: text | plan | tool_call | tool_result | done | error
```

### context/
Input: intent + repo state + memory + pins/exclusions. Output: `ContextPayload` (system prompt sections + file contents + repo map + recent failures). Phase 1 retrieval = deterministic heuristics: open/recently-edited files, path/keyword match against the intent, repo map (tree + symbol outline via VS Code's DocumentSymbol API), always-include `CLAUDE.md` and last failure output. Embeddings deferred. One module, aggressively iterated.

### changes/
Staging model: a shadow overlay (in-memory + on-disk journal under the extension's storage path) keyed by file. Renders hunks by diffing overlay vs. disk (use `diff` npm lib). `apply.ts` lands approved hunks atomically and records inverse patches for undo. Rejected hunks generate a structured "user rejected: <hunk>" message back into the session.

### checkpoint/
Git-based snapshots (ADR-4). Before each run: create a shadow commit of the working tree on a hidden ref (`refs/foxbagel/checkpoints/<runId>`) without touching the user's index/branch (plumbing: `git stash create`-style or `git commit-tree` on a temp index). Rollback = restore tree from the ref. Works with deletions/creations, survives restart, fast on large repos, and requires the workspace to be a git repo (acceptable: non-git workspaces get file-copy fallback for changed files only).

### verify/
Test command detection: look for standard scripts (`package.json` test, `pytest.ini`, `Makefile test`, etc.), else prompt user once and store per workspace. Runner uses child_process with streaming capture; a parser extracts failure summaries (framework-specific parsers for jest/vitest/pytest first, generic tail fallback). Loop controller: land → run → on fail, build failure context → re-invoke agent → cap at K → stuck-state.

### auth/
`AuthProvider` interface; `apiKey.ts` implementation (SecretStorage) ships. `oauth.ts` is scaffolded but gated behind a build flag until terms are verified (OQ-1).

### audit/
Every AgentEvent and gate decision appended to a per-run log; token usage read from SDK result messages; cost computed from a rates table marked approximate.

## 3. Data flow — golden path

1. Intent → `context/` builds payload → `agent/` runs in `plan` mode → plan event → UI.
2. User approves/edits plan → `checkpoint/` snapshots → `agent/` runs in `execute` mode with the approved plan injected.
3. Write tool calls → staged in `changes/` → hunks stream to UI → approvals land via `apply.ts`.
4. Agent (or loop controller) invokes test tool → `verify/` runs, parses → failure context re-enters step 2's session; success ends run.
5. `audit/` records everything; rollback available via the run's checkpoint ref.

## 4. Architecture Decision Records

Each decision is recorded under [adr/](adr/):

- [ADR-1](adr/0001-vscode-extension.md) — VS Code extension, not fork or scratch.
- [ADR-2](adr/0002-claude-agent-sdk.md) — Claude Agent SDK for the agent loop; thin `AgentBackend` seam.
- [ADR-3](adr/0003-all-writes-staged.md) — All writes staged; disk mutation only via apply.
- [ADR-4](adr/0004-git-ref-checkpoints.md) — Git-ref checkpoints with file-copy fallback.
- [ADR-5](adr/0005-react-webview.md) — React webview UI, esbuild bundling, no framework beyond it.
- [ADR-6](adr/0006-denylist-below-modes.md) — Deny-list enforced below approval modes.

## 5. Security and privacy

- Secrets: SecretStorage only; redaction pass on anything logged or sent as context (basic patterns: keys, tokens, `.env` contents excluded by default).
- Command execution sandboxing is out of scope for Phase 1 (documented limitation); the gate + deny-list + checkpoints are the mitigation.
- No telemetry without explicit opt-in.

## 6. Risks

R1. SDK API drift — mitigated by the ADR-2 seam; pin the SDK version, upgrade deliberately.
R2. Auth/terms volatility — the API-key path is the guaranteed ship path (OQ-1).
R3. Read-through-overlay consistency bugs (ADR-3 cost) — mitigate with an invariant test suite alongside the staging module.
R4. Webview perf on large diffs — virtualize the change stream list from day one.
