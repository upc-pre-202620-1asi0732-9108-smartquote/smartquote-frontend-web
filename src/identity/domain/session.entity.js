import { DomainError } from "../../shared/domain/domain-error.js";
export function normalizeBaseUrl(value) {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash)
    throw new DomainError("invalidUrl");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    throw new DomainError("invalidUrl");
  return url
    .toString()
    .replace(/\/+$/, "")
    .replace(/\/api\/v1$/, "");
}
export class Session {
  constructor(baseUrl, rawToken) {
    try {
      this.baseUrl = normalizeBaseUrl(baseUrl);
      this.token = rawToken.trim().replace(/^Bearer\s+/i, "");
      const segment = this.token.split(".")[1];
      const claims = JSON.parse(
        atob(segment.replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (
        typeof claims.sub !== "string" ||
        !Number.isFinite(claims.exp) ||
        claims.exp * 1000 <= Date.now()
      )
        throw new Error();
      this.userId = claims.sub;
      this.roles = Array.isArray(claims.role)
        ? claims.role
        : claims.role
          ? [claims.role]
          : [];
      this.expiresAt = claims.exp * 1000;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError("invalidSession");
    }
  }
  hasRole(role) {
    return this.roles.includes(role);
  }
  get purchasing() {
    return this.hasRole("PurchaseAnalyst") || this.hasRole("PurchaseManager");
  }
  get manager() {
    return this.hasRole("PurchaseManager");
  }
  get production() {
    return this.hasRole("ProductionSpecialist");
  }
}
