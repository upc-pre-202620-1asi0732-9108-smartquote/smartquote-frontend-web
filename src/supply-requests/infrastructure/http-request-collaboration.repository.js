import { Clarification } from "../domain/request-collaboration.entity.js";
import { toPurchaseRequest } from "./purchase-request.mapper.js";
export class HttpRequestCollaborationRepository {
  constructor(http) {
    this.http = http;
  }
  analysts(signal) {
    return this.http.request(
      "/iam/users?" +
        new URLSearchParams({
          role: "PurchaseAnalyst",
          status: "Active",
          page: "1",
          pageSize: "100",
        }),
      { signal },
    );
  }
  async assign(request, analystId, reason) {
    return toPurchaseRequest(
      await this.http.request(`/purchase-requests/${request.requestId}/assignment`, {
        method: "PUT",
        body: JSON.stringify({ analystId, reason, expectedVersion: request.version }),
      }),
    );
  }
  assignmentHistory(requestId, signal) {
    return this.http.request(`/purchase-requests/${requestId}/assignment-history`, {
      signal,
    });
  }
  async clarifications(requestId, signal) {
    return (
      await this.http.request(
        `/purchase-requests/${requestId}/clarifications?page=1&pageSize=100`,
        { signal },
      )
    ).map((dto) => new Clarification(dto));
  }
  async inbox(status = "", signal) {
    return (
      await this.http.request(
        "/technical-clarifications?" +
          new URLSearchParams({
            assignedToMe: "true",
            ...(status ? { status } : {}),
            page: "1",
            pageSize: "100",
          }),
        { signal },
      )
    ).map((dto) => new Clarification(dto));
  }
  async ask(request, { itemId, requirementId, specialistId, question }) {
    return new Clarification(
      await this.http.request(`/purchase-requests/${request.requestId}/clarifications`, {
        method: "POST",
        body: JSON.stringify({
          itemId,
          requirementId,
          specialistId,
          question,
          expectedVersion: request.version,
        }),
      }),
    );
  }
  markRead(id) {
    return this.http.request(`/technical-clarifications/${id}/read`, { method: "PUT" });
  }
  async respond(clarification, answer) {
    return new Clarification(
      await this.http.request(`/technical-clarifications/${clarification.id}/response`, {
        method: "POST",
        body: JSON.stringify({ answer, expectedVersion: clarification.version }),
      }),
    );
  }
  revise(clarification, request, specification, reason) {
    return this.http.request(
      `/technical-clarifications/${clarification.id}/requirement-revisions`,
      {
        method: "POST",
        body: JSON.stringify({
          specification,
          reason,
          expectedClarificationVersion: clarification.version,
          expectedRequestVersion: request.version,
        }),
      },
    );
  }
  revisions(requestId, signal) {
    return this.http.request(`/purchase-requests/${requestId}/requirement-revisions`, {
      signal,
    });
  }
}
