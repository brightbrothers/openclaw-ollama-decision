import { createProvider } from './provider.js';
import { writeFile } from 'node:fs/promises';
export const batch = { state: 'Checkout is failing for all customers.', questions: {
  escalate: { type: 'boolean', instructions: 'Does this require incident response?', criteria: { true: 'Widespread service outage', false: 'Routine request' } },
  route: { type: 'choice', instructions: 'Choose responsible team.', criteria: { support: 'Technical service failures', billing: 'Invoice questions' } },
  urgency: { type: 'score', instructions: 'Assess operational impact.', criteria: ['No disruption', 'One workflow blocked', 'Widespread outage'] },
} };
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const started = performance.now();
  let evidence;
  try {
    const outcome = await createProvider().evaluate(batch, { model: 'tev1:0.8b', signal: new AbortController().signal, deadlineMonotonicMs: started + 20000 });
    evidence = { timestamp: new Date().toISOString(), endpoint: 'http://127.0.0.1:11434/v1/systemone', latencyMs: Math.round((performance.now() - started) * 100) / 100, outcome };
  } catch (error) { evidence = { timestamp: new Date().toISOString(), latencyMs: Math.round(performance.now() - started), error: error.name }; }
  await writeFile(new URL('./smoke-evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
  if (evidence.outcome?.status !== 'ok') process.exitCode = 1;
}
