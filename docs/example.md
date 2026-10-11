# Local incident triage: reproducible example

Input is synthetic. The output below was captured from a real OpenClaw
`decision_evaluate` call using the installed v0.1.0 adapter and `tev1:0.8b`
on 2026-10-11. The v0.2.0 adapter separately passed the same three-question
smoke for both models on Ollama 0.40.2 and Node 24.18.0.

## Through OpenClaw

Install the plugin as in README and select `ollama-decision/tev1:0.8b` in
the agent Decision picker. Ask the agent to invoke `decision_evaluate`
with this exact input (tool availability depends on the host runtime):

```json
{
  "state": "Checkout is failing for all customers.",
  "questions": {
    "escalate": {
      "type": "boolean",
      "instructions": "Does this require incident response?",
      "criteria": {
        "true": "Widespread service outage",
        "false": "Routine request"
      }
    },
    "route": {
      "type": "choice",
      "instructions": "Choose responsible team.",
      "criteria": {
        "support": "Technical service failures",
        "billing": "Invoice questions"
      }
    },
    "urgency": {
      "type": "score",
      "instructions": "Assess operational impact.",
      "criteria": [
        "No disruption",
        "One workflow blocked",
        "Widespread outage"
      ]
    }
  }
}
```

## Captured answer

```json
{
  "model": "tev1:0.8b",
  "answers": {
    "escalate": {
      "type": "boolean",
      "probabilityTrue": 0.8887648173755832
    },
    "route": {
      "type": "choice",
      "choice": "support",
      "probabilities": {
        "support": 0.7621309707048192,
        "billing": 0.23786902929518097
      },
      "confidence": 0.20852144558441377
    },
    "urgency": {
      "type": "score",
      "score": 1.9095707824356793,
      "probabilities": [
        0.0024082742763663896,
        0.08561266901158757,
        0.9119790567120459
      ],
      "confidence": 0.7187574401673605
    }
  },
  "usage": {
    "inputTokens": 812,
    "outputTokens": 4
  }
}
```

Boolean is a probability, Choice includes competing options, and Score is a
fractional position on a zero-based rubric. Results inform decisions; they
do not trigger escalation or routing automatically. Output may differ across
versions and runs. Confidence is distribution concentration, not accuracy.

## Without OpenClaw: test the adapter

From the repository checkout, with local Ollama running:

```sh
ollama pull tev1:0.8b
npm run smoke
ollama pull tev1:4b
npm run smoke -- --model tev1:4b --timeout-ms 120000
```

For Node environment proxies, prefix the command with
`NO_PROXY=localhost,127.0.0.1,::1`. The script prints and saves the actual
response; it uses the same synthetic state and questions. A successful adapter
smoke does not independently verify the 4B model in the OpenClaw picker.
