# ADR-1 — VS Code extension, not a fork or from scratch

Status: Accepted

## Context

The product needs to ship fast, reach developers where they are, and inherit editor/LSP/git ecosystem plumbing rather than rebuild it.

## Decision

Build as a VS Code extension. Do not fork VS Code, and do not build an editor from scratch.

## Consequences

- Instant marketplace distribution; inherited editor, LSP, and git integration; days-to-prototype.
- Constrained by the extension API's layout affordances (see OQ-3 on panel placement).
- Revisit trigger: a required UX — e.g. replacing the editor-area layout wholesale — that the extension API demonstrably cannot express.
