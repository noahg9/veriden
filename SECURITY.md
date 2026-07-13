# Security Policy

This is an early, pre-alpha project. Security still matters — especially because the tool is designed to run an AI agent against your codebase.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository, or email **noah@stretchinnovation.be**. You'll get an acknowledgement as soon as reasonably possible.

## Scope and current limitations

The project's safety model (see [`docs/architecture.md`](docs/architecture.md) §5 and [ADR-6](docs/adr/0006-denylist-below-modes.md)) is built around a gated tool layer, a deny-list enforced beneath all approval modes, staged writes, and checkpoints. Known, deliberate limitations for Phase 1:

- **No command-execution sandbox.** Approved shell commands run with the user's own privileges. The gate, deny-list, and checkpoints are the mitigation; OS-level sandboxing is out of scope for now and documented as such.
- **Bring-your-own-auth.** Your API key lives in VS Code SecretStorage and must never appear in logs, settings, or context sent to the model. Reports of key leakage are in scope and high priority.
- **No telemetry** is collected without explicit opt-in.

Reports that help harden any of the above are very welcome.
