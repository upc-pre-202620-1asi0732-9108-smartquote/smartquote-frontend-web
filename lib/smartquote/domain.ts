import type { Criterion, PurchaseRequest, Quotation } from './types.ts';
export const statuses: Record<string, string> = {
  Draft: 'Borrador',
  Submitted: 'Enviada',
  UnderReview: 'En revisión',
  QuotationCollection: 'Recopilando cotizaciones',
  Evaluation: 'En evaluación',
  Approved: 'Aprobada',
  Ordered: 'Orden emitida',
  Rejected: 'Rechazada',
  Cancelled: 'Cancelada',
  Uploaded: 'Cargada',
  Processing: 'Procesando',
  RequiresVerification: 'Por verificar',
  Verified: 'Verificada',
  Issued: 'Emitida',
  Active: 'Activo',
  Superseded: 'Reemplazado',
};
export const priorities: Record<string, string> = {
  Normal: 'Normal',
  High: 'Alta',
  Emergency: 'Urgente',
};
export const operators: Record<string, string> = {
  Equals: 'Igual a',
  Contains: 'Contiene',
  GreaterThanOrEqual: 'Mayor o igual a',
  LessThanOrEqual: 'Menor o igual a',
};
export const roles: Record<string, string> = {
  ProductionSpecialist: 'Producción y sanidad',
  PurchaseAnalyst: 'Analista de compras',
  PurchaseManager: 'Jefe de compras',
};
export const transitions: Record<string, string[]> = {
  Submitted: ['UnderReview', 'Cancelled'],
  UnderReview: ['QuotationCollection', 'Rejected', 'Cancelled'],
  QuotationCollection: ['Evaluation', 'Rejected', 'Cancelled'],
  Evaluation: ['QuotationCollection', 'Approved', 'Rejected', 'Cancelled'],
  Approved: ['Evaluation', 'Ordered', 'Cancelled'],
};
export const flow = [
  'Submitted',
  'UnderReview',
  'QuotationCollection',
  'Evaluation',
  'Approved',
  'Ordered',
];
export const money = (value: number | null | undefined, currency = 'PEN') => {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
};
export const date = (value: string | null | undefined, time = false) =>
  value
    ? new Date(
        value.length === 10 ? value + 'T12:00:00' : value,
      ).toLocaleString(
        'es-PE',
        time
          ? { dateStyle: 'medium', timeStyle: 'short' }
          : { dateStyle: 'medium' },
      )
    : '—';
export const score = (value: number) =>
  (value * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 });
export const title = (r: PurchaseRequest) =>
  r.items[0]?.description ?? 'Solicitud de insumos';
export const total = (q: Quotation) =>
  q.lines.some((l) => l.quantity === null || l.unitPrice === null)
    ? null
    : q.lines.reduce((n, l) => n + l.quantity! * l.unitPrice!, 0);
export function defaultCriteria(request: PurchaseRequest): Criterion[] {
  const technical = request.items.flatMap((item) =>
    item.requirements
      .filter((r) => r.isMandatory)
      .map((r) => ({
        name: `${item.description}: ${r.name}`,
        targetField: r.requirementId,
        category: 'TechnicalCompliance',
        mode: 'Mandatory',
        operator: r.operator,
        expectedValue: r.expectedValue,
        unitOfMeasure: r.unitOfMeasure,
        weight: 0,
        displayOrder: 0,
      })),
  );
  return [
    ...technical,
    {
      name: 'Precio total',
      targetField: 'totalPrice',
      category: 'Price',
      mode: 'Weighted',
      operator: 'LessThanOrEqual',
      expectedValue: '999999999',
      unitOfMeasure: '',
      weight: 60,
      displayOrder: 0,
    },
    {
      name: 'Plazo de entrega',
      targetField: 'deliveryLeadTimeDays',
      category: 'DeliveryTime',
      mode: 'Weighted',
      operator: 'LessThanOrEqual',
      expectedValue: '365',
      unitOfMeasure: 'days',
      weight: 40,
      displayOrder: 0,
    },
  ].map((c, index) => ({ ...c, displayOrder: index + 1 }));
}
export function fieldLabel(path: string) {
  const names: Record<string, string> = {
    validUntil: 'Válida hasta',
    currency: 'Moneda',
    deliveryLeadTimeDays: 'Entrega (días)',
    'supplier.businessName': 'Razón social extraída',
    description: 'Descripción',
    quantity: 'Cantidad',
    unitOfMeasure: 'Unidad',
    unitPrice: 'Precio unitario',
  };
  const line = path.match(/^lines\[(\d+)\]\.(.+)$/);
  return line
    ? `Ítem ${Number(line[1]) + 1} · ${names[line[2]] ?? line[2]}`
    : (names[path] ?? path);
}
