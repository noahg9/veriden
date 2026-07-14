# ADR-4 — Git-ref checkpoints with file-copy fallback

Status: Accepted (resolves OQ-2)

## Context

Every run must be rollback-able, including file creations and deletions, surviving an extension restart, and fast on large repos — without polluting the user's branch or index.

## Decision

Take git-based snapshots before each run: a shadow commit of the working tree on a hidden ref (`refs/foxbagel/checkpoints/<runId>`), created without touching the user's index/branch (`git stash create`-style, or `git commit-tree` on a temp index). Rollback restores the tree from the ref. Non-git workspaces get a file-copy fallback covering only changed files.

## Consequences

- O(changed files) cost; survives restart; handles create/delete; no user-visible branch/index pollution.
- Rejected alternatives: full file-copy snapshots (slow on big repos); relying on staged-only state (doesn't cover approved-then-iterated changes).
- Requires a git repo for the fast path; the fallback is a documented, narrower guarantee.
