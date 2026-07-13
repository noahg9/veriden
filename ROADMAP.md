# Roadmap

Phase 1 delivers the golden path (see [docs/prd.md](docs/prd.md) §2): intent → plan → reviewable changes → tests green → one-click rollback.

Milestones are dependency-ordered. Within a milestone, the work items are largely independent and parallelizable. Each work item below becomes a GitHub **milestone** with its scope broken into **issues**; some will be tagged `good first issue`. Story-level detail lives in issues, not here — this file is the map.

Status legend: ⬜ not started · 🟨 in progress · ✅ done

## M0 — Extension shell and bridge 🟨

Scaffold the extension, the primary webview panel, the typed host⇄webview bridge, and the build pipeline. Decide panel placement (OQ-3). Everything else depends on this.
Covers: FR-001, NFR-001.

Done: TypeScript extension host + React webview + typed bridge, esbuild pipeline, activity-bar panel with a working host⇄webview round-trip, F5 dev launch. Remaining: prototype the editor-tab panel placement and settle OQ-3 (current build uses the sidebar view); panel-state-survives-hide/show is wired via `retainContextWhenHidden` and wants a real test.

## M1 — Core loop (after M0) 🟨

The foundation the golden path runs on. These are mostly independent of each other.

- **Auth layer** 🟨 — `AuthProvider` interface + API-key implementation on SecretStorage with set/clear commands (FR-009, part of NFR-003) done. Remaining: actionable error states, OAuth scaffold behind a build flag.
- **Agent core and gated tools** 🟨 — the `AgentBackend` seam, live streaming with interrupt that takes effect before the next tool call (FR-002, part of FR-008), and a streaming tool-use loop with a gated tool layer — `read_file`/`list_dir`/`write_file`, read-through-overlay reads, staged writes, workspace-confinement + deny-list enforced consistently across all tools and below any mode (FR-003, ADR-6). Remaining: redirect (the other half of FR-008 — injecting a new message into a stopped run); gated command execution; swap in the Claude Agent SDK backend (NFR-003); persist the full tool-aware session transcript (currently cross-turn memory is text-only).
- **Staging, change stream, and hunk review** 🟨 — the in-memory staging overlay (ADR-3), full-file diff via `diff`, apply-on-approve to disk, and the primary-surface UI: change cards with colored diffs and approve/reject, with reject-feedback into the session (FR-004). Remaining: per-hunk granularity + inline edit, on-disk journal + inverse patches, open-in-editor, virtualization for large diffs, same-file card dedup, and the ADR-3 invariant test suite.

## M2 — Trust and context (after M1) ⬜

- **Checkpoints and rollback** — git-ref snapshots per run, one-click rollback, checkpoint list UI, file-copy fallback for non-git workspaces, crash recovery. Covers FR-006, NFR-004, ADR-4.
- **Plan-then-execute and approval modes** — plan mode via the SDK, editable plan UI, plan-step progress, skip-for-small-tasks toggle; the three approval modes with an always-visible mode indicator. Covers FR-005, FR-012.
- **Context builder and project memory** — repo map (tree + symbols), heuristic retrieval, `CLAUDE.md` memory with a UI affordance, pins/exclusions, approximate token meter. Covers FR-010, FR-011, NFR-005.

## M3 — Verification loop (after M1–M2) ⬜

Test-command detection/config, streaming runner, jest/vitest/pytest failure parsers + generic fallback, the land→run→feed-back→iterate controller with cap and stuck-state, verify-area UI with evidence.
Covers: FR-007. Depends on the agent core, staging, and checkpoints.

## M4 — Audit, polish, and first release ⬜

Run timeline linked to hunks/outputs, token/cost meter, onboarding (first-run flow, test-command prompt), golden-path hardening, marketplace listing, docs, and shipping to the first external developers.
Covers: FR-013, and the Phase-1 success criteria in [docs/vision.md](docs/vision.md).

## Deferred (post-Phase-1)

Explain-this-change (FR-014) · lint/typecheck gate (FR-015) · parallel worktree agents · semantic diff summaries · model routing across providers · team features · subscription sign-in (pending OQ-1).
