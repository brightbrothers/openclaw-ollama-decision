const MAX_BYTES = 1024 * 1024;
const unavailable = reason => ({ status: 'unavailable', reason });
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (x, k) => Object.hasOwn(x, k);
const range = (x, max = 1) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
const keysEqual = (x, keys) => object(x) && Object.keys(x).length === keys.length && keys.every(k => own(x, k));
function check(ok) { if (!ok) throw new Error('Invalid decision data'); }
function entry(x, nullable = true) {
  check((nullable && x === null) || typeof x === 'string' || object(x) || Array.isArray(x));
  return typeof x === 'string' || x === null ? x : JSON.stringify(x);
}
function compile(batch, model) {
  check(object(batch) && object(batch.questions));
  const ids = Object.keys(batch.questions);
  check(ids.length >= 1 && ids.length <= 64);
  const state = entry(batch.state, false);
  check(typeof state === 'string' && state.trim().length > 0);
  const questions = Object.create(null);
  for (const id of ids) {
    check(id.trim().length > 0);
    const q = batch.questions[id];
    check(object(q));
    const instructions = q.instructions === undefined || q.instructions === null ? 'Evaluate the supplied state against these criteria.' : entry(q.instructions, false);
    check(instructions.trim().length > 0);
    let criteria;
    if (q.type === 'boolean') {
      check(q.criteria == null || (object(q.criteria) && Object.keys(q.criteria).every(k => k === 'true' || k === 'false')));
      criteria = Object.create(null);
      for (const k of Object.keys(q.criteria ?? {})) criteria[k] = entry(q.criteria[k], false);
    } else if (q.type === 'choice') {
      check(object(q.criteria));
      const labels = Object.keys(q.criteria);
      check(labels.length >= 2 && labels.length <= 26 && labels.every(k => k.trim().length > 0));
      criteria = Object.fromEntries(labels.map(k => [k, entry(q.criteria[k])]));
    } else if (q.type === 'score') {
      check(Array.isArray(q.criteria) && q.criteria.length >= 2 && q.criteria.length <= 26);
      criteria = q.criteria.map(x => entry(x, false));
    } else check(false);
    questions[id] = { type: q.type === 'boolean' ? 'noul' : q.type, instructions, criteria };
  }
  const body = JSON.stringify({ model, state: batch.state, questions });
  check(Buffer.byteLength(body) <= MAX_BYTES);
  return body;
}
function decode(data, batch) {
  check(object(data) && typeof data.model === 'string' && data.model.trim().length > 0 && data.model.length <= 256);
  const ids = Object.keys(batch.questions);
  check(keysEqual(data.answers, ids));
  const answers = Object.create(null);
  for (const id of ids) {
    const q = batch.questions[id], a = data.answers[id];
    check(object(a) && a.type === (q.type === 'boolean' ? 'noul' : q.type));
    if (q.type === 'boolean') {
      check(range(a.noul));
      answers[id] = { type: 'boolean', probabilityTrue: a.noul };
      continue;
    }
    const labels = q.type === 'choice' ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    check(keysEqual(a.probabilities, labels) && labels.every(k => range(a.probabilities[k])));
    // Preserve rounded vendor distributions; do not normalize or recompute the score.
    const answer = q.type === 'choice'
      ? { type: 'choice', choice: a.choice, probabilities: Object.fromEntries(labels.map(k => [k, a.probabilities[k]])) }
      : { type: 'score', score: a.score, probabilities: labels.map(k => a.probabilities[k]) };
    check(q.type === 'choice' ? typeof a.choice === 'string' && labels.includes(a.choice) : range(a.score, labels.length - 1));
    if (own(a, 'confidence')) { check(range(a.confidence)); answer.confidence = a.confidence; }
    answers[id] = answer;
  }
  const result = { model: data.model, answers };
  if (own(data, 'usage')) {
    check(object(data.usage));
    result.usage = {};
    for (const [wire, host] of [['input_tokens', 'inputTokens'], ['output_tokens', 'outputTokens']]) {
      if (own(data.usage, wire)) { check(Number.isSafeInteger(data.usage[wire]) && data.usage[wire] >= 0); result.usage[host] = data.usage[wire]; }
    }
  }
  return { status: 'ok', result };
}
async function readBounded(response, signal) {
  const declared = response.headers.get('content-length');
  check(declared === null || (/^\d+$/.test(declared) && Number(declared) <= MAX_BYTES));
  check(response.body);
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      check(size <= MAX_BYTES);
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createProvider(config = {}, fetchImpl = globalThis.fetch) {
  check(object(config) && Object.keys(config).every(k => k === 'baseURL'));
  const url = new URL(config.baseURL ?? 'http://127.0.0.1:11434');
  check(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash);
  return {
    id: 'ollama-decision', contractVersion: 1,
    isReady: () => true,
    async evaluate(batch, context) {
      context.signal.throwIfAborted();
      check(Number.isFinite(context.deadlineMonotonicMs));
      const remaining = context.deadlineMonotonicMs - performance.now();
      if (remaining <= 0) throw new DOMException('Decision deadline exceeded', 'TimeoutError');
      if (!['tev1:0.8b', 'tev1:4b'].includes(context.model)) return unavailable('unsupported-input');
      let body;
      try { body = compile(batch, context.model); } catch { return unavailable('unsupported-input'); }
      const controller = new AbortController();
      const abort = () => controller.abort(context.signal.reason);
      context.signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new DOMException('Decision deadline exceeded', 'TimeoutError')), Math.min(remaining, 2147483647));
      try {
        // Keep host authority assertions outside transport error handling.
        // No awaited preparation may occur between admission and dispatch.
        controller.signal.throwIfAborted();
        if (context.isAdmissible && !context.isAdmissible()) return unavailable('transport');
        try {
          const response = await fetchImpl(new URL('/v1/systemone', url), { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: controller.signal, redirect: 'error' });
          controller.signal.throwIfAborted();
          if (!response.ok) {
            await response.body?.cancel().catch(() => {});
            return unavailable(response.status === 401 || response.status === 403 ? 'authentication' : response.status === 429 ? 'rate-limited' : [400, 404, 413, 422].includes(response.status) ? 'unsupported-input' : 'transport');
          }
          let result;
          try { result = decode(await readBounded(response, controller.signal), batch); }
          catch { controller.signal.throwIfAborted(); return unavailable('invalid-response'); }
          controller.signal.throwIfAborted();
          if (performance.now() >= context.deadlineMonotonicMs) { controller.abort(new DOMException('Decision deadline exceeded', 'TimeoutError')); controller.signal.throwIfAborted(); }
          return result;
        } catch {
          controller.signal.throwIfAborted();
          return unavailable('transport');
        }
      } finally { clearTimeout(timer); context.signal.removeEventListener('abort', abort); }
    },
  };
}
