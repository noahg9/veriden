# ADR-3 — All writes staged; disk mutation only via apply

Status: Accepted

## Context

Hunk review, undo, approval modes, and crash safety all depend on the disk never being mutated directly by the agent.

## Decision

The agent's write tool stages to `changes/` instead of writing to disk. Disk is mutated only when a hunk is approved and applied via `apply.ts`. The agent's read tool consults staging first (read-through-overlay) so the agent's view stays self-consistent.

## Consequences

- This single invariant powers hunk review, undo, approval modes, and crash safety.
- Cost: reads must go through the overlay, which introduces consistency edge cases (Risk R3) — cover with an invariant test suite alongside the staging module.
