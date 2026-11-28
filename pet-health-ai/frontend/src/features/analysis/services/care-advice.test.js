import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdviceSession } from './advice-session.js';
import { loadCareAdvice } from './care-advice.js';

const items = ['สังเกตผิว', 'ดูแลอย่างอ่อนโยน', 'เลี่ยงการขัดถู'];
const generated = { items, source: 'gemini', context_tips: { items: ['จดช่วงเวลาที่คัน'], source: 'gemini' } };
const memorySession = () => createAdviceSession(() => { throw new Error('Storage unavailable'); });

for (const ownerContext of [null, { symptoms: ['itching'], body_sites: ['abdomen'] }]) {
  test(`three identical checks rotate styles and send recent text (${ownerContext ? 'context' : 'general'})`, async () => {
    const session = memorySession();
    const payloads = [];
    const fetcher = async (url, options) => {
      assert.ok(url.endsWith('/care-advice'));
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      payloads.push(body);
      return { ok: true, json: async () => generated };
    };
    for (let i = 0; i < 3; i++) {
      const result = await loadCareAdvice('Dermatitis', undefined, { score: 0.8, ownerContext, adviceScope: 'alice', session, fetcher });
      assert.equal(result.source, 'gemini');
      if (ownerContext) assert.equal(result.context_tips.source, 'gemini');
    }
    assert.deepEqual(payloads.map(p => p.variation_index), [0, 1, 2]);
    assert.equal(payloads[0].previous_advice, null);
    assert.deepEqual(payloads[1].previous_advice.items, items);
    assert.deepEqual(payloads[2].owner_context, ownerContext);
    assert.ok(payloads.every(p => p.score === 0.8));
    const bob = session.begin('bob', 'dermatitis');
    assert.equal(bob.previous_advice, null);
    assert.equal(bob.variation_index, 0);
  });
}

test('fallback does not replace recent Gemini text or trigger a second request', async () => {
  const session = memorySession();
  const ticket = session.begin('alice', 'dermatitis');
  session.remember(ticket, generated);
  let calls = 0;
  const result = await loadCareAdvice('Dermatitis', undefined, {
    session, adviceScope: 'alice', ownerContext: { symptoms: ['itching'] },
    fetcher: async () => { calls++; throw new Error('offline'); },
  });
  assert.equal(calls, 1);
  assert.equal(result.source, 'fallback');
  assert.equal(result.context_tips.source, 'fallback');
  assert.deepEqual(session.begin('alice', 'dermatitis').previous_advice.items, items);
});

test('tab reload preserves recent answer; account and late responses stay isolated', () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  const session = createAdviceSession(() => storage);
  const old = session.begin('alice', 'healthy');
  const latest = session.begin('alice', 'healthy');
  session.remember(latest, generated);
  session.remember(old, { items: ['old', 'old', 'old'], source: 'gemini' });
  const reloaded = createAdviceSession(() => storage);
  assert.deepEqual(reloaded.begin('alice', 'healthy').previous_advice.items, items);
  assert.equal(reloaded.begin('bob', 'healthy').previous_advice, null);
  assert.equal(reloaded.begin('guest', 'healthy').previous_advice, null);
});

test('partial fallback preserves the latest successful main advice', () => {
  const session = memorySession();
  session.remember(session.begin('alice', 'healthy'), generated);
  session.remember(session.begin('alice', 'healthy'), {
    items: ['fallback', 'fallback', 'fallback'], source: 'fallback',
    context_tips: { items: ['จดเวลาเพิ่มเติม'], source: 'gemini' },
  });
  const recent = session.begin('alice', 'healthy').previous_advice;
  assert.deepEqual(recent.items, items);
  assert.deepEqual(recent.tips, ['จดเวลาเพิ่มเติม']);
});
