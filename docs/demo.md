# 30-second walkthrough

The README GIF is an edited animation using actual captured 0.8B OpenClaw output,
not a screen recording or a real-time latency demonstration. See [the example](example.md).

To record your own 30–60-second demo:

1. Pull the selected Tev1 model before recording; start local Ollama.
2. Show the synthetic checkout state and three questions in `smoke.js`.
3. Run `npm run smoke` (0.8B), or `npm run smoke -- --model tev1:4b --timeout-ms 120000`.
4. Show the actual model, outcome and typed answers.
5. Explain that automatic routing requires a separate consumer, and that confidence is not accuracy.
6. Show the repository link. Avoid unrelated desktop content or private configs.

Both adapter smokes passed on 2026-10-11 with Ollama 0.40.2 and Node 24.18.0.
4B host/picker integration was not independently rerun. No comparative benchmark is claimed.
