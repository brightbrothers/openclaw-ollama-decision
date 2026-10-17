# Changelog

## 0.2.1 — 2026-10-17

- Support OpenClaw 2026.10.4 automatic-consumer admission at final Ollama dispatch.
- Prevent network requests when host admission is revoked; propagate host authority assertions unchanged.
- Preserve explicit Decision calls and older hosts without the optional callback.
- Update build metadata and compatibility documentation; retain minimum plugin API 2026.9.8.
- Add regression tests for allowed, revoked and throwing admission checks.
- No model changes; Tev1 0.8B and 4B remain supported.

## 0.2.0 — 2026-10-11

- Add exact `tev1:4b` provider and manifest support alongside `tev1:0.8b`.
- Add smoke CLI model and bounded timeout selectors; record requested model.
- Add synthetic incident-triage demo and release promotion drafts.
- Live `tev1:4b` integration remains unverified; no benchmark claims.

- Real local Boolean/Choice/Score smoke passed for both models on Ollama 0.40.2.
- README animated walkthrough, reproducible OpenClaw tool example, exact host metadata and catalog icon.

## 0.1.0

- Initial community release.
- Local Ollama System One adapter for tev1:0.8b.
- Boolean, Choice and Score conversion with strict response validation.
- Loopback-only configuration, bounded bodies, caller cancellation and deadlines.
- Mocked tests and an opt-in synthetic local smoke check.
