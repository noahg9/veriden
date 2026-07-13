# ADR-2 — Claude Agent SDK for the agent loop, behind a thin seam

Status: Accepted

## Context

The agentic loop — planning, tool loop, context compaction, permissions, interrupts — is hard to build well and is not where this product differentiates. Provider terms and SDK APIs are volatile (changed twice in early 2026).

## Decision

Use `@anthropic-ai/claude-agent-sdk` for the agent loop. Confine all SDK touchpoints behind a single internal `AgentBackend` interface (`agent/sdk.ts`). Use the SDK's native `plan` permission mode and interrupt support rather than reimplementing them.

## Consequences

- Rebuilding the loop is negative-value; the SDK gives it for free.
- The seam contains provider volatility — swapping the backend is a one-module change (NFR-003).
- Pin the SDK version and upgrade deliberately (Risk R1).
