# Vision — Veriden, an agent-first IDE

Status: Draft v1 · 2026-07 · Downstream: [prd.md](prd.md), [architecture.md](architecture.md), [../ROADMAP.md](../ROADMAP.md)

## Problem

Every mainstream IDE — including AI-forward ones like Cursor — is architected around the assumption that the developer types most of the code. The editor is the primary surface; AI lives in a side panel or a terminal. But the actual workflow of developers in 2026 has inverted: they describe intent, an agent writes the code, and the human's job is steering, reviewing, and verifying. Today's tools force that workflow into a UI built for a different era. The result: developers babysit agents in cramped chat panels, review changes in interfaces designed for typing, and have no purpose-built support for the things agentic work actually needs — checkpoints, plans, verification, context control.

## Vision

A lightweight IDE where the agent conversation fused with a live change stream is the primary surface, and the code editor is demoted to a review-and-precision-edit pane. Depth comes from agentic capability, not UI chrome: the screen stays spare while the plumbing underneath (checkpoints, plan-mode, project memory, test-iterate-to-green) does the heavy lifting.

## Positioning

- Not "an editor with a chat panel" (Cursor, Copilot) — the hierarchy is inverted.
- Not "a terminal agent" (Claude Code CLI) — purpose-built UI for steering, review, and verification.
- The wedge is the pairing of the layout inversion with a verification loop: the agent runs tests, reads failures, and iterates to green as a first-class, visible workflow.

## Target user

Professional developers who already work agent-first (or want to) and find existing tools built around the wrong primary surface. Phase 1 targets individual developers on real codebases; teams come later.

## Differentiators (defensible layer)

1. Review-optimized primary surface: hunk-level approve/reject/redirect fused into the conversation, not bolted on.
2. Verification loop: run tests → feed failures back → iterate → show evidence. Agent claims require proof.
3. Trust machinery: checkpoints with one-click rollback, plan-then-execute, guardrails. Makes "let it run" psychologically safe.
4. Context control: persistent project memory, visible context budget, pin/exclude files.

These live in the harness layer that model providers don't own; anything that is "just prompting" is explicitly not the moat.

## Constraints and principles

- Lightweight: features add agent capability, not UI surface. Ration visible chrome hard.
- Ship as a VS Code extension first; fork only if the extension API demonstrably caps the product.
- Bring-your-own-auth (API key guaranteed; subscription sign-in only if provider terms permit at ship time). Never resell inference.
- Provider terms are volatile (changed twice in early 2026); auth and SDK access sit behind thin internal interfaces.

## Open source

A personal, free, and open-source project under Apache-2.0 — not built to be monetized. Being auditable is part of the value: a tool that runs an agent inside your codebase earns trust fastest when its gate, deny-list, and "no code leaves without redaction" claims can be inspected.

Users bring their own Anthropic API key; the tool never resells inference. Whether a shipped build can also offer subscription (OAuth) sign-in is a separate, terms-dependent question (see [open-questions.md](open-questions.md), OQ-1).

## Success criteria for Phase 1

- 5 external developers complete the golden-path workflow (intent → plan → changes → tests green) on their own repos.
- At least 3 of them return unprompted within a week.
- The golden-path demo is convincingly better in this tool than the same task in Cursor.

## Explicit non-goals (Phase 1)

VS Code fork; multi-provider model routing beyond one seam; team/collab features; parallel multi-agent worktrees (Phase 3 candidate); plugin system; cloud sync; building our own editor component.
