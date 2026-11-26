import assert from 'node:assert/strict';
import test from 'node:test';
import { predict } from './prediction-api.js';

test('prediction boundary preserves multipart field, details query and normalization', async (t) => {
  const file = new Blob(['image fixture'], { type: 'image/png' });
  let request;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ predictions: [
      { label: 'healthy', score: '0.2' }, { label: 'dermatitis', score: 0.8 },
      { label: '', score: 1 }, { label: 'invalid', score: 'oops' },
    ], runs: ['unchanged'], selected_model: 'efficientnet_b3', image_sha256: 'fixture' }) };
  });
  const result = await predict(file, true);
  assert.equal(request.url, 'http://127.0.0.1:8000/predict?details=true');
  assert.equal(request.options.method, 'POST');
  assert.deepEqual([...request.options.body.keys()], ['image']);
  assert.equal(await request.options.body.get('image').text(), await file.text());
  assert.equal(request.options.headers, undefined); // Browser supplies multipart boundary.
  assert.deepEqual(result.predictions, [{ label: 'Dermatitis', score: 0.8 }, { label: 'Healthy', score: 0.2 }]);
  assert.deepEqual(result.runs, ['unchanged']);
  assert.equal(result.selected_model, 'efficientnet_b3');
  assert.equal(result.image_sha256, 'fixture');
});

test('guest prediction keeps the plain array endpoint', async (t) => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'http://127.0.0.1:8000/predict');
    return { ok: true, json: async () => [{ label: 'healthy', score: 1 }] };
  });
  assert.deepEqual((await predict(new Blob(), false)).predictions, [{ label: 'Healthy', score: 1 }]);
});

test('prediction preserves network, backend and malformed payload errors', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await assert.rejects(predict(new Blob(), false), /เชื่อมต่อ AI ไม่ได้/);
  mock.mock.mockImplementation(async () => ({ ok: false, json: async () => ({ detail: 'guardrail rejection' }) }));
  await assert.rejects(predict(new Blob(), false), /guardrail rejection/);
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ predictions: null }) }));
  await assert.rejects(predict(new Blob(), true), /รูปแบบผลลัพธ์จาก AI ไม่ถูกต้อง/);
});
