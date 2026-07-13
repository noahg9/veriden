# Contributing

Thanks for your interest — this project is early and open. Right now it's in the **planning & design** stage: there's no product code yet, so the most valuable contributions are ideas, critiques, and design decisions.

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help right now

- **Weigh in on the [open questions](docs/open-questions.md)** — panel placement, checkpoint mechanism, auth. Open a Discussion or comment on the tracking issue.
- **Poke holes in the design** — read the [vision](docs/vision.md), [PRD](docs/prd.md), and [architecture](docs/architecture.md) and tell us where they're wrong.
- **Pick up a `good first issue`** once code lands (see the [roadmap](ROADMAP.md) for what's coming).

## How we make decisions

- **Architectural decisions** are recorded as ADRs in [`docs/adr/`](docs/adr/). Substantial changes to how the system works start as a PR adding or amending an ADR, so the reasoning is reviewable before code is written.
- **Requirements** carry stable IDs (FR-/NFR- in the [PRD](docs/prd.md)); reference them in issues and PRs so scope stays traceable.
- **Roadmap** milestones map to GitHub milestones; scoped work lives in issues.

## Development

The M0 shell is scaffolded: a TypeScript extension host and a React webview, connected by a typed message bridge and bundled with esbuild (see [ADR-5](docs/adr/0005-react-webview.md)).

```bash
npm install       # install dependencies
npm run build     # bundle extension + webview into dist/
npm run watch     # rebuild on change
npm run typecheck # tsc --noEmit
```

Then open the folder in VS Code and press **F5** ("Run Extension") to launch an Extension Development Host with the extension loaded. Open the panel from the activity-bar icon or the **Veriden: Open Panel** command.

Layout:

- `src/` — extension host (Node): `extension.ts` (activation), `panel.ts` (webview view provider), `bridge.ts` (shared, typed host⇄webview message contracts).
- `webview/` — React UI (browser sandbox): `index.tsx`, `App.tsx`, `vscode.ts` (typed `postMessage` handle).
- `esbuild.mjs` — builds both bundles (Node/CJS for the host, browser/IIFE for the webview).

Coming next, per the architecture: the agent loop on the Claude Agent SDK behind an internal seam ([ADR-2](docs/adr/0002-claude-agent-sdk.md)); bring your own Anthropic API key, stored in VS Code SecretStorage and never in logs or settings.

## Pull requests

- Branch off `main`; keep PRs focused and reference the relevant issue / FR-ID.
- Match the surrounding code's style and conventions.
- Sign off your commits (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/). This keeps contribution provenance clean under the project's [Apache-2.0](LICENSE) license.

## License

By contributing, you agree your contributions are licensed under the project's [Apache-2.0](LICENSE) license.
