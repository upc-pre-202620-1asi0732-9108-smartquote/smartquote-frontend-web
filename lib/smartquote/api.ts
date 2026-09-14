import type {
  Criterion,
  Notification,
  Page,
  PurchaseOrder,
  PurchaseRequest,
  Quotation,
  RequestHistory,
  RequestInput,
  Scenario,
  Session,
  Simulation,
  SupplierInput,
} from './types.ts';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
export function normalizeBaseUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash)
    throw new Error(
      'La dirección de la API no debe incluir credenciales, parámetros ni fragmentos.',
    );
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
    throw new Error(
      'Utiliza HTTPS para la API, o HTTP únicamente en localhost.',
    );
  return url
    .toString()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/, '');
}
export function parseSession(baseUrl: string, rawToken: string): Session {
  const token = rawToken.trim().replace(/^Bearer\s+/i, '');
  try {
    const segment = token.split('.')[1];
    const claims = JSON.parse(
      atob(segment.replace(/-/g, '+').replace(/_/g, '/')),
    );
    if (!claims.sub || !claims.exp || claims.exp * 1000 <= Date.now())
      throw new Error();
    const role = claims.role;
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      token,
      userId: claims.sub,
      roles: Array.isArray(role) ? role : role ? [role] : [],
      expiresAt: claims.exp * 1000,
    };
  } catch {
    throw new Error(
      'Revisa la dirección y utiliza un token JWT válido que no haya vencido.',
    );
  }
}
export class SmartQuoteApi {
  session: Session;
  constructor(session: Session) {
    this.session = session;
  }
  async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.session.token}`);
    headers.set('Accept', 'application/json');
    if (init.body && !(init.body instanceof FormData))
      headers.set('Content-Type', 'application/json');
    let response: Response;
    try {
      response = await fetch(`${this.session.baseUrl}/api/v1${path}`, {
        ...init,
        headers,
        redirect: 'error',
        cache: 'no-store',
        signal: init.signal ?? AbortSignal.timeout(180_000),
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError(
        0,
        'No se pudo contactar con la API. Comprueba la dirección, que el backend esté iniciado y que CORS permita este frontend. Si la operación tardó demasiado, actualiza antes de repetirla.',
      );
    }
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as {
        detail?: string;
        title?: string;
        errors?: Record<string, string[]>;
      };
      const message =
        response.status === 401
          ? 'Tu sesión venció o el token no es válido. Vuelve a conectar.'
          : response.status === 403
            ? 'Tu cuenta no tiene permiso para realizar esta operación.'
            : response.status === 409
              ? 'Otro cambio modificó estos datos. Actualiza la solicitud y revisa los valores antes de volver a guardar.'
              : problem.detail ||
                problem.title ||
                `La API respondió con el estado ${response.status}.`;
      throw new ApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
  listRequests(status = '', page = 1, signal?: AbortSignal) {
    return this.call<Page<PurchaseRequest>>(
      `/purchase-requests?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page), pageSize: '12' })}`,
      { signal },
    );
  }
  request(id: string, signal?: AbortSignal) {
    return this.call<PurchaseRequest>(
      `/purchase-requests/${encodeURIComponent(id)}`,
      { signal },
    );
  }
  createRequest(data: RequestInput) {
    return this.call<PurchaseRequest>('/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  history(id: string, signal?: AbortSignal) {
    return this.call<RequestHistory>(`/purchase-requests/${id}/history`, {
      signal,
    });
  }
  changeStatus(request: PurchaseRequest, nextStatus: string, reason: string) {
    return this.call<void>(`/purchase-requests/${request.requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        nextStatus,
        reason,
        expectedVersion: request.version,
      }),
    });
  }
  attach(request: PurchaseRequest, file: File) {
    const body = new FormData();
    body.set('file', file);
    body.set('expectedVersion', String(request.version));
    return this.call<void>(
      `/purchase-requests/${request.requestId}/attachments`,
      { method: 'POST', body },
    );
  }
  quotes(id: string, signal?: AbortSignal) {
    return this.call<Quotation[]>(`/purchase-requests/${id}/quotations`, {
      signal,
    });
  }
  quote(id: string) {
    return this.call<Quotation>(`/quotations/${id}`);
  }
  upload(id: string, supplier: SupplierInput, file: File) {
    const body = new FormData();
    Object.entries(supplier).forEach(([key, value]) => body.set(key, value));
    body.set('file', file);
    return this.call<Quotation>(`/purchase-requests/${id}/quotations`, {
      method: 'POST',
      body,
    });
  }
  process(id: string) {
    return this.call<Quotation>(`/quotations/${id}/process`, {
      method: 'POST',
    });
  }
  correct(quote: Quotation, fieldId: string, value: string, reason: string) {
    return this.call<void>(
      `/quotations/${quote.quotationId}/fields/${fieldId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ value, reason, expectedVersion: quote.version }),
      },
    );
  }
  confirm(quote: Quotation, mappings: Record<string, string>) {
    return this.call<void>(`/quotations/${quote.quotationId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({
        expectedVersion: quote.version,
        lineMappings: Object.entries(mappings).map(
          ([lineId, requestedItemId]) => ({ lineId, requestedItemId }),
        ),
      }),
    });
  }
  scenario(id: string, signal?: AbortSignal) {
    return this.call<Scenario>(`/purchase-requests/${id}/evaluation-scenario`, {
      signal,
    });
  }
  scenarioById(id: string) {
    return this.call<Scenario>(`/evaluation-scenarios/${id}`);
  }
  saveScenario(
    requestId: string,
    criteria: Criterion[],
    current?: Scenario | null,
  ) {
    return this.call<Scenario>(
      current
        ? `/evaluation-scenarios/${current.scenarioId}/versions`
        : '/evaluation-scenarios',
      { method: 'POST', body: JSON.stringify({ requestId, criteria }) },
    );
  }
  simulate(id: string) {
    return this.call<Simulation>(`/evaluation-scenarios/${id}/simulations`, {
      method: 'POST',
    });
  }
  simulation(id: string, signal?: AbortSignal) {
    return this.call<Simulation>(`/simulations/${encodeURIComponent(id)}`, {
      signal,
    });
  }
  async currentSimulation(
    requestId: string,
    id: string,
    signal?: AbortSignal,
  ): Promise<Simulation> {
    const [run, current] = await Promise.all([
      this.simulation(id, signal),
      this.scenario(requestId, signal),
    ]);
    const origin = await this.scenarioById(run.scenarioId);
    if (origin.requestId !== requestId)
      throw new ApiError(400, 'La simulación pertenece a otra solicitud.');
    return {
      ...run,
      isCurrent:
        run.isCurrent &&
        current.scenarioId === run.scenarioId &&
        current.status === 'Active',
    };
  }
  orderByRun(id: string) {
    return this.call<PurchaseOrder>(`/simulations/${id}/purchase-order`);
  }
  approve(
    run: string,
    quote: string,
    deliveryConditions: string,
    deliveryDestination: string,
  ) {
    return this.call<PurchaseOrder>(
      `/simulations/${run}/quotations/${quote}/purchase-orders`,
      {
        method: 'POST',
        body: JSON.stringify({ deliveryConditions, deliveryDestination }),
      },
    );
  }
  notifications(signal?: AbortSignal) {
    return this.call<Notification[]>('/notifications', { signal });
  }
  readNotification(id: string) {
    return this.call<void>(`/notifications/${id}/read`, { method: 'PUT' });
  }
}
export async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
