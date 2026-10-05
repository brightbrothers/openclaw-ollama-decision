# Contributing

Run `npm test` on Node.js 22 or newer. No dependency installation is needed.
If available, `npm run smoke` exercises your local Ollama System One endpoint.
Do not commit generated smoke evidence, local configs, tokens or user transcripts.

For bug reports, include plugin, Node.js, OpenClaw and Ollama versions, the outcome
reason and a minimal synthetic example. Avoid private state, full config dumps and
server logs containing credentials. Please add a focused regression test for bug fixes.

Keep registration synchronous and network-free, preserve caller deadlines and
cancellation, and keep remote endpoints and redirects disallowed.

Contributions are licensed under the project's MIT license.

## GitHub Actions template

`ci/github-actions.yml` runs tests and a package dry-run on Node.js 22 and 24.
It is a template, not an active workflow. A maintainer with the necessary GitHub
workflow permission can copy it to `.github/workflows/test.yml` to enable CI.
