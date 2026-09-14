/* oxlint-disable react/react-compiler */
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Leaf,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { parseSession, SmartQuoteApi } from '@/lib/smartquote/api';
import type {
  Notification,
  Page,
  PurchaseRequest,
  Session,
} from '@/lib/smartquote/types';
import {
  date,
  priorities,
  roles,
  statuses,
  title,
} from '@/lib/smartquote/domain';
import { Choice, Empty, ErrorNotice, Field, Loading, Status } from './common';
import { RequestForm } from './request-form';
import { RequestDetail } from './request-detail';

const SESSION_KEY = 'smartquote.session.v1';
export function SmartQuoteApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const s = JSON.parse(stored);
        setSession(parseSession(s.baseUrl, s.token));
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!session) return;
    const delay = Math.max(0, session.expiresAt - Date.now());
    const timer = setTimeout(
      () => {
        sessionStorage.removeItem(SESSION_KEY);
        setSession(null);
        setNotice('La sesión ha vencido. Vuelve a conectar para continuar.');
      },
      Math.min(delay, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [session]);
  function connect(s: Session) {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ baseUrl: s.baseUrl, token: s.token }),
    );
    localStorage.setItem('smartquote.api', s.baseUrl);
    setSession(s);
    setNotice('');
  }
  function disconnect() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }
  if (!ready) return <Loading />;
  return session ? (
    <Workspace
      key={session.userId + session.baseUrl + session.token}
      session={session}
      disconnect={disconnect}
    />
  ) : (
    <Access onConnect={connect} notice={notice} />
  );
}
function Access({
  onConnect,
  notice,
}: {
  onConnect: (s: Session) => void;
  notice: string;
}) {
  const [url, setUrl] = useState('http://localhost:8080');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setUrl(
      localStorage.getItem('smartquote.api') ||
        import.meta.env.VITE_API_BASE_URL ||
        'http://localhost:8080',
    );
  }, []);
  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = parseSession(url, token);
      await new SmartQuoteApi(session).listRequests();
      onConnect(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="access-page">
      <section className="access-story">
        <div className="brand">
          <span className="brand-mark">
            <Leaf />
          </span>
          SmartQuote
        </div>
        <div>
          <span className="eyebrow">ADQUISICIONES · SECTOR AVÍCOLA</span>
          <h1>
            De la solicitud
            <br />a una decisión
            <br />
            <em>bien sustentada.</em>
          </h1>
          <p>
            Revisa cotizaciones, compara requisitos y prepara tus órdenes de
            compra en un mismo lugar.
          </p>
        </div>
        <div className="access-proof">
          <FileCheck2 />
          <span>Requisitos claros. Decisiones trazables.</span>
        </div>
      </section>
      <section className="access-form">
        <div className="access-form-inner">
          <span className="eyebrow">TU ESPACIO DE TRABAJO</span>
          <h2>Conecta tu sesión</h2>
          <p className="muted">
            Utiliza la dirección de la API y el token de acceso de tu
            organización.
          </p>
          <ErrorNotice message={error || notice} />
          <form onSubmit={submit}>
            <Field label="Dirección del backend">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                required
                disabled={busy}
              />
            </Field>
            <Field label="Token de acceso">
              <Textarea
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="Pega tu token JWT"
                rows={4}
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
              />
            </Field>
            <Button type="submit" disabled={busy} className="wide-button">
              {busy ? 'Comprobando acceso…' : 'Conectar con SmartQuote'}
              <ArrowRight />
            </Button>
          </form>
          <div className="access-note">
            <ShieldCheck />
            <span>
              El token se conserva solo durante esta sesión del navegador. Los
              permisos los verifica la API.
            </span>
          </div>
          <details className="help">
            <summary>¿Cómo obtengo acceso?</summary>
            <p>
              El backend actual valida tokens JWT, pero todavía no ofrece inicio
              de sesión con contraseña. Solicita un token al responsable de la
              API. Para desarrollo local, el repositorio incluye un generador de
              sesiones de prueba.
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
function Workspace({
  session,
  disconnect,
}: {
  session: Session;
  disconnect: () => void;
}) {
  const api = useMemo(() => new SmartQuoteApi(session), [session]);
  const isProduction = session.roles.includes('ProductionSpecialist');
  const isPurchasing = session.roles.some((r) =>
    ['PurchaseAnalyst', 'PurchaseManager'].includes(r),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [screen, setScreen] = useState<'requests' | 'create' | 'notifications'>(
    'requests',
  );
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Page<PurchaseRequest> | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [mutating, setMutating] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    const gen = ++generation.current;
    setLoading(true);
    setError('');
    setData(null);
    const task =
      screen === 'notifications'
        ? api.notifications(abort.signal).then(setNotifications)
        : api.listRequests(filter, page, abort.signal).then(setData);
    task
      .catch((e) => {
        if (!abort.signal.aborted && gen === generation.current)
          setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted && gen === generation.current)
          setLoading(false);
      });
    return () => abort.abort();
  }, [api, filter, page, revision, screen]);
  function openRequest(id: string) {
    setSelected(id);
    setScreen('requests');
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context) return;
    const life = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'open_purchase_request',
            title: 'Abrir solicitud de SmartQuote',
            description:
              'Consulta una solicitud autorizada de la API y abre su detalle en la interfaz; no modifica registros.',
            inputSchema: {
              type: 'object',
              properties: { requestId: { type: 'string' } },
              required: ['requestId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input: unknown) => {
              const id = (input as { requestId?: unknown })?.requestId;
              if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))
                throw new Error(
                  'Se requiere un identificador UUID de solicitud.',
                );
              const request = await api.request(id);
              openRequest(request.requestId);
              return { requestId: request.requestId, status: request.status };
            },
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, [api]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('request');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setSelected(id);
  }, []);
  const rows =
    data?.items.filter((r) =>
      `${title(r)} ${r.requestId}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  return (
    <SidebarProvider>
      <Sidebar className="sq-sidebar">
        <SidebarHeader className="p-6">
          <div className="brand">
            <span className="brand-mark">
              <Leaf />
            </span>
            SmartQuote
          </div>
          <span className="sidebar-sub">Gestión de adquisiciones</span>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-6">
          <span className="sidebar-label">ESPACIO DE TRABAJO</span>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="nav-button"
                isActive={screen === 'requests'}
                disabled={mutating}
                onClick={() => {
                  setScreen('requests');
                  setSelected(null);
                }}
              >
                <FileCheck2 />
                <span>Solicitudes</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isProduction && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="nav-button"
                    isActive={screen === 'create'}
                    disabled={mutating}
                    onClick={() => {
                      setSelected(null);
                      setScreen('create');
                    }}
                  >
                    <Plus />
                    <span>Nueva solicitud</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="nav-button"
                    isActive={screen === 'notifications'}
                    disabled={mutating}
                    onClick={() => {
                      setSelected(null);
                      setScreen('notifications');
                    }}
                  >
                    <Bell />
                    <span>Notificaciones</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
          <div className="sidebar-caption">
            <Leaf />
            <p>
              Todo comienza con
              <br />
              un buen requerimiento.
            </p>
          </div>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <div className="user-card">
            <span className="avatar">{isProduction ? 'PS' : 'CO'}</span>
            <div>
              <strong>
                {session.roles.map((r) => roles[r] ?? r).join(' / ') ||
                  'Usuario'}
              </strong>
              <span>Sesión conectada</span>
            </div>
          </div>
          <Button variant="ghost" disabled={mutating} onClick={disconnect}>
            <LogOut />
            Cerrar sesión
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="workspace-header">
          <div className="inline-row">
            <SidebarTrigger />
            <span className="muted">
              {isProduction ? 'Producción y sanidad' : 'Adquisiciones'}
            </span>
          </div>
          <div className="connection">
            <span />
            API conectada
          </div>
        </header>
        <main className="workspace-main">
          {selected ? (
            <RequestDetail
              key={selected}
              id={selected}
              api={api}
              session={session}
              onBack={() => {
                setSelected(null);
                setRevision((r) => r + 1);
              }}
              onBusy={setMutating}
            />
          ) : screen === 'create' ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setScreen('requests')}
                disabled={mutating}
              >
                <ArrowLeft />
                Volver a solicitudes
              </Button>
              <RequestForm
                api={api}
                onBusy={setMutating}
                onCreated={(request) => openRequest(request.requestId)}
              />
            </>
          ) : screen === 'notifications' ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">SEGUIMIENTO</span>
                  <h1>Notificaciones</h1>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setRevision((r) => r + 1)}
                >
                  <RefreshCw />
                  Actualizar
                </Button>
              </div>
              <ErrorNotice message={error} />
              {loading ? (
                <Loading />
              ) : notifications.length ? (
                notifications.map((n) => (
                  <article
                    className="notification panel"
                    key={n.notificationId}
                  >
                    <div>
                      <Status value={n.newStatus} />
                      <h3>{n.message}</h3>
                      <span className="muted">
                        {date(n.createdAt, true)}
                        {!n.readAt ? ' · Sin leer' : ''}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await api.readNotification(n.notificationId);
                          openRequest(n.purchaseRequestId);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Ver solicitud
                      <ArrowRight />
                    </Button>
                  </article>
                ))
              ) : (
                <Empty title="No tienes notificaciones">
                  Aquí aparecerán los cambios de estado de tus solicitudes.
                </Empty>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">CENTRO DE COMPRAS</span>
                  <h1>Solicitudes de insumos</h1>
                  <p className="muted">
                    {isPurchasing
                      ? 'Revisa cada requerimiento y encuentra la mejor alternativa de compra.'
                      : 'Registra necesidades y sigue el avance de tus solicitudes.'}
                  </p>
                </div>
                {isProduction && (
                  <Button onClick={() => setScreen('create')}>
                    <Plus />
                    Nueva solicitud
                  </Button>
                )}
              </div>
              <div className="list-toolbar">
                <div className="search-field">
                  <Search />
                  <Input
                    aria-label="Buscar en esta página"
                    placeholder="Buscar insumo o ID en esta página"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="filter-field">
                  <SlidersHorizontal />
                  <Choice
                    label="Estado"
                    value={filter}
                    onChange={(value) => {
                      setFilter(value);
                      setPage(1);
                    }}
                    options={{
                      '': 'Todos los estados',
                      ...Object.fromEntries(
                        Object.entries(statuses).filter(([key]) =>
                          [
                            'Submitted',
                            'UnderReview',
                            'QuotationCollection',
                            'Evaluation',
                            'Approved',
                            'Ordered',
                            'Rejected',
                            'Cancelled',
                          ].includes(key),
                        ),
                      ),
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() => setRevision((r) => r + 1)}
                >
                  <RefreshCw />
                  Actualizar
                </Button>
              </div>
              <ErrorNotice message={error} />
              {loading ? (
                <Loading />
              ) : (
                data && (
                  <div className="panel request-list">
                    <div className="list-caption">
                      <strong>{data.totalItems} solicitudes</strong>
                      <span className="muted">
                        Página {data.page} de {Math.max(data.totalPages, 1)}
                      </span>
                    </div>
                    {rows.length ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Solicitud / insumo</TableHead>
                            <TableHead>Prioridad</TableHead>
                            <TableHead>Fecha requerida</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>
                              <span className="sr-only">Acciones</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((r) => (
                            <TableRow key={r.requestId}>
                              <TableCell>
                                <button
                                  className="request-link"
                                  onClick={() => openRequest(r.requestId)}
                                >
                                  {title(r)}
                                </button>
                                <div className="record-meta">
                                  {r.requestId.slice(0, 8)} · {r.items.length}{' '}
                                  {r.items.length === 1 ? 'insumo' : 'insumos'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`priority priority-${r.priority}`}
                                >
                                  {priorities[r.priority] ?? r.priority}
                                </span>
                              </TableCell>
                              <TableCell>{date(r.requiredDate)}</TableCell>
                              <TableCell>
                                <Status value={r.status} />
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  aria-label={`Abrir ${title(r)}`}
                                  onClick={() => openRequest(r.requestId)}
                                >
                                  <ArrowRight />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Empty
                        title={
                          search
                            ? 'No hay coincidencias en esta página'
                            : 'No hay solicitudes para mostrar'
                        }
                      >
                        {isProduction
                          ? 'Crea una solicitud para comenzar el proceso.'
                          : 'Las solicitudes enviadas por producción aparecerán aquí.'}
                      </Empty>
                    )}
                    <div className="list-caption">
                      <span className="muted">12 registros por página</span>
                      <div className="inline-row">
                        <Button
                          variant="outline"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                          aria-label="Página anterior"
                        >
                          <ChevronLeft />
                        </Button>
                        <span>{page}</span>
                        <Button
                          variant="outline"
                          disabled={page >= data.totalPages}
                          onClick={() => setPage((p) => p + 1)}
                          aria-label="Página siguiente"
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
