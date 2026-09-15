import { ApiError } from "../../shared/infrastructure/http-client.js";
import { normalizeBaseUrl } from "../domain/session.entity.js";

export class AuthApiRepository {
  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080") {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  login(email, password) {
    return this.request("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  refresh() {
    return this.request("/refresh", { method: "POST" });
  }

  async logout() {
    try {
      await this.request("/logout", { method: "POST" });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }

  async request(path, init) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/iam/auth${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        credentials: "include",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ApiError(0, "connection");
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        response.status === 401 ? "invalidCredentials" : "api",
        problem.detail || problem.title || "",
      );
    }
    return response.status === 204 ? undefined : response.json();
  }
}
