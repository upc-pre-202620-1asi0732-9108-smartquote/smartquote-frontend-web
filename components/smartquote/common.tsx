'use client';
import { cloneElement, isValidElement, useId, type ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statuses } from '@/lib/smartquote/domain';
export function Choice({
  value,
  onChange,
  options,
  label,
  id,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  label: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(String(v ?? ''))}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className="min-h-11 w-full">
        <SelectValue>{options[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([v, text]) => (
          <SelectItem key={v} value={v}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value}`}>{statuses[value] ?? value}</span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error-notice" role="alert">
      <AlertCircle />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <output className="loading">
      <Loader2 className="animate-spin" /> Consultando SmartQuote…
    </output>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const control = isValidElement<{ id?: string }>(children) ? children : null;
  const id = control?.props.id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control ? cloneElement(control, { id }) : children}
    </div>
  );
}
