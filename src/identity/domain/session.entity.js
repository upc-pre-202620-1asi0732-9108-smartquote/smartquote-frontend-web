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
  constructor(baseUrl, rawToken, user, expiresIn) {
    try {
      this.baseUrl = normalizeBaseUrl(baseUrl);
      this.token = rawToken.trim().replace(/^Bearer\s+/i, "");
      if (
        !this.token ||
        !user ||
        typeof user.userId !== "string" ||
        !Array.isArray(user.roles) ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
      )
        throw new Error();
      this.userId = user.userId;
      this.displayName = user.displayName || user.email || user.userId;
      this.email = user.email || "";
      this.roles = user.roles;
      this.expiresAt = Date.now() + expiresIn * 1000;
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
