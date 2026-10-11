import { createProvider } from './provider.js';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export const MODELS = ['tev1:0.8b', 'tev1:4b'];
export const DEFAULT_TIMEOUT_MS = 20000;
export const MAX_TIMEOUT_MS = 300000;
export const batch = { state: 'Checkout is failing for all customers.', questions: {
  escalate: { type: 'boolean', instructions: 'Does this require incident response?', criteria: { true: 'Widespread service outage', false: 'Routine request' } },
  route: { type: 'choice', instructions: 'Choose responsible team.', criteria: { support: 'Technical service failures', billing: 'Invoice questions' } },
  urgency: { type: 'score', instructions: 'Assess operational impact.', criteria: ['No disruption', 'One workflow blocked', 'Widespread outage'] },
} };
export function parseArgs(args) {
  let model = 'tev1:0.8b';
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i], value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Expected a value after ${flag}`);
    if (flag === '--model' && MODELS.includes(value)) model = value;
    else if (flag === '--timeout-ms' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= MAX_TIMEOUT_MS) timeoutMs = Number(value);
    else throw new Error(`Unsupported argument: ${flag} ${value}`);
  }
  return { model, timeoutMs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let options;
  try { options = parseArgs(process.argv.slice(2)); }
  catch (error) {
    console.error(`${error.message}\nUsage: npm run smoke -- [--model tev1:0.8b|tev1:4b] [--timeout-ms 1-${MAX_TIMEOUT_MS}]`);
    process.exitCode = 2;
  }
  if (!options) process.exit();
  const started = performance.now();
  let evidence;
  try {
    const outcome = await createProvider().evaluate(batch, { model: options.model, signal: new AbortController().signal, deadlineMonotonicMs: started + options.timeoutMs });
    evidence = { timestamp: new Date().toISOString(), requestedModel: options.model, timeoutMs: options.timeoutMs, endpoint: 'http://127.0.0.1:11434/v1/systemone', latencyMs: Math.round((performance.now() - started) * 100) / 100, outcome };
  } catch (error) { evidence = { timestamp: new Date().toISOString(), requestedModel: options.model, timeoutMs: options.timeoutMs, latencyMs: Math.round(performance.now() - started), error: error.name }; }
  await writeFile(new URL('./smoke-evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
  if (evidence.outcome?.status !== 'ok') process.exitCode = 1;
}
