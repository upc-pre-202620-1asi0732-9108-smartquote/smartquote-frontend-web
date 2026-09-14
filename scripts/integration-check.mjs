import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SmartQuoteApi, parseSession } from '../lib/smartquote/api.ts';
import { defaultCriteria } from '../lib/smartquote/domain.ts';
import { mintToken } from './dev-token.mjs';

const base = process.env.SMARTQUOTE_API_URL ?? 'http://127.0.0.1:5088';
const url = new URL(base);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('This fixture-writing check only runs against a local API.');
const key = process.env.SMARTQUOTE_KEY_FILE
  ? readFileSync(process.env.SMARTQUOTE_KEY_FILE, 'utf8').trim()
  : process.env.SMARTQUOTE_JWT_KEY;
const userId = randomUUID();
const clients = Object.fromEntries(
  ['ProductionSpecialist', 'PurchaseAnalyst', 'PurchaseManager'].map((role) => [
    role,
    new SmartQuoteApi(
      parseSession(
        base,
        mintToken(role, key, {
          userId,
          issuer: process.env.SMARTQUOTE_JWT_ISSUER,
          audience: process.env.SMARTQUOTE_JWT_AUDIENCE,
        }),
      ),
    ),
  ]),
);
const production = clients.ProductionSpecialist,
  analyst = clients.PurchaseAnalyst,
  manager = clients.PurchaseManager;
const checks = [];
function passed(label) {
  checks.push(label);
  console.log(`PASS ${label}`);
}
function pdf(text) {
  const safe = text.replace(/[()\\]/g, ' ');
  const stream = `BT /F1 14 Tf 50 750 Td (${safe}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let result = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((value, index) => {
    offsets.push(Buffer.byteLength(result));
    result += `${index + 1} 0 obj\n${value}\nendobj\n`;
  });
  const start = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(result);
}
function fixture(name) {
  for (let n = 0; ; n++) {
    const buffer = pdf(`SmartQuote integration fixture ${name} ${userId} ${n}`);
    if (
      createHash('sha256')
        .update(buffer)
        .digest('hex')
        .slice(0, 8)
        .includes('a')
    )
      return new File([buffer], `${name}.pdf`, { type: 'application/pdf' });
  }
}

await manager.listRequests();
passed('JWT access and paginated requests');
const payload = {
  requiredDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  priority: 'High',
  items: [
    {
      description: 'Insumo avicola - prueba de integracion',
      quantity: 1,
      unitOfMeasure: 'unit',
      requirements: [
        {
          name: 'documentReference',
          operator: 'Contains',
          expectedValue: 'a',
          unitOfMeasure: '',
          isMandatory: true,
        },
      ],
    },
  ],
};
await assert.rejects(manager.createRequest(payload), (e) => e.status === 403);
passed('purchasing role cannot register production requests');
let request = await production.createRequest(payload);
assert.equal(request.status, 'Submitted');
passed('request persisted by production');
const fileA = fixture('supplier-a');
await production.attach(request, fileA);
request = await manager.request(request.requestId);
assert.equal(request.attachments.length, 1);
passed('attachment persisted');
for (const next of ['UnderReview', 'QuotationCollection']) {
  await analyst.changeStatus(request, next, 'Integration workflow');
  request = await manager.request(request.requestId);
}
passed('versioned status transitions');
await assert.rejects(
  analyst.changeStatus(
    { ...request, version: 1 },
    'Evaluation',
    'Stale change',
  ),
  (e) => e.status === 409,
);
passed('stale request version rejected');
let qA = await analyst.upload(
  request.requestId,
  {
    supplierId: 'fixture-a',
    supplierBusinessName: 'Proveedor A - prueba',
    supplierTaxIdentifier: 'TEST-A',
  },
  fileA,
);
const duplicate = await analyst.upload(
  request.requestId,
  {
    supplierId: 'fixture-a',
    supplierBusinessName: 'Proveedor A - prueba',
    supplierTaxIdentifier: 'TEST-A',
  },
  fileA,
);
assert.equal(duplicate.quotationId, qA.quotationId);
passed('PDF upload and duplicate idempotency');
let qB = await analyst.upload(
  request.requestId,
  {
    supplierId: 'fixture-b',
    supplierBusinessName: 'Proveedor B - prueba',
    supplierTaxIdentifier: 'TEST-B',
  },
  fixture('supplier-b'),
);
qA = await analyst.process(qA.quotationId);
qB = await analyst.process(qB.quotationId);
assert.equal(qA.status, 'RequiresVerification');
passed('backend extraction adapter and evidence returned');
const price = qB.fields.find((f) => f.fieldPath === 'lines[0].unitPrice');
await analyst.correct(qB, price.fieldId, '120', 'Integration price correction');
await assert.rejects(
  analyst.correct(qB, price.fieldId, '121', 'Stale correction'),
  (e) => e.status === 409,
);
qB = await analyst.quote(qB.quotationId);
passed('field corrections and stale quotation version');
const delivery = qB.fields.find((f) => f.fieldPath === 'deliveryLeadTimeDays');
await analyst.correct(
  qB,
  delivery.fieldId,
  '1',
  'Integration delivery correction',
);
qB = await analyst.quote(qB.quotationId);
for (const quote of [qA, qB])
  await analyst.confirm(
    quote,
    Object.fromEntries(
      quote.lines.map((l) => [l.lineId, request.items[0].itemId]),
    ),
  );
assert(
  (await analyst.quotes(request.requestId)).every(
    (q) => q.status === 'Verified',
  ),
);
passed('line mappings and verified quotations');
const criteria = defaultCriteria(request);
let scenario = await analyst.saveScenario(request.requestId, criteria);
await analyst.changeStatus(request, 'Evaluation', 'Ready for comparison');
request = await manager.request(request.requestId);
let simulation = await analyst.simulate(scenario.scenarioId);
assert.equal(simulation.isCurrent, true);
assert.equal(simulation.recommendation.quotationId, qA.quotationId);
assert.equal(
  simulation.evaluations.find((e) => e.quotationId === qA.quotationId)
    .totalScore,
  0.6,
);
passed('backend ranking: 60% price recommends A');
const revised = criteria.map((c) =>
  c.mode === 'Weighted'
    ? { ...c, weight: c.category === 'Price' ? 30 : 70 }
    : c,
);
scenario = await analyst.saveScenario(request.requestId, revised, scenario);
assert.equal(
  (
    await manager.currentSimulation(
      request.requestId,
      simulation.simulationRunId,
    )
  ).isCurrent,
  false,
);
passed('scenario versions invalidate old results');
simulation = await analyst.simulate(scenario.scenarioId);
assert.equal(simulation.recommendation.quotationId, qB.quotationId);
passed('backend ranking: 70% delivery recommends B');
await assert.rejects(
  analyst.approve(
    simulation.simulationRunId,
    qB.quotationId,
    'Receiving hours 8-16',
    'Test warehouse',
  ),
  (e) => e.status === 403,
);
passed('analyst cannot approve purchase order');
const order = await manager.approve(
  simulation.simulationRunId,
  qB.quotationId,
  'Receiving hours 8-16',
  'Test warehouse',
);
assert.equal(order.total, 120);
const retry = await manager.approve(
  simulation.simulationRunId,
  qB.quotationId,
  'Receiving hours 8-16',
  'Test warehouse',
);
assert.equal(retry.purchaseOrderId, order.purchaseOrderId);
assert.equal(
  (await manager.orderByRun(simulation.simulationRunId)).purchaseOrderId,
  order.purchaseOrderId,
);
passed('real purchase order, lookup, and idempotent approval');
for (const next of ['Approved', 'Ordered']) {
  await manager.changeStatus(request, next, `Order ${order.orderNumber}`);
  request = await manager.request(request.requestId);
}
assert.equal(request.status, 'Ordered');
passed('request completes as Ordered');
const notifications = await production.notifications();
assert(notifications.some((n) => n.purchaseRequestId === request.requestId));
await production.readNotification(notifications[0].notificationId);
assert(
  (await production.notifications()).find(
    (n) => n.notificationId === notifications[0].notificationId,
  ).readAt,
);
passed('production notifications and read acknowledgement');
const history = await manager.history(request.requestId);
assert(history.entries.some((e) => e.toStatus === 'Ordered'));
passed('persistent audit trail');
mkdirSync('.local', { recursive: true });
const report = {
  timestamp: new Date().toISOString(),
  backendCommit: 'e0b4d9287108cc9699f1b1ff325351c6f259429f',
  api: base,
  extractionProvider:
    'Stub (repository development adapter; no real AI extraction asserted)',
  checks,
  requestId: request.requestId,
  simulationRunId: simulation.simulationRunId,
  purchaseOrderId: order.purchaseOrderId,
  orderNumber: order.orderNumber,
};
writeFileSync(
  '.local/integration-result.json',
  JSON.stringify(report, null, 2),
);
writeFileSync('.local/manager-token.txt', manager.session.token, {
  mode: 0o600,
});
writeFileSync('.local/production-token.txt', production.session.token, {
  mode: 0o600,
});
console.log(
  `Integration complete: ${checks.length} checks; order ${order.orderNumber}. Results and local session tokens are in ignored .local/.`,
);
