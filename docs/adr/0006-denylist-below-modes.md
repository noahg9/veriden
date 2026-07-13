# ADR-6 — Deny-list enforced below approval modes

Status: Accepted

## Context

Safety must not depend on how the user configured approval modes (NFR-002). Full-auto mode must still be safe.

## Decision

Deny rules (protected paths, forbidden commands) are enforced in the tool gate, beneath and independent of the approval mode. No approval mode can override them. Deny rules live in workspace settings plus built-in defaults (e.g. `.env*`, `~/.ssh`, `rm -rf` patterns).

## Consequences

- Safety is a property of the gate, not of configuration.
- Checkpoints and the deny-list remain in force even in full-auto mode.
