# Foxbagel

> **Pre-alpha.** Foxbagel is a young project — expect rough edges and rapid change. Feedback and contributors welcome.

An agent-first IDE where the **agent conversation, fused with a live change stream, is the primary surface** — and the code editor is demoted to a review-and-precision-edit pane. Shipping first as a VS Code extension.

**Status: pre-alpha — planning & design.** There is no product code yet. This repo currently holds the vision, requirements, architecture, and roadmap. Early contributors, feedback, and design discussion are welcome.

## Why another IDE?

Every mainstream IDE — including AI-forward ones like Cursor — is built on the assumption that the developer types most of the code. The editor is the primary surface; AI lives in a side panel or a terminal. But the real 2026 workflow has inverted: developers describe intent, an agent writes the code, and the human steers, reviews, and verifies. Today's tools force that workflow into a UI designed for a different era — developers babysit agents in cramped chat panels and review changes in interfaces built for typing.

This project inverts the hierarchy. Depth comes from agentic capability, not UI chrome: the screen stays spare while the plumbing underneath — checkpoints, plan-then-execute, project memory, test-iterate-to-green — does the heavy lifting.

## What makes it different

- **Review-optimized primary surface** — hunk-level approve / reject / redirect fused into the conversation, not bolted on.
- **Verification loop** — the agent runs tests, reads failures, and iterates to green as a first-class, visible workflow. Agent claims require proof.
- **Trust machinery** — automatic checkpoints with one-click rollback, plan-then-execute, and guardrails that make "let it run" psychologically safe.
- **Context control** — persistent project memory, a visible context budget, and pin/exclude for files.

These live in the harness layer that model providers don't own. Anything that is "just prompting" is explicitly *not* the moat.

## How it's built

A TypeScript VS Code extension in two halves connected by a typed message bridge:

- **Extension host (Node):** agent orchestration, the tool gate, staging, checkpoints, context building, verification, auth.
- **Webview (React):** the primary panel — conversation, change stream, hunk review, plan view, verify area, context/cost indicators.

It runs the agentic loop on the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) behind a thin provider seam, and stages every file write so nothing touches disk without passing the gate. See [`docs/architecture.md`](docs/architecture.md).

## Running it locally

The M0 shell (extension host + React webview + typed bridge) is scaffolded and builds:

```bash
npm install
npm run build
```

Open the folder in VS Code and press **F5** to launch an Extension Development Host, then open the panel from the activity-bar icon or the **Foxbagel: Open Panel** command. Run **Foxbagel: Set Anthropic API Key** (stored in SecretStorage) and you can hold a live, streaming conversation with the agent — file edits, checkpoints, and the verify loop come next. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full dev workflow.

## Documentation

| Doc | What's in it |
| --- | --- |
| [`docs/vision.md`](docs/vision.md) | Problem, vision, positioning, target user, success criteria |
| [`docs/prd.md`](docs/prd.md) | Functional & non-functional requirements (FR/NFR, MoSCoW) |
| [`docs/architecture.md`](docs/architecture.md) | Modules, interfaces, data flow, security |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |
| [`docs/open-questions.md`](docs/open-questions.md) | Open design questions — good entry points for discussion |
| [`ROADMAP.md`](ROADMAP.md) | Milestones and what each delivers |

## Contributing

Early and open. The [open questions](docs/open-questions.md) and `good first issue`s are the easiest way in. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and our [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

[Apache-2.0](LICENSE) — free and open source, no strings. This is a personal project, not built to be monetized. You bring your own Anthropic API key; the tool never resells inference.
