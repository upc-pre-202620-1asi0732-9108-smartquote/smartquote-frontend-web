'use client';
import { useState } from 'react';
import { Check, ClipboardCheck, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import type { SmartQuoteApi } from '@/lib/smartquote/api';
import type {
  PurchaseOrder,
  PurchaseRequest,
  Quotation,
  Simulation,
} from '@/lib/smartquote/types';
import { date, money, score, total } from '@/lib/smartquote/domain';
import { Choice, Empty, Field, Status } from './common';
import type { Action } from './request-detail';
export function OrderPanel({
  api,
  request,
  quotes,
  simulation,
  order,
  manager,
  busy,
  action,
  onOrder,
  refresh,
}: {
  api: SmartQuoteApi;
  request: PurchaseRequest;
  quotes: Quotation[];
  simulation: Simulation | null;
  order: PurchaseOrder | null;
  manager: boolean;
  busy: boolean;
  action: Action;
  onOrder: (order: PurchaseOrder) => void;
  refresh: () => Promise<void>;
}) {
  const [chosen, setChosen] = useState('');
  const [destination, setDestination] = useState('');
  const [conditions, setConditions] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const quoteId = chosen || simulation?.recommendation?.quotationId || '';
  const quote = quotes.find((q) => q.quotationId === quoteId);
  if (!manager)
    return (
      <Empty title="Revisión del jefe de compras">
        La aprobación, generación y consulta de órdenes está restringida al jefe
        de compras por los permisos actuales de la API.
      </Empty>
    );
  if (order)
    return (
      <>
        <div className="section-heading no-print">
          <div>
            <h2>Orden de compra</h2>
            <p className="muted">
              La decisión y los datos aprobados quedaron registrados.
            </p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Imprimir
          </Button>
        </div>
        <article className="panel order-document">
          <header>
            <div>
              <span className="eyebrow">SMARTQUOTE · ORDEN DE COMPRA</span>
              <h2>{order.orderNumber}</h2>
            </div>
            <Status value={order.status} />
          </header>
          <div className="form-grid">
            <div>
              <span className="muted">Proveedor</span>
              <h3>{order.supplierBusinessName}</h3>
              <p>Identificación fiscal: {order.supplierTaxIdentifier}</p>
            </div>
            <div>
              <span className="muted">Entrega</span>
              <h3>{order.deliveryDestination}</h3>
              <p>
                {order.deliveryConditions} · {order.deliveryLeadTimeDays} días
              </p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Precio unitario</TableHead>
                <TableHead>Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((l) => (
                <TableRow key={l.lineId}>
                  <TableCell>{l.description}</TableCell>
                  <TableCell>
                    {l.quantity} {l.unitOfMeasure}
                  </TableCell>
                  <TableCell>{money(l.unitPrice, order.currency)}</TableCell>
                  <TableCell>
                    {money(l.quantity * l.unitPrice, order.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="order-total">
            <span>Total de la orden</span>
            <strong>{money(order.total, order.currency)}</strong>
          </div>
          <footer>
            <span>
              <ShieldCheck />
              Aprobada: {date(order.approvedAt, true)}
            </span>
            <small className="id-value">Responsable: {order.approvedBy}</small>
            <small className="id-value">
              Simulación: {order.simulationRunId}
            </small>
          </footer>
        </article>
        {['Evaluation', 'Approved'].includes(request.status) && (
          <div className="actions no-print">
            <p className="muted">
              La orden existe. Registra ahora el avance final de la solicitud.
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  let current = await api.request(request.requestId);
                  if (current.status === 'Evaluation') {
                    await api.changeStatus(
                      current,
                      'Approved',
                      `Orden ${order.orderNumber} aprobada.`,
                    );
                    current = await api.request(current.requestId);
                  }
                  if (current.status === 'Approved')
                    await api.changeStatus(
                      current,
                      'Ordered',
                      `Orden ${order.orderNumber} emitida.`,
                    );
                  await refresh();
                }, 'Solicitud actualizada a orden emitida.')
              }
            >
              <Check />
              Marcar orden emitida
            </Button>
          </div>
        )}
      </>
    );
  if (!simulation)
    return (
      <Empty title="Aún no hay una decisión de compra">
        Ejecuta una comparación y revisa sus resultados antes de generar la
        orden.
      </Empty>
    );
  const eligible = simulation.evaluations.filter((e) => e.isEligible);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Revisar y aprobar compra</h2>
          <p className="muted">
            La orden se generará con los datos de la cotización seleccionada.
          </p>
        </div>
        <ShieldCheck className="text-primary" />
      </div>
      {!simulation.isCurrent && (
        <div className="warning-notice">
          El resultado está desactualizado. Vuelve a ejecutar la comparación.
        </div>
      )}
      {!eligible.length ? (
        <Empty title="No hay ofertas elegibles" />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const latest = await api.currentSimulation(
                request.requestId,
                simulation.simulationRunId,
              );
              if (!latest.isCurrent)
                throw new Error(
                  'La simulación ya no está vigente. Vuelve a ejecutar la comparación.',
                );
              const created = await api.approve(
                simulation.simulationRunId,
                quoteId,
                conditions,
                destination,
              );
              onOrder(created);
            }, 'Orden generada y aprobada.');
          }}
        >
          <fieldset disabled={busy || !simulation.isCurrent}>
            <section className="panel">
              <Field label="Proveedor seleccionado">
                <Choice
                  label="Proveedor seleccionado"
                  value={quoteId}
                  onChange={(v) => {
                    setChosen(v);
                    setConfirmed(false);
                  }}
                  options={Object.fromEntries(
                    eligible.map((e) => [
                      e.quotationId,
                      `${quotes.find((q) => q.quotationId === e.quotationId)?.supplierBusinessName ?? e.quotationId} · ${score(e.totalScore)} puntos`,
                    ]),
                  )}
                />
              </Field>
              {quote && (
                <div className="quote-summary">
                  <div>
                    <span>Total</span>
                    <strong>
                      {money(total(quote), quote.currency ?? 'PEN')}
                    </strong>
                  </div>
                  <div>
                    <span>Entrega</span>
                    <strong>{quote.deliveryLeadTimeDays} días</strong>
                  </div>
                </div>
              )}
              <Field label="Destino de entrega">
                <Input
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Sede, almacén y dirección"
                />
              </Field>
              <Field label="Condiciones de entrega">
                <Textarea
                  required
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Horario, recepción y condiciones acordadas"
                />
              </Field>
              <label className="approval-check" htmlFor="approve-order">
                <Checkbox
                  id="approve-order"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(Boolean(v))}
                />
                <span>
                  He revisado la oferta y autorizo generar esta orden de compra.
                </span>
              </label>
              <div className="actions">
                <span className="muted">
                  Esta acción registra una aprobación real.
                </span>
                <Button
                  type="submit"
                  disabled={
                    !confirmed || !quoteId || busy || !simulation.isCurrent
                  }
                >
                  <ClipboardCheck />
                  Aprobar y generar orden
                </Button>
              </div>
            </section>
          </fieldset>
        </form>
      )}
    </>
  );
}
