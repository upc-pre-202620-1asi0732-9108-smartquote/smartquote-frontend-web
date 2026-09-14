'use client';
import { useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SmartQuoteApi } from '@/lib/smartquote/api';
import type {
  ItemInput,
  PurchaseRequest,
  RequirementInput,
} from '@/lib/smartquote/types';
import { operators, priorities } from '@/lib/smartquote/domain';
import { Choice, ErrorNotice, Field } from './common';
const requirement = (): RequirementInput => ({
  name: '',
  operator: 'GreaterThanOrEqual',
  expectedValue: '',
  unitOfMeasure: '',
  isMandatory: true,
});
const item = (): ItemInput => ({
  description: '',
  quantity: 1,
  unitOfMeasure: 'kg',
  requirements: [requirement()],
});
export function RequestForm({
  api,
  onCreated,
  onBusy,
}: {
  api: SmartQuoteApi;
  onCreated: (r: PurchaseRequest) => void;
  onBusy: (value: boolean) => void;
}) {
  const [items, setItems] = useState<ItemInput[]>([item()]);
  const [requiredDate, setDate] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function update(index: number, patch: Partial<ItemInput>) {
    setItems((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  }
  function updateRequirement(
    index: number,
    rindex: number,
    patch: Partial<RequirementInput>,
  ) {
    update(index, {
      requirements: items[index].requirements.map((r, i) =>
        i === rindex ? { ...r, ...patch } : r,
      ),
    });
  }
  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (items.some((i) => !i.requirements.some((r) => r.isMandatory))) {
      setError(
        'Cada insumo necesita al menos un requisito técnico obligatorio.',
      );
      return;
    }
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const created = await api.createRequest({
        requiredDate,
        priority,
        items,
      });
      onBusy(false);
      onCreated(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PRODUCCIÓN Y SANIDAD</span>
          <h1>Nueva solicitud</h1>
          <p className="muted">
            Define qué necesitas y las condiciones que debe cumplir cada insumo.
          </p>
        </div>
      </div>
      <ErrorNotice message={error} />
      <fieldset disabled={busy}>
        <div className="panel form-grid">
          <Field label="Fecha requerida">
            <Input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              required
              value={requiredDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Prioridad">
            <Choice
              label="Prioridad"
              value={priority}
              onChange={setPriority}
              options={priorities}
            />
          </Field>
        </div>
        {items.map((entry, index) => (
          <section key={index} className="panel item-form">
            <div className="section-heading">
              <h2>Insumo {index + 1}</h2>
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  aria-label={`Eliminar insumo ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <div className="item-fields">
              <Field label="Nombre o descripción">
                <Input
                  required
                  value={entry.description}
                  onChange={(e) =>
                    update(index, { description: e.target.value })
                  }
                  placeholder="Ej. Alimento balanceado de crecimiento"
                />
              </Field>
              <Field label="Cantidad">
                <Input
                  required
                  type="number"
                  min="0.001"
                  step="any"
                  value={entry.quantity}
                  onChange={(e) =>
                    update(index, { quantity: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Unidad de medida">
                <Input
                  required
                  value={entry.unitOfMeasure}
                  onChange={(e) =>
                    update(index, { unitOfMeasure: e.target.value })
                  }
                  placeholder="kg, unidad, litro"
                />
              </Field>
            </div>
            <h3>Requisitos técnicos</h3>
            {entry.requirements.map((r, ri) => (
              <div className="requirement-form" key={ri}>
                <Field label="Característica">
                  <Input
                    required
                    placeholder="Ej. Proteína"
                    value={r.name}
                    onChange={(e) =>
                      updateRequirement(index, ri, { name: e.target.value })
                    }
                  />
                </Field>
                <Field label="Condición">
                  <Choice
                    label="Operador"
                    options={operators}
                    value={r.operator}
                    onChange={(value) =>
                      updateRequirement(index, ri, { operator: value })
                    }
                  />
                </Field>
                <Field label="Valor">
                  <Input
                    required
                    value={r.expectedValue}
                    onChange={(e) =>
                      updateRequirement(index, ri, {
                        expectedValue: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Unidad">
                  <Input
                    value={r.unitOfMeasure}
                    onChange={(e) =>
                      updateRequirement(index, ri, {
                        unitOfMeasure: e.target.value,
                      })
                    }
                    placeholder="%"
                  />
                </Field>
                <label
                  className="inline-row"
                  htmlFor={`mandatory-${index}-${ri}`}
                >
                  <Checkbox
                    id={`mandatory-${index}-${ri}`}
                    checked={r.isMandatory}
                    onCheckedChange={(value) =>
                      updateRequirement(index, ri, {
                        isMandatory: Boolean(value),
                      })
                    }
                  />
                  Obligatorio
                </label>
                {entry.requirements.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      update(index, {
                        requirements: entry.requirements.filter(
                          (_, i) => i !== ri,
                        ),
                      })
                    }
                    aria-label="Eliminar requisito"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update(index, {
                  requirements: [...entry.requirements, requirement()],
                })
              }
            >
              <Plus />
              Agregar requisito
            </Button>
          </section>
        ))}
        <div className="actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => setItems([...items, item()])}
          >
            <Plus />
            Agregar insumo
          </Button>
          <Button type="submit" disabled={busy}>
            <Send />
            {busy ? 'Registrando…' : 'Enviar solicitud'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
