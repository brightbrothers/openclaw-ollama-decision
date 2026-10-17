import test from 'node:test';
import assert from 'node:assert/strict';
import { createProvider } from '../provider.js';
import plugin from '../index.js';
import { batch, parseArgs, DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from '../smoke.js';
import { readFile } from 'node:fs/promises';
const ctx = () => ({ model: 'tev1:0.8b', signal: new AbortController().signal, deadlineMonotonicMs: performance.now() + 1000 });
const valid = (model = 'tev1:0.8b') => ({ model, answers: { escalate: { type: 'noul', noul: .9 }, route: { type: 'choice', choice: 'support', probabilities: { support: .9, billing: .1 }, confidence: .5 }, urgency: { type: 'score', score: 1.8, probabilities: { '0': .05, '1': .1, '2': .85 } } }, usage: { input_tokens: 20, output_tokens: 3 } });
const mock = data => async () => Response.json(data);
test('registration is synchronous and network-free', () => { let p; plugin.register({ registerDecisionProvider(x) { p = x; } }); assert.equal(p.id, 'ollama-decision'); assert.equal(p.isReady(), true); });
test('all types, wire translation and usage', async () => {
 const p = createProvider({}, async (url, init) => { assert.equal(url.pathname, '/v1/systemone'); assert.equal(JSON.parse(init.body).questions.escalate.type, 'noul'); return Response.json(valid()); });
 const out = await p.evaluate(batch, ctx()); assert.equal(out.status, 'ok'); assert.equal(out.result.answers.escalate.probabilityTrue, .9); assert.deepEqual(out.result.answers.urgency.probabilities, [.05,.1,.85]); assert.equal(out.result.usage.inputTokens, 20);
});
test('tev1:4b sends exact model and normalizes the System One response', async () => {
 const p = createProvider({}, async (url, init) => { const wire = JSON.parse(init.body); assert.equal(url.pathname, '/v1/systemone'); assert.equal(wire.model, 'tev1:4b'); assert.equal(wire.questions.escalate.type, 'noul'); return Response.json(valid('tev1:4b')); });
 const out = await p.evaluate(batch, { ...ctx(), model: 'tev1:4b' });
 assert.deepEqual(JSON.parse(JSON.stringify(out)), { status: 'ok', result: { model: 'tev1:4b', answers: { escalate: { type: 'boolean', probabilityTrue: .9 }, route: { type: 'choice', choice: 'support', probabilities: { support: .9, billing: .1 }, confidence: .5 }, urgency: { type: 'score', score: 1.8, probabilities: [.05, .1, .85] } }, usage: { inputTokens: 20, outputTokens: 3 } } });
});
test('manifest registers both supported models with matching capabilities', async () => {
 const manifest = JSON.parse(await readFile(new URL('../openclaw.plugin.json', import.meta.url), 'utf8'));
 assert.deepEqual(manifest.decisionModels, ['tev1:0.8b', 'tev1:4b'].map((id, i) => ({
  provider: 'ollama-decision', id, name: `Tev1 ${i === 0 ? '0.8B' : '4B'} (local Ollama)`,
  capabilities: { questionTypes: ['boolean', 'choice', 'score'], maxQuestions: 64, maxChoiceAlternatives: 26, maxScoreLevels: 26, requiresBooleanCriteria: false, confidence: 'provider-specific' },
 })));
});
test('smoke CLI defaults and validates bounded selectors', () => {
 assert.deepEqual(parseArgs([]), { model: 'tev1:0.8b', timeoutMs: DEFAULT_TIMEOUT_MS });
 assert.deepEqual(parseArgs(['--model', 'tev1:4b', '--timeout-ms', '30000']), { model: 'tev1:4b', timeoutMs: 30000 });
 for (const args of [['--model', 'tev1:14b'], ['--timeout-ms', '0'], ['--timeout-ms', String(MAX_TIMEOUT_MS + 1)], ['--timeout-ms', '2.5']]) assert.throws(() => parseArgs(args));
});
for (const [name, mutate] of Object.entries({ missing: d => delete d.answers.route, extra: d => d.answers.extra = {}, probability: d => d.answers.escalate.noul = 1.1, score: d => d.answers.urgency.score = -1, keys: d => d.answers.urgency.probabilities['03'] = .1, choice: d => d.answers.route.choice = 'other', confidence: d => d.answers.route.confidence = -1, usage: d => d.usage.input_tokens = 1.5, wrongType: d => d.answers.escalate.type = 'boolean' })) test(`reject ${name}`, async () => { const d = valid(); mutate(d); assert.equal((await createProvider({}, mock(d)).evaluate(batch, ctx())).reason, 'invalid-response'); });
for (const [status, reason] of [[401,'authentication'],[403,'authentication'],[429,'rate-limited'],[400,'unsupported-input'],[404,'unsupported-input'],[413,'unsupported-input'],[422,'unsupported-input'],[500,'transport'],[503,'transport']]) test(`HTTP ${status}`, async () => assert.equal((await createProvider({}, async () => new Response('private body', { status })).evaluate(batch, ctx())).reason, reason));
test('bounded response and malformed JSON', async () => { for (const response of [new Response('x'.repeat(1048577)), new Response('{'), new Response('{}', { headers: { 'content-length': '1048577' } })]) assert.equal((await createProvider({}, async () => response).evaluate(batch, ctx())).reason, 'invalid-response'); });
test('invalid input and unsupported models avoid dispatch', async () => { let calls = 0; const p = createProvider({}, () => { calls++; throw Error('must not call'); }); assert.equal((await p.evaluate({ ...batch, state: null }, ctx())).reason, 'unsupported-input'); assert.equal((await p.evaluate(batch, { ...ctx(), model: 'tev1:14b' })).reason, 'unsupported-input'); assert.equal(calls, 0); });
test('only loopback origins without credentials', () => { for (const baseURL of ['https://example.com','http://example.com','http://user:secret@localhost:11434','http://localhost:11434/path']) assert.throws(() => createProvider({baseURL})); });
test('transport error is generic', async () => assert.equal((await createProvider({}, async () => { throw Error('secret'); }).evaluate(batch, ctx())).reason, 'transport'));
test('caller cancellation propagates', async () => { const c = new AbortController(); const p = createProvider({}, async (_, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))); const promise = p.evaluate(batch, {...ctx(),signal:c.signal}); c.abort(new DOMException('Cancelled','AbortError')); await assert.rejects(promise, {name:'AbortError'}); });
test('deadline aborts pending request', async () => { const p = createProvider({}, async (_, {signal}) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))); await assert.rejects(p.evaluate(batch,{...ctx(),deadlineMonotonicMs:performance.now()+10}), {name:'TimeoutError'}); });
test('expired and pre-aborted calls never dispatch', async () => { const p = createProvider({}, () => { throw Error('must not call'); }); await assert.rejects(p.evaluate(batch,{...ctx(),deadlineMonotonicMs:performance.now()-1}),{name:'TimeoutError'}); const c = new AbortController(); c.abort(); await assert.rejects(p.evaluate(batch,{...ctx(),signal:c.signal}),{name:'AbortError'}); });
test('score map requires exact canonical index keys', async () => { for (const probs of [{'0':.1,'1':.9}, {'0':.1,'1':.1,'02':.8}, {'0':.1,'1':.1,'2':null}, {'0':.1,'1':.1,'2':-1}]) { const d = valid(); d.answers.urgency.probabilities = probs; assert.equal((await createProvider({},mock(d)).evaluate(batch,ctx())).reason,'invalid-response'); } });
test('rounded distributions and fractional scores preserved', async () => { const d = valid(); d.answers.urgency.probabilities = {'0':.333,'1':.333,'2':.333}; const out = await createProvider({},mock(d)).evaluate(batch,ctx()); assert.equal(out.result.answers.urgency.score,1.8); assert.deepEqual(out.result.answers.urgency.probabilities,[.333,.333,.333]); });
test('structured criteria compiled as JSON text; null score rejected', async () => { const input = structuredClone(batch); input.questions.escalate.criteria.true = { includes:['outage'] }; const p = createProvider({},async (_,init) => { assert.equal(JSON.parse(init.body).questions.escalate.criteria.true,'{"includes":["outage"]}'); return Response.json(valid()); }); assert.equal((await p.evaluate(input,ctx())).status,'ok'); input.questions.urgency.criteria[0] = null; assert.equal((await p.evaluate(input,ctx())).reason,'unsupported-input'); });
test('prototype-like labels remain own data keys', async () => { const input = {state:'example',questions:JSON.parse('{"__proto__":{"type":"choice","criteria":{"__proto__":"first","constructor":"second"}}}')}; const data = JSON.parse('{"model":"tev1:0.8b","answers":{"__proto__":{"type":"choice","choice":"__proto__","probabilities":{"__proto__":0.8,"constructor":0.2}}}}'); const out = await createProvider({},mock(data)).evaluate(input,ctx()); assert.equal(out.status,'ok'); assert.equal(out.result.answers.__proto__.probabilities.__proto__,.8); });

test('host admission is checked immediately before dispatch', async () => {
 const events = [];
 const p = createProvider({}, async () => { events.push('fetch'); return Response.json(valid()); });
 const out = await p.evaluate(batch, { ...ctx(), isAdmissible() { events.push('admit'); return true; } });
 assert.equal(out.status, 'ok');
 assert.deepEqual(events, ['admit', 'fetch']);
});
test('revoked host admission prevents network dispatch', async () => {
 let calls = 0;
 const p = createProvider({}, async () => { calls++; return Response.json(valid()); });
 const out = await p.evaluate(batch, { ...ctx(), isAdmissible: () => false });
 assert.equal(out.status, 'unavailable');
 assert.equal(calls, 0);
});
test('host authority assertions propagate unchanged and never dispatch', async () => {
 let calls = 0;
 const failure = new Error('Consumer authority closed');
 const p = createProvider({}, async () => { calls++; return Response.json(valid()); });
 await assert.rejects(p.evaluate(batch, { ...ctx(), isAdmissible() { throw failure; } }), error => error === failure);
 assert.equal(calls, 0);
});
