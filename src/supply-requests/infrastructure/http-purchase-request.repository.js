import { PurchaseRequestRepository } from "../domain/purchase-request.repository.js";
import { toPurchaseRequest, toRequestPage } from "./purchase-request.mapper.js";
export class HttpPurchaseRequestRepository extends PurchaseRequestRepository {
  constructor(http) {
    super();
    this.http = http;
  }
  async list(status = "", page = 1, signal) {
    return toRequestPage(
      await this.http.request(
        "/purchase-requests?" +
          new URLSearchParams({
            ...(status ? { status } : {}),
            page: String(page),
            pageSize: "12",
          }),
        { signal },
      ),
    );
  }
  async get(id, signal) {
    return toPurchaseRequest(
      await this.http.request("/purchase-requests/" + encodeURIComponent(id), {
        signal,
      }),
    );
  }
  async create(payload) {
    return toPurchaseRequest(
      await this.http.request("/purchase-requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  }
  history(id, signal) {
    return this.http.request(`/purchase-requests/${id}/history`, { signal });
  }
  changeStatus(request, nextStatus, reason) {
    return this.http.request(`/purchase-requests/${request.requestId}/status`, {
      method: "PUT",
      body: JSON.stringify({
        nextStatus,
        reason,
        expectedVersion: request.version,
      }),
    });
  }
  attach(request, file) {
    const body = new FormData();
    body.set("file", file);
    body.set("expectedVersion", String(request.version));
    return this.http.request(
      `/purchase-requests/${request.requestId}/attachments`,
      { method: "POST", body },
    );
  }
  notifications(signal) {
    return this.http.request("/notifications", { signal });
  }
  readNotification(id) {
    return this.http.request(`/notifications/${id}/read`, { method: "PUT" });
  }
}
