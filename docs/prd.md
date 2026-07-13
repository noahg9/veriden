# PRD — Veriden (Phase 1)

Status: Draft v1 · Source: [vision.md](vision.md) · Downstream: [architecture.md](architecture.md), [../ROADMAP.md](../ROADMAP.md)

## 1. Goals

G1. Ship a VS Code extension where the agent + change stream is the primary surface and the editor is the review/precision pane.
G2. Make "let the agent run" safe: checkpoints, plans, guardrails, approvals.
G3. Make the agent verifiably correct: an automatic test-iterate-to-green loop with visible evidence.
G4. Stay lightweight: minimal visible chrome; depth lives in agent capability.

## 2. Users and golden path

Primary persona: professional developer, works on an existing repo with a test suite, already uses agentic tools daily.

Golden path (the one workflow Phase 1 must nail):
1. Open repo → open the panel.
2. Type intent ("add rate limiting to the API endpoints, 100 req/min per key").
3. Agent proposes a plan → user edits/approves it.
4. Checkpoint is taken automatically → agent executes.
5. Changes stream in as reviewable hunks; user approves/rejects/redirects inline.
6. Agent runs the test suite, reads failures, iterates (capped) to green.
7. User sees evidence (test output), final diff, and can roll back the entire run in one click.

## 3. Functional requirements

FR-001 (MUST) — Primary panel. A webview panel hosting conversation + change stream + review + verify areas, openable as the main workspace surface.
  AC: panel opens via command and activity-bar icon; state survives panel hide/show; works with editor group minimized.

FR-002 (MUST) — Agent sessions. Send an intent; stream the agent's steps (text, tool calls, results) live into the conversation.
  AC: first token visible < 2s after send (network permitting); streaming renders incrementally; a session transcript persists per workspace.

FR-003 (MUST) — Gated tool layer. All agent file writes and command executions flow through extension-owned tools; nothing touches disk or shell without passing the gate.
  AC: zero write paths bypass staging; command execution requires approval unless the command matches a user allowlist; a deny-list (protected paths, forbidden commands) is enforced regardless of mode.

FR-004 (MUST) — Staged changes + hunk review. Agent edits go to a staging layer and render as per-file, per-hunk diffs with approve / reject / edit-inline actions.
  AC: hunk approve writes only that hunk; reject discards it and informs the agent; user can open the file at the hunk location in the editor in one click.

FR-005 (MUST) — Plan-then-execute. Before making changes, the agent produces an editable plan (steps + files it expects to touch); execution starts only on user approval. A "skip plan for small tasks" toggle exists.
  AC: plan is editable as text; edited plan is what the agent executes against; plan step progress is visible during execution.

FR-006 (MUST) — Checkpoints and rollback. A workspace snapshot is taken automatically before each run; any run can be rolled back in one click; last N checkpoints listed.
  AC: rollback restores all files changed in the run, including deletions/creations; rollback completes < 5s on a 10k-file repo; checkpoints survive extension restart.

FR-007 (MUST) — Verification loop. After changes land, run the configured test command; on failure, feed structured failure output back to the agent and iterate automatically, capped at K iterations (default 4); then surface a clear "stuck — over to you" state.
  AC: test output streams into the verify area; each iteration is visibly numbered; success state shows the passing evidence; cap is user-configurable.

FR-008 (MUST) — Interrupt and redirect. User can stop the agent mid-run and send a redirect without losing conversation/staging context.
  AC: stop takes effect before the next tool call; staged-but-unapproved hunks are preserved; redirect message is injected into the same session.

FR-009 (MUST) — Auth. API-key auth (stored in VS Code SecretStorage). Subscription sign-in ships only if provider terms verifiably permit it at release; the auth layer is an interface with both implementations behind it.
  AC: key never appears in logs or settings JSON; auth failure produces an actionable error, not a silent hang.

FR-010 (SHOULD) — Project memory. A `CLAUDE.md` (or configurable) rules file in the repo root is always included in agent context; a UI affordance shows it's loaded and opens it for editing.
  AC: edits take effect on the next turn; absence of the file is handled gracefully with a one-click "create" offer.

FR-011 (SHOULD) — Context visibility and control. Show which files/artifacts are in the current context; allow pinning files in and excluding files/globs.
  AC: pins persist per workspace; exclusions are respected by the context builder; an approximate token meter is shown.

FR-012 (SHOULD) — Approval modes. Per-workspace setting: manual (approve every hunk and command) / auto-edits (hunks auto-land, commands still gated) / full-auto (everything runs; checkpoints and deny-list still enforced).
  AC: mode is visible at all times in the panel; switching modes mid-run applies from the next action.

FR-013 (SHOULD) — Run audit + cost. A per-run timeline of every tool call and an approximate token/cost meter per task and per session.
  AC: timeline entries link to the relevant hunk/output; costs use current published per-token rates and are labeled approximate.

FR-014 (COULD) — "Explain this change": one click on a hunk asks the agent to justify it inline.
FR-015 (COULD) — Lint/typecheck gate before hunks can land (configurable command).
FR-016 (WON'T, this release) — Parallel agents on git worktrees; team features; model routing across providers; semantic (behavioral) diff summaries; our own editor.

## 4. Non-functional requirements

NFR-001 (MUST) — Lightweight: extension activation < 500ms; idle CPU ~0; panel interactive < 1s after open.
NFR-002 (MUST) — Safety: deny-list enforcement cannot be overridden by any approval mode; secrets never leave SecretStorage; no telemetry without opt-in.
NFR-003 (MUST) — Resilience to provider change: agent SDK and auth are each behind a single internal interface; swapping either is a one-module change.
NFR-004 (MUST) — Recoverability: no user code loss under any failure — crash mid-run must leave the workspace restorable from the last checkpoint.
NFR-005 (SHOULD) — Repo scale: golden path remains responsive on repos up to ~10k files / 1M LOC; context builder degrades gracefully beyond that.
NFR-006 (SHOULD) — Offline behavior: clear, non-blocking error states when the network or provider is down; staged work is never lost.

## 5. Prioritization summary (MoSCoW)

Must: FR-001..009, NFR-001..004 — this set is the shippable Phase 1.
Should: FR-010..013, NFR-005..006 — target for Phase 1 if timeline holds, else fast-follow.
Could: FR-014..015. Won't (this release): FR-016 list.

## 6. Open questions

Tracked in [open-questions.md](open-questions.md): OQ-1 (subscription sign-in legality), OQ-2 (checkpoint mechanism — see [adr/0004-git-ref-checkpoints.md](adr/0004-git-ref-checkpoints.md)), OQ-3 (panel placement — decided in M0).
