export class ApiError extends Error {
  constructor(status, code, detail = "") {
    super(detail || code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}
export class HttpClient {
  constructor(session) {
    this.session = session;
  }
  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.session.token}`);
    headers.set("Accept", "application/json");
    if (init.body && !(init.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    let response;
    try {
      response = await fetch(`${this.session.baseUrl}/api/v1${path}`, {
        ...init,
        headers,
        redirect: "error",
        cache: "no-store",
        signal: init.signal ?? AbortSignal.timeout(180000),
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError(0, "connection");
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      const code =
        { 401: "unauthorized", 403: "forbidden", 409: "conflict" }[
          response.status
        ] || "api";
      const detail =
        [problem.detail, ...Object.values(problem.errors ?? {}).flat()]
          .filter(Boolean)
          .join(" ") ||
        problem.title ||
        "";
      throw new ApiError(response.status, code, detail);
    }
    return response.status === 204 ? undefined : response.json();
  }
}
export async function optional(promise) {
  try {
    return await promise;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
