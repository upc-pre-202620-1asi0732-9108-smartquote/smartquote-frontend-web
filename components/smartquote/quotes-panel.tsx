'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  FileSearch,
  FileUp,
  Pencil,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  ExtractedField,
  PurchaseRequest,
  Quotation,
} from '@/lib/smartquote/types';
import { date, fieldLabel, money, total } from '@/lib/smartquote/domain';
import { Choice, Empty, ErrorNotice, Field, Status } from './common';
import type { Action } from './request-detail';

export function QuotesPanel({
  api,
  request,
  quotes,
  busy,
  action,
  refresh,
}: {
  api: SmartQuoteApi;
  request: PurchaseRequest;
  quotes: Quotation[];
  busy: boolean;
  action: Action;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<
    { name: string; ok: boolean; message: string }[]
  >([]);
  const canUpload = ['QuotationCollection', 'Evaluation'].includes(
    request.status,
  );
  const quote = quotes.find((q) => q.quotationId === selected);
  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setResults([]);
    await action(async () => {
      const failures: File[] = [];
      for (const file of files) {
        try {
          if (
            !file.name.toLowerCase().endsWith('.pdf') ||
            file.size === 0 ||
            file.size > 15 * 1024 * 1024
          )
            throw new Error('Debe ser un PDF de hasta 15 MB.');
          const uploaded = await api.upload(
            request.requestId,
            {
              supplierId: supplierId.trim(),
              supplierBusinessName: name.trim(),
              supplierTaxIdentifier: taxId.trim(),
            },
            file,
          );
          setResults((r) => [
            ...r,
            {
              name: file.name,
              ok: true,
              message: `${uploaded.status === 'Uploaded' ? 'Registrada' : 'Ya registrada'} · ${uploaded.quotationId.slice(0, 8)}`,
            },
          ]);
        } catch (e) {
          failures.push(file);
          setResults((r) => [
            ...r,
            { name: file.name, ok: false, message: (e as Error).message },
          ]);
        }
      }
      setFiles(failures);
      await refresh();
    });
  }
  if (quote)
    return (
      <QuoteReview
        key={quote.quotationId + ':' + quote.version}
        quote={quote}
        request={request}
        api={api}
        busy={busy}
        action={action}
        refresh={refresh}
        onBack={() => setSelected(null)}
      />
    );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Cotizaciones recibidas</h2>
          <p className="muted">
            Carga el PDF, extrae la información y verifica cada oferta antes de
            compararla.
          </p>
        </div>
        <Button disabled={busy || !canUpload} onClick={() => setUpload(true)}>
          <FileUp />
          Cargar cotizaciones
        </Button>
      </div>
      {!canUpload && (
        <p className="info-notice">
          Para recibir cotizaciones, la solicitud debe estar en recopilación o
          evaluación.
        </p>
      )}
      {quotes.length ? (
        <div className="panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((q) => (
                <TableRow key={q.quotationId}>
                  <TableCell>
                    <strong>{q.supplierBusinessName}</strong>
                    <div className="record-meta">{q.fileName}</div>
                  </TableCell>
                  <TableCell>{money(total(q), q.currency ?? 'PEN')}</TableCell>
                  <TableCell>
                    {q.deliveryLeadTimeDays == null
                      ? '—'
                      : `${q.deliveryLeadTimeDays} días`}
                  </TableCell>
                  <TableCell>
                    <Status value={q.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setSelected(q.quotationId)}
                    >
                      Revisar
                      <ArrowRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty title="Todavía no hay cotizaciones">
          Comienza cargando la oferta de un proveedor para esta solicitud.
        </Empty>
      )}
      <Dialog
        open={upload}
        onOpenChange={(v) => {
          if (!busy) setUpload(v);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cargar cotizaciones</DialogTitle>
            <DialogDescription>
              Los documentos seleccionados deben pertenecer al mismo proveedor.
              La extracción se inicia después de la carga.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              <Field label="Razón social">
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <div className="form-grid">
                <Field label="RUC o identificación fiscal">
                  <Input
                    required
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </Field>
                <Field label="Código del proveedor">
                  <Input
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    placeholder="Código interno o RUC"
                  />
                </Field>
              </div>
              <label className="upload-zone" htmlFor="quotation-files">
                <UploadCloud />
                <strong>Seleccionar archivos PDF</strong>
                <span>Hasta 20 documentos · 15 MB por archivo</span>
                <Input
                  id="quotation-files"
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  aria-label="Cotizaciones PDF"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []).slice(0, 20));
                    setResults([]);
                  }}
                />
              </label>
              {files.length > 0 && (
                <p>{files.length} archivos pendientes de carga</p>
              )}
              <ul className="upload-results">
                {results.map((r, i) => (
                  <li
                    key={i}
                    className={r.ok ? 'text-primary' : 'text-destructive'}
                  >
                    {r.name}: {r.message}
                  </li>
                ))}
              </ul>
              <Button type="submit" disabled={busy || !files.length}>
                {busy ? 'Cargando documentos…' : 'Cargar documentos'}
              </Button>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
function QuoteReview({
  quote,
  request,
  api,
  busy,
  action,
  refresh,
  onBack,
}: {
  quote: Quotation;
  request: PurchaseRequest;
  api: SmartQuoteApi;
  busy: boolean;
  action: Action;
  refresh: () => Promise<void>;
  onBack: () => void;
}) {
  const [mappings, setMappings] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      quote.lines.map((l) => [
        l.lineId,
        l.requestedItemId ??
          (request.items.length === 1 ? request.items[0].itemId : ''),
      ]),
    ),
  );
  const [field, setField] = useState<ExtractedField | null>(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setError] = useState('');
  const pending = quote.status === 'RequiresVerification';
  const unresolved = quote.fields.filter(
    (f) => f.isRequired && f.status === 'Unresolved',
  );
  async function save(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!field) return;
    setError('');
    await action(async () => {
      try {
        await api.correct(quote, field.fieldId, value, reason);
        setField(null);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    }, 'Campo corregido.');
  }
  return (
    <>
      <Button variant="ghost" disabled={busy} onClick={onBack}>
        <ArrowLeft />
        Todas las cotizaciones
      </Button>
      <div className="section-heading">
        <div>
          <h2>{quote.supplierBusinessName}</h2>
          <span className="muted">
            {quote.fileName} · {quote.supplierTaxIdentifier}
          </span>
        </div>
        <Status value={quote.status} />
      </div>
      {quote.rejectionReason && <ErrorNotice message={quote.rejectionReason} />}
      <div className="quote-summary">
        <div>
          <span>Total cotizado</span>
          <strong>{money(total(quote), quote.currency ?? 'PEN')}</strong>
        </div>
        <div>
          <span>Entrega</span>
          <strong>
            {quote.deliveryLeadTimeDays == null
              ? '—'
              : `${quote.deliveryLeadTimeDays} días`}
          </strong>
        </div>
        <div>
          <span>Válida hasta</span>
          <strong>{date(quote.validUntil)}</strong>
        </div>
      </div>
      {['Uploaded', 'Rejected'].includes(quote.status) ? (
        <section className="panel processing-empty">
          <FileSearch />
          <h3>
            {quote.status === 'Rejected'
              ? 'Volver a procesar el documento'
              : 'Documento listo para procesar'}
          </h3>
          <p className="muted">
            La API extraerá los datos para que puedas revisarlos y confirmar la
            oferta.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              action(async () => {
                try {
                  await api.process(quote.quotationId);
                } finally {
                  await refresh();
                }
              }, 'Extracción completada. Revisa los campos y vincula los insumos.')
            }
          >
            <FileSearch />
            {busy ? 'Procesando…' : 'Extraer información'}
          </Button>
        </section>
      ) : (
        <>
          {unresolved.length > 0 && (
            <div className="warning-notice">
              Hay {unresolved.length} campos obligatorios sin resolver.
              Corrígelos antes de verificar.
            </div>
          )}
          <div className="section-heading">
            <h3>Datos extraídos y evidencia</h3>
            <span className="muted">{quote.fields.length} campos</span>
          </div>
          <div className="extracted-grid">
            {quote.fields.map((f) => (
              <article
                className={`panel extracted-field ${f.status === 'Unresolved' ? 'unresolved' : ''}`}
                key={f.fieldId}
              >
                <div className="section-heading">
                  <span className="field-name">{fieldLabel(f.fieldPath)}</span>
                  {pending &&
                    /^(validUntil|currency|deliveryLeadTimeDays|lines\[\d+\]\.(description|quantity|unitOfMeasure|unitPrice))$/.test(
                      f.fieldPath,
                    ) && (
                      <Button
                        variant="ghost"
                        aria-label={`Corregir ${fieldLabel(f.fieldPath)}`}
                        disabled={busy}
                        onClick={() => {
                          setField(f);
                          setValue(f.currentValue ?? '');
                          setReason('');
                        }}
                      >
                        <Pencil />
                      </Button>
                    )}
                </div>
                <strong className="extracted-value">
                  {f.currentValue ?? 'No identificado'}
                </strong>
                <div className="record-meta">
                  Confianza: {Math.round(f.confidence * 100)} % ·{' '}
                  {f.status === 'Unresolved'
                    ? 'Por resolver'
                    : f.status === 'Corrected'
                      ? 'Corregido'
                      : f.status === 'Confirmed'
                        ? 'Confirmado'
                        : 'Identificado'}
                  {f.isRequired ? ' · Obligatorio' : ''}
                </div>
                <blockquote>
                  <span>Página {f.sourcePageNumber}</span>
                  {f.sourceTextReference}
                </blockquote>
                {f.corrections.length > 0 && (
                  <details>
                    <summary>Ver {f.corrections.length} correcciones</summary>
                    {f.corrections.map((c, i) => (
                      <p key={i}>
                        {c.previousValue} → {c.correctedValue}
                        <br />
                        <small>
                          {c.reason} · {date(c.correctedAt, true)}
                        </small>
                      </p>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </div>
          <section className="panel">
            <h3>Vincular productos con la solicitud</h3>
            <p className="muted">
              Indica a qué insumo corresponde cada línea de esta cotización.
            </p>
            {quote.lines.map((l) => (
              <div className="line-mapping" key={l.lineId}>
                <div>
                  <strong>{l.description ?? `Línea ${l.lineNumber}`}</strong>
                  <span className="muted">
                    {l.quantity} {l.unitOfMeasure} ·{' '}
                    {money(l.unitPrice, quote.currency ?? 'PEN')}
                  </span>
                  {l.specifications.map((s) => (
                    <small key={s.name}>
                      {s.name}: {s.value} {s.unitOfMeasure}
                    </small>
                  ))}
                </div>
                <Choice
                  label={`Insumo de la línea ${l.lineNumber}`}
                  disabled={busy || !pending}
                  value={mappings[l.lineId] ?? ''}
                  options={{
                    '': 'Seleccionar insumo',
                    ...Object.fromEntries(
                      request.items.map((i) => [i.itemId, i.description]),
                    ),
                  }}
                  onChange={(v) =>
                    setMappings((m) => ({ ...m, [l.lineId]: v }))
                  }
                />
              </div>
            ))}
            {pending && (
              <div className="actions">
                <span className="muted">
                  La verificación habilita la oferta para la comparación.
                </span>
                <Button
                  disabled={
                    busy ||
                    unresolved.length > 0 ||
                    quote.lines.length === 0 ||
                    quote.lines.some((l) => !mappings[l.lineId])
                  }
                  onClick={() =>
                    action(async () => {
                      await api.confirm(quote, mappings);
                      await refresh();
                    }, 'Cotización verificada.')
                  }
                >
                  <CheckCheck />
                  Confirmar cotización
                </Button>
              </div>
            )}
          </section>
        </>
      )}
      <Dialog
        open={Boolean(field)}
        onOpenChange={(v) => {
          if (!v && !busy) setField(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Corregir {field ? fieldLabel(field.fieldPath) : 'campo'}
            </DialogTitle>
            <DialogDescription>
              La corrección y su motivo se guardan para mantener la
              trazabilidad.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save}>
            <Field label="Valor corregido">
              <Input
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={busy}
              />
            </Field>
            <Field label="Motivo de la corrección">
              <Textarea
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </Field>
            <ErrorNotice message={localError} />
            <Button type="submit" disabled={busy || !reason.trim()}>
              Guardar corrección
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
