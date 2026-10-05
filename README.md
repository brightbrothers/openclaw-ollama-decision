# Ollama Decision for OpenClaw

A community plugin that connects **tev1:0.8b**, running locally in Ollama,
to OpenClaw's **Decision model** role. Zero runtime dependencies; plain ESM.

- Provider: `ollama-decision`
- Decision model selector: `ollama-decision/tev1:0.8b`
- Endpoint: `http://127.0.0.1:11434/v1/systemone`
- Supports Boolean, Choice and Score questions.

This is an independent community project, not an official OpenClaw or Ollama plugin.
It does not replace your conversational model.

## Requirements and compatibility

- Node.js 22 or newer.
- OpenClaw with `api.registerDecisionProvider`, Decision provider contract v1,
  and manifest `decisionModels` support. Integration was verified on OpenClaw
  **2026.9.8** (runtime loading, model catalog and a real `decision_evaluate` batch).
  Older releases and every future release are not independently verified.
- A local Ollama build supporting **POST `/v1/systemone`** and the
  `tev1:0.8b` model. A working `/api/chat` endpoint alone is insufficient.

Only `tev1:0.8b` is registered in this version. This is not a generic Ollama chat provider.

## Install

Start your local Ollama service, then download the model if needed:

```sh
ollama pull tev1:0.8b
```

Clone and review the plugin, run the tests, then install from the local checkout:

```sh
git clone https://github.com/brightbrothers/openclaw-ollama-decision.git
cd openclaw-ollama-decision
npm test
openclaw plugins install .
```

OpenClaw may ask you to trust this community source and approve its declared
capabilities. Review those prompts. If the plugin is not enabled after installation:

```sh
openclaw plugins enable ollama-decision
openclaw plugins inspect ollama-decision --runtime --json
```

In OpenClaw's **Decision** model picker, select
`ollama-decision/tev1:0.8b` for the intended agent. Leave the chat-model picker unchanged.
Alternatively, merge the relevant fields into your existing config:

```json
{
  "plugins": {
    "entries": {
      "ollama-decision": {
        "enabled": true,
        "config": { "baseURL": "http://127.0.0.1:11434" }
      }
    }
  },
  "agents": {
    "defaults": { "decisionModel": "ollama-decision/tev1:0.8b" }
  }
}
```

The defaults field affects agents inheriting it; use an agent-specific Decision
selection to limit scope. Do not replace your whole config with this snippet.

## Test

```sh
npm test        # mocked unit tests; no Ollama or OpenClaw required
npm run smoke   # one synthetic three-question batch against local Ollama
```

The smoke script sets a 20-second deadline, prints the outcome and writes
`smoke-evidence.json` (gitignored, excluded from the npm package).
It checks adapter connectivity and response structure, not model accuracy.
Cold model loading may exceed short Decision deadlines; pre-warm with the smoke
script before testing time-sensitive consumers.

## Mapping and limits

- Boolean maps to System One `noul`; its answer maps to `probabilityTrue`.
- Choice preserves labels and their probability map.
- Score converts canonical index keys `0..N-1` into an ordered probability array
  and preserves fractional scores.
- Rounded probabilities are preserved, not normalized; scores are not recomputed.
- Confidence is provider-specific, not a guarantee of correctness.
- 1–64 questions per batch; 2–26 Choice alternatives or Score levels.
- State must be nonempty text, an object or an array. Structured criteria are
  serialized as JSON text; null criteria are accepted only for Choice.
- Missing instructions get a neutral default. Unsupported models/input fail
  before dispatch. There is no token truncation or retry.

The provider validates answer types, exact question/distribution keys, labels,
finite numeric ranges and usage counters. Request/response bodies are limited to
1 MiB. Caller cancellation and monotonic deadlines abort network operations.
HTTP errors and invalid responses become structured unavailable outcomes.

## Locality and privacy

`baseURL` accepts only HTTP loopback origins: `localhost`, `127.0.0.1` or `[::1]`,
with an optional port. Credentials, paths, query strings, remote hosts and redirects
are rejected. This plugin has no API keys, telemetry, prompt logging or dependencies.
Submitted state and criteria are sent to your local Ollama endpoint; that service's
own behavior and logging are outside this plugin's control.

`isReady()` means the plugin needs no credentials. It does **not** probe Ollama or
prove that the model is loaded. Connectivity is established by evaluation.

If Node is configured to use an environment proxy, ensure loopback requests bypass
it (for example using an appropriate `NO_PROXY`). An environment that still proxies
localhost can yield a transport-unavailable outcome.

## Integration boundary

Selecting this model makes explicit Decision calls available to supported OpenClaw
consumers. It does **not** itself enable automatic tool filtering, memory selection,
model routing or background jobs. Automatic consumers depend on your OpenClaw
release, experimental-feature settings and runtime harness. Codex-harness tool
prefiltering is not provided by this plugin.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bugs and compatibility reports are welcome.
Please use synthetic examples and remove personal data and credentials from reports.

## License

MIT. See [LICENSE](LICENSE). Ollama, OpenClaw and model weights retain their own licenses.
