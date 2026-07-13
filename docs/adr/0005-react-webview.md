# ADR-5 — React webview UI, esbuild bundling, no framework beyond it

Status: Accepted

## Context

The lightweight principle demands minimal chrome and minimal dependencies. The primary panel is one screen, not an application platform.

## Decision

Build the webview with React, bundled with esbuild. Add no UI framework beyond that.

## Consequences

- Fast builds, small bundle, low ceremony.
- Any temptation toward a heavier framework should be resisted unless the one-screen assumption breaks.
- Large diffs require virtualizing the change-stream list from day one (Risk R4).
