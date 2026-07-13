# Open questions

Design questions that aren't settled yet. These are good entry points for discussion — open a GitHub Discussion or issue to weigh in. Resolved questions move into [prd.md](prd.md) or an ADR under [adr/](adr/).

## OQ-1 — Subscription sign-in for a shipped product

Can the shipped product support subscription (OAuth) sign-in in addition to API-key auth, or do provider commercial terms restrict that to first-party clients? Anthropic's docs conflicted as of 2026-07. The API-key path is the guaranteed ship path regardless; OAuth is scaffolded behind a build flag until terms are verified. Verify against current commercial terms at build time.

## OQ-2 — Checkpoint mechanism

Git-based snapshots (shadow commits / `git stash create`-style) vs. file-copy snapshots. Leaning git-based for O(changed files) cost and create/delete handling, with a file-copy fallback for non-git workspaces. Tracked in [adr/0004-git-ref-checkpoints.md](adr/0004-git-ref-checkpoints.md).

## OQ-3 — Panel placement

Editor-area webview tab vs. sidebar for the primary panel. Prototype both early and pick by feel. Decided during the extension-shell milestone (M0).
