/* oxlint-disable react/react-compiler -- Effects hydrate browser storage and subscribe to asynchronous API data; the app is not compiled with React Compiler. */
'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock3,
  FileText,
  Paperclip,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { optional, SmartQuoteApi } from '@/lib/smartquote/api';
import type {
  PurchaseOrder,
  PurchaseRequest,
  Quotation,
  RequestHistory,
  Scenario,
  Session,
  Simulation,
} from '@/lib/smartquote/types';
import {
  date,
  flow,
  operators,
  priorities,
  statuses,
  title,
  transitions,
} from '@/lib/smartquote/domain';
import { Choice, ErrorNotice, Field, Loading, Status } from './common';
import { QuotesPanel } from './quotes-panel';
import { ComparisonPanel } from './comparison-panel';
import { OrderPanel } from './order-panel';

export type Action = (
  work: () => Promise<void>,
  success?: string,
) => Promise<void>;
export function RequestDetail({
  id,
  api,
  session,
  onBack,
  onBusy,
}: {
  id: string;
  api: SmartQuoteApi;
  session: Session;
  onBack: () => void;
  onBusy: (v: boolean) => void;
}) {
  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [history, setHistory] = useState<RequestHistory | null>(null);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('request');
  const [dialog, setDialog] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [reason, setReason] = useState('');
  const purchasing = session.roles.some((r) =>
    ['PurchaseAnalyst', 'PurchaseManager'].includes(r),
  );
  const manager = session.roles.includes('PurchaseManager');
  const production = session.roles.includes('ProductionSpecialist');
  const runKey = `smartquote.run:${session.baseUrl}:${session.userId}:${id}`;
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const [r, h, q, s] = await Promise.all([
        api.request(id, signal),
        api.history(id, signal),
        purchasing ? api.quotes(id, signal) : Promise.resolve([]),
        purchasing ? optional(api.scenario(id, signal)) : Promise.resolve(null),
      ]);
      if (signal?.aborted) return;
      setRequest(r);
      setHistory(h);
      setQuotes(q);
      setScenario(s);
      const query = new URLSearchParams(window.location.search);
      const runId =
        (query.get('request') === id ? query.get('simulation') : null) ||
        localStorage.getItem(runKey);
      if (runId && purchasing) {
        const run = await optional(api.currentSimulation(id, runId, signal));
        if (run) {
          const ownerScenario = await api.scenarioById(run.scenarioId);
          if (ownerScenario.requestId !== id) {
            localStorage.removeItem(runKey);
            return;
          }
          const foundOrder = manager
            ? await optional(api.orderByRun(runId))
            : null;
          if (!signal?.aborted) {
            setSimulation(run);
            setOrder(foundOrder);
          }
        } else {
          localStorage.removeItem(runKey);
          setSimulation(null);
          setOrder(null);
        }
      }
    },
    [api, id, purchasing, manager, runKey],
  );
  useEffect(() => {
    const abort = new AbortController();
    refresh(abort.signal).catch((e) => {
      if (!abort.signal.aborted) setError(e.message);
    });
    return () => abort.abort();
  }, [refresh]);
  const action: Action = async (work, message) => {
    setBusy(true);
    onBusy(true);
    setError('');
    setSuccess('');
    try {
      await work();
      if (message) setSuccess(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };
  async function updateStatus(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!request) return;
    await action(async () => {
      await api.changeStatus(request, nextStatus, reason);
      setDialog(false);
      setReason('');
      await refresh();
    }, 'Estado actualizado.');
  }
  async function acceptRun(run: Simulation) {
    const s = await api.scenarioById(run.scenarioId);
    if (s.requestId !== id)
      throw new Error('La simulación pertenece a otra solicitud.');
    localStorage.setItem(runKey, run.simulationRunId);
    setSimulation(await api.currentSimulation(id, run.simulationRunId));
    window.history.replaceState(
      null,
      '',
      '?' +
        new URLSearchParams({ request: id, simulation: run.simulationRunId }),
    );
    setOrder(
      manager ? await optional(api.orderByRun(run.simulationRunId)) : null,
    );
  }
  if (!request)
    return (
      <>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Volver
        </Button>
        <ErrorNotice message={error} />
        {!error && <Loading />}
      </>
    );
  return (
    <>
      <div className="detail-top">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft />
          Solicitudes
        </Button>
        <Button
          variant="outline"
          onClick={() => action(() => refresh())}
          disabled={busy}
        >
          <RefreshCw />
          Actualizar
        </Button>
      </div>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            SOLICITUD · {request.requestId.slice(0, 8)}
          </span>
          <h1>{title(request)}</h1>
          <div className="inline-row">
            <Status value={request.status} />
            <span className={`priority priority-${request.priority}`}>
              {priorities[request.priority]}
            </span>
            <span className="muted">
              Requerido: {date(request.requiredDate)}
            </span>
          </div>
        </div>
        {purchasing && (transitions[request.status]?.length ?? 0) > 0 && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setNextStatus(transitions[request.status][0]);
              setDialog(true);
            }}
          >
            Cambiar estado
          </Button>
        )}
      </div>
      <div className="workflow" aria-label="Avance de solicitud">
        {flow.map((step, index) => (
          <div
            key={step}
            className={
              index <= flow.indexOf(request.status)
                ? 'flow-step reached'
                : 'flow-step'
            }
          >
            <span>
              {index < flow.indexOf(request.status) ? <Check /> : index + 1}
            </span>
            <label>{statuses[step]}</label>
          </div>
        ))}
      </div>
      <ErrorNotice message={error} />
      {success && (
        <output className="success-notice">
          <Check />
          {success}
        </output>
      )}
      {busy && (
        <output className="busy-line">
          Guardando y verificando con la API…
        </output>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList variant="line" className="detail-tabs">
          <TabsTrigger value="request">Solicitud</TabsTrigger>
          {purchasing && (
            <>
              <TabsTrigger value="quotes">
                Cotizaciones <span className="count">{quotes.length}</span>
              </TabsTrigger>
              <TabsTrigger value="comparison">Comparación</TabsTrigger>
              <TabsTrigger value="order">Orden de compra</TabsTrigger>
            </>
          )}
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="request">
          <div className="detail-grid">
            <section>
              <div className="section-heading">
                <h2>Insumos solicitados</h2>
                <span className="muted">{request.items.length} ítems</span>
              </div>
              {request.items.map((item) => (
                <article className="panel requested-item" key={item.itemId}>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">INSUMO {item.lineNumber}</span>
                      <h3>{item.description}</h3>
                    </div>
                    <span className="quantity">
                      {item.quantity.toLocaleString('es-PE')}{' '}
                      <small>{item.unitOfMeasure}</small>
                    </span>
                  </div>
                  <div className="requirements">
                    {item.requirements.map((r) => (
                      <div key={r.requirementId} className="requirement-row">
                        <div>
                          <strong>{r.name}</strong>
                          <span>
                            {operators[r.operator]} {r.expectedValue}{' '}
                            {r.unitOfMeasure}
                          </span>
                        </div>
                        <span className={r.isMandatory ? 'mandatory' : 'muted'}>
                          {r.isMandatory ? 'Obligatorio' : 'Referencial'}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>
            <aside>
              <div className="panel">
                <h3>Datos de la solicitud</h3>
                <dl className="facts">
                  <div>
                    <dt>Registrada</dt>
                    <dd>{date(request.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Próxima área responsable</dt>
                    <dd>{request.nextResponsibleArea}</dd>
                  </div>
                  <div>
                    <dt>Identificador</dt>
                    <dd className="id-value">{request.requestId}</dd>
                  </div>
                </dl>
              </div>
              <div className="panel">
                <h3>
                  <Paperclip />
                  Sustento técnico
                </h3>
                {request.attachments.length ? (
                  request.attachments.map((a) => (
                    <div className="attachment" key={a.attachmentId}>
                      <FileText />
                      <div>
                        {a.fileName}
                        <small>{date(a.uploadedAt)}</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Sin archivos adjuntos.</p>
                )}
                {production && (
                  <Field label="Adjuntar documento (máximo 10 MB)">
                    <Input
                      aria-label="Sustento técnico"
                      type="file"
                      disabled={busy}
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = '';
                        void action(async () => {
                          if (!file.size || file.size > 10 * 1024 * 1024)
                            throw new Error(
                              'El archivo debe contener entre 1 byte y 10 MB.',
                            );
                          await api.attach(request, file);
                          await refresh();
                        }, 'Sustento adjuntado.');
                      }}
                    />
                  </Field>
                )}
                <small className="muted">
                  La API actual registra los adjuntos; todavía no permite
                  descargarlos.
                </small>
              </div>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="quotes">
          <QuotesPanel
            api={api}
            request={request}
            quotes={quotes}
            busy={busy}
            action={action}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="comparison">
          <ComparisonPanel
            key={scenario?.scenarioId ?? request.version}
            api={api}
            request={request}
            quotes={quotes}
            scenario={scenario}
            simulation={simulation}
            busy={busy}
            action={action}
            onScenario={(s) => {
              setScenario(s);
              if (simulation)
                setSimulation({ ...simulation, isCurrent: false });
            }}
            onSimulation={acceptRun}
            onReviewOrder={() => setTab('order')}
          />
        </TabsContent>
        <TabsContent value="order">
          <OrderPanel
            api={api}
            request={request}
            quotes={quotes}
            simulation={simulation}
            order={order}
            manager={manager}
            busy={busy}
            action={action}
            onOrder={setOrder}
            refresh={refresh}
          />
        </TabsContent>
        <TabsContent value="history">
          <section className="panel">
            <h2>Historial de cambios</h2>
            <ol className="timeline">
              {history?.entries.map((entry, index) => (
                <li key={entry.changedAt + index}>
                  <span className="timeline-dot">
                    <Clock3 />
                  </span>
                  <div>
                    <div className="inline-row">
                      <Status value={entry.toStatus} />
                      <span className="muted">
                        {date(entry.changedAt, true)}
                      </span>
                    </div>
                    <p>{entry.reason}</p>
                    <small className="muted">
                      Responsable: {entry.changedBy}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </TabsContent>
      </Tabs>
      <Dialog
        open={dialog}
        onOpenChange={(value) => {
          if (!busy) setDialog(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar estado de solicitud</DialogTitle>
            <DialogDescription>
              El cambio se registrará en el historial y notificará al
              solicitante.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={updateStatus}>
            <Field label="Nuevo estado">
              <Choice
                label="Nuevo estado"
                value={nextStatus}
                onChange={setNextStatus}
                options={Object.fromEntries(
                  (transitions[request.status] ?? []).map((v) => [
                    v,
                    statuses[v],
                  ]),
                )}
                disabled={busy}
              />
            </Field>
            <Field label="Motivo">
              <Textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </Field>
            <ErrorNotice message={error} />
            <Button type="submit" disabled={busy || !reason.trim()}>
              Guardar cambio
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
