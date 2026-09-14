'use client';
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Play,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SmartQuoteApi } from '@/lib/smartquote/api';
import type {
  Criterion,
  PurchaseRequest,
  Quotation,
  Scenario,
  Simulation,
} from '@/lib/smartquote/types';
import {
  date,
  defaultCriteria,
  money,
  operators,
  score,
  total,
} from '@/lib/smartquote/domain';
import { Empty } from './common';
import type { Action } from './request-detail';

export function ComparisonPanel({
  api,
  request,
  quotes,
  scenario,
  simulation,
  busy,
  action,
  onScenario,
  onSimulation,
  onReviewOrder,
}: {
  api: SmartQuoteApi;
  request: PurchaseRequest;
  quotes: Quotation[];
  scenario: Scenario | null;
  simulation: Simulation | null;
  busy: boolean;
  action: Action;
  onScenario: (s: Scenario) => void;
  onSimulation: (s: Simulation) => Promise<void>;
  onReviewOrder: () => void;
}) {
  const [criteria, setCriteria] = useState<Criterion[]>(
    () => scenario?.criteria ?? defaultCriteria(request),
  );
  const [edit, setEdit] = useState(!scenario);
  const [runId, setRunId] = useState('');

  const configured = ['QuotationCollection', 'Evaluation'].includes(
    request.status,
  );
  const weighted = criteria.filter((c) => c.mode === 'Weighted');
  const weightSum = weighted.reduce((n, c) => n + c.weight, 0);
  const dirty =
    JSON.stringify(criteria) !==
    JSON.stringify(scenario?.criteria ?? defaultCriteria(request));
  const verified = quotes.filter((q) => q.status === 'Verified');
  const currencies = new Set(verified.map((q) => q.currency));
  async function save() {
    const saved = await api.saveScenario(request.requestId, criteria, scenario);
    onScenario(saved);
    setEdit(false);
  }
  const winner = quotes.find(
    (q) => q.quotationId === simulation?.recommendation?.quotationId,
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Evaluación de alternativas</h2>
          <p className="muted">
            Primero el cumplimiento técnico. Después, el balance entre precio y
            entrega.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setEdit((v) => !v)}
          disabled={busy}
        >
          <SlidersHorizontal />
          Criterios {scenario ? `· v${scenario.version}` : ''}
        </Button>
      </div>
      {!configured && (
        <div className="info-notice">
          Configura criterios durante la recopilación de cotizaciones. Para
          ejecutar, cambia la solicitud a «En evaluación».
        </div>
      )}
      {edit && (
        <section className="panel criteria-panel">
          <div className="section-heading">
            <h3>
              <ShieldCheck />
              Condiciones obligatorias
            </h3>
            <span className="muted">Una oferta debe cumplirlas todas</span>
          </div>
          {criteria
            .filter((c) => c.mode === 'Mandatory')
            .map((c, index) => (
              <div className="requirement-row" key={c.targetField + index}>
                <div>
                  <strong>{c.name}</strong>
                  <span>
                    {operators[c.operator]} {c.expectedValue} {c.unitOfMeasure}
                  </span>
                </div>
                <Check className="text-primary" />
              </div>
            ))}
          <h3 className="mt-6">Pesos de la comparación</h3>
          <div className="weights-grid">
            {criteria.map(
              (c, index) =>
                c.mode === 'Weighted' && (
                  <label className="weight-field" key={c.targetField}>
                    <span>{c.name}</span>
                    <div className="inline-row">
                      <Input
                        aria-label={`Peso de ${c.name}`}
                        disabled={busy || !configured}
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={c.weight}
                        onChange={(e) =>
                          setCriteria((current) =>
                            current.map((entry, i) =>
                              i === index
                                ? { ...entry, weight: Number(e.target.value) }
                                : entry,
                            ),
                          )
                        }
                      />
                      <span>%</span>
                    </div>
                  </label>
                ),
            )}
          </div>
          <div className="actions">
            <span
              className={
                Math.abs(weightSum - 100) < 0.0001
                  ? 'text-primary'
                  : 'text-destructive'
              }
            >
              Total: {weightSum.toLocaleString('es-PE')} / 100 %
            </span>
            <Button
              disabled={
                busy ||
                !configured ||
                !weighted.length ||
                Math.abs(weightSum - 100) > 0.0001 ||
                criteria.some((c) => !Number.isFinite(c.weight) || c.weight < 0)
              }
              onClick={() =>
                action(
                  save,
                  'Criterios guardados. Ejecuta la comparación para actualizar el resultado.',
                )
              }
            >
              <Save />
              Guardar {scenario ? 'nueva versión' : 'criterios'}
            </Button>
          </div>
        </section>
      )}
      <div className="comparison-toolbar">
        <div>
          <strong>{verified.length} cotizaciones verificadas</strong>
          <span className="muted">
            {quotes.length - verified.length} pendientes o rechazadas
          </span>
        </div>
        <Button
          disabled={
            busy ||
            request.status !== 'Evaluation' ||
            !scenario ||
            dirty ||
            verified.length === 0 ||
            currencies.size > 1
          }
          onClick={() =>
            action(async () => {
              const run = await api.simulate(scenario!.scenarioId);
              await onSimulation(run);
            }, 'Comparación calculada por el backend.')
          }
        >
          <Play />
          {busy ? 'Calculando…' : 'Ejecutar comparación'}
        </Button>
      </div>
      {dirty && (
        <div className="warning-notice">
          Guarda los cambios de criterios antes de ejecutar.
        </div>
      )}
      {currencies.size > 1 && (
        <div className="warning-notice">
          Las cotizaciones utilizan monedas distintas. El backend no convierte
          divisas: unifica la moneda antes de comparar.
        </div>
      )}
      {simulation ? (
        <>
          <div className="section-heading">
            <span className="muted">
              Ejecutada: {date(simulation.executedAt, true)} · Criterios v
              {simulation.criteriaVersion}
            </span>
            <span
              className={
                simulation.isCurrent ? 'current-label' : 'text-destructive'
              }
            >
              {simulation.isCurrent
                ? 'Resultado vigente'
                : 'Resultado desactualizado'}
            </span>
          </div>
          {!simulation.isCurrent && (
            <div className="warning-notice">
              La solicitud, las cotizaciones o los criterios cambiaron. Vuelve a
              ejecutar antes de aprobar una orden.
            </div>
          )}
          <div className="panel comparison-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criterio</TableHead>
                  {simulation.evaluations.map((e) => (
                    <TableHead key={e.quotationId}>
                      <strong>
                        {quotes.find((q) => q.quotationId === e.quotationId)
                          ?.supplierBusinessName ?? e.quotationId.slice(0, 8)}
                      </strong>
                      {simulation.recommendation?.quotationId ===
                        e.quotationId && (
                        <span className="recommended-tag">
                          <Trophy />
                          Recomendado
                        </span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Total cotizado</TableCell>
                  {simulation.evaluations.map((e) => {
                    const q = quotes.find(
                      (q) => q.quotationId === e.quotationId,
                    );
                    return (
                      <TableCell key={e.quotationId}>
                        {q ? money(total(q), q.currency ?? 'PEN') : '—'}
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableCell>Entrega</TableCell>
                  {simulation.evaluations.map((e) => (
                    <TableCell key={e.quotationId}>
                      {quotes.find((q) => q.quotationId === e.quotationId)
                        ?.deliveryLeadTimeDays ?? '—'}{' '}
                      días
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Elegibilidad</TableCell>
                  {simulation.evaluations.map((e) => (
                    <TableCell key={e.quotationId}>
                      <span className={e.isEligible ? 'eligible' : 'excluded'}>
                        {e.isEligible ? <Check /> : <X />}
                        {e.isEligible ? 'Cumple' : 'Excluida'}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Puntaje / 100</TableCell>
                  {simulation.evaluations.map((e) => (
                    <TableCell key={e.quotationId}>
                      <strong className="score">
                        {e.isEligible ? score(e.totalScore) : '—'}
                      </strong>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell>Posición</TableCell>
                  {simulation.evaluations.map((e) => (
                    <TableCell key={e.quotationId}>
                      {e.rank ? `#${e.rank}` : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {simulation.recommendation ? (
            <div className="recommendation">
              <span className="recommendation-icon">
                <Trophy />
              </span>
              <div>
                <span className="eyebrow">ALTERNATIVA RECOMENDADA</span>
                <h3>
                  {winner?.supplierBusinessName ??
                    simulation.recommendation.quotationId}
                </h3>
                <p>{simulation.recommendation.explanation}</p>
              </div>
              <Button
                disabled={busy || !simulation.isCurrent || dirty}
                onClick={onReviewOrder}
              >
                Revisar decisión
                <ArrowRight />
              </Button>
            </div>
          ) : (
            <Empty title="Ninguna oferta cumple las condiciones">
              Revisa los motivos de exclusión o solicita nuevas ofertas.
            </Empty>
          )}
          <section className="panel">
            <h3>Desglose y motivos de la evaluación</h3>
            {simulation.evaluations.map((e) => (
              <details className="evaluation-details" key={e.quotationId}>
                <summary>
                  {quotes.find((q) => q.quotationId === e.quotationId)
                    ?.supplierBusinessName ?? e.quotationId}{' '}
                  ·{' '}
                  {e.isEligible ? `${score(e.totalScore)} puntos` : 'Excluida'}
                </summary>
                {e.exclusionReasons.map((r, i) => (
                  <p className="text-destructive" key={i}>
                    {r.explanation}
                  </p>
                ))}
                {e.criterionResults.map((r) => (
                  <div className="criterion-result" key={r.criterionId}>
                    <span>{r.explanation}</span>
                    <span>{score(r.weightedContribution)} puntos</span>
                  </div>
                ))}
              </details>
            ))}
          </section>
          <details className="help">
            <summary>Referencia de la simulación</summary>
            <p className="id-value">{simulation.simulationRunId}</p>
          </details>
        </>
      ) : (
        <Empty title="Compara las ofertas verificadas">
          Guarda los criterios y ejecuta la comparación para obtener una
          recomendación.
        </Empty>
      )}
      <details className="help">
        <summary>Recuperar una simulación por su identificador</summary>
        <form
          className="inline-row"
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              if (!/^[0-9a-f-]{36}$/i.test(runId))
                throw new Error('Introduce un UUID de simulación válido.');
              await onSimulation(await api.simulation(runId));
            });
          }}
        >
          <Input
            aria-label="Identificador de simulación"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="UUID de simulación"
            required
          />
          <Button type="submit" variant="outline" disabled={busy}>
            Consultar
          </Button>
        </form>
        <p className="muted">
          Las referencias creadas en esta sesión se recuerdan en este
          dispositivo. Los resultados siempre se consultan a la API.
        </p>
      </details>
    </>
  );
}
