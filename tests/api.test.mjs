import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  normalizeBaseUrl,
  parseSession,
  SmartQuoteApi,
} from '../lib/smartquote/api.ts';
import { defaultCriteria, score } from '../lib/smartquote/domain.ts';
import { mintToken } from '../scripts/dev-token.mjs';
test('API address rejects credentials, unsafe remote HTTP, and normalizes API suffix', () => {
  assert.equal(
    normalizeBaseUrl('http://localhost:8080/api/v1/'),
    'http://localhost:8080',
  );
  assert.throws(() => normalizeBaseUrl('http://example.com'));
  assert.throws(() => normalizeBaseUrl('https://user:password@example.com'));
  assert.throws(() => normalizeBaseUrl('https://example.com?token=x'));
});
test('JWT claims only personalize UI and expired tokens are rejected', () => {
  const key = 'k'.repeat(32);
  const valid = mintToken('PurchaseManager', key);
  assert.deepEqual(parseSession('http://localhost:8080', valid).roles, [
    'PurchaseManager',
  ]);
  assert.throws(() =>
    parseSession(
      'http://localhost:8080',
      mintToken('PurchaseManager', key, { hours: -1 }),
    ),
  );
});
test('all mandatory technical requirements survive the default comparison definition', () => {
  const criteria = defaultCriteria({
    items: [
      {
        description: 'Feed',
        requirements: [
          {
            requirementId: 'a',
            name: 'Protein',
            operator: 'GreaterThanOrEqual',
            expectedValue: '21',
            unitOfMeasure: '%',
            isMandatory: true,
          },
          {
            requirementId: 'b',
            name: 'Packaging',
            operator: 'Equals',
            expectedValue: 'Bag',
            unitOfMeasure: '',
            isMandatory: false,
          },
        ],
      },
    ],
  });
  assert.equal(criteria.filter((c) => c.mode === 'Mandatory').length, 1);
  assert.equal(criteria[0].targetField, 'a');
  assert.equal(
    criteria
      .filter((c) => c.mode === 'Weighted')
      .reduce((s, c) => s + c.weight, 0),
    100,
  );
  assert.equal(score(0.6), '60');
});
test('client sends exact concurrency contract and handles an empty 204', async () => {
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, init };
    return new Response(null, { status: 204 });
  };
  try {
    const api = new SmartQuoteApi({
      baseUrl: 'http://localhost:8080',
      token: 'test',
    });
    await api.changeStatus(
      { requestId: 'r', version: 3 },
      'Evaluation',
      'Reviewed',
    );
    assert.deepEqual(JSON.parse(sent.init.body), {
      nextStatus: 'Evaluation',
      reason: 'Reviewed',
      expectedVersion: 3,
    });
    assert.equal(sent.init.headers.get('Authorization'), 'Bearer test');
    assert.equal(sent.init.redirect, 'error');
  } finally {
    globalThis.fetch = original;
  }
});
test('403 and 409 remain explicit errors; mutations are never retried', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let status = 409;
  globalThis.fetch = async () => {
    calls++;
    return new Response('{}', { status });
  };
  try {
    const api = new SmartQuoteApi({
      baseUrl: 'http://localhost:8080',
      token: 'test',
    });
    await assert.rejects(
      api.call('/x', { method: 'POST' }),
      (e) => e instanceof ApiError && e.status === 409,
    );
    assert.equal(calls, 1);
    status = 403;
    await assert.rejects(
      api.call('/x', { method: 'POST' }),
      (e) => e instanceof ApiError && e.status === 403,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('approval guard rejects superseded criteria and simulations from another request', async () => {
  const api = new SmartQuoteApi({
    baseUrl: 'http://localhost:8080',
    token: 'test',
  });
  api.simulation = async () => ({ scenarioId: 'old', isCurrent: true });
  api.scenario = async () => ({ scenarioId: 'new', status: 'Active' });
  api.scenarioById = async () => ({ requestId: 'request-a' });
  assert.equal(
    (await api.currentSimulation('request-a', 'run')).isCurrent,
    false,
  );
  api.scenario = async () => ({ scenarioId: 'old', status: 'Active' });
  assert.equal(
    (await api.currentSimulation('request-a', 'run')).isCurrent,
    true,
  );
  await assert.rejects(
    api.currentSimulation('request-b', 'run'),
    (error) => error instanceof ApiError && error.status === 400,
  );
});
