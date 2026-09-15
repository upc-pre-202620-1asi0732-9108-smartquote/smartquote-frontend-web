import { QuotationRepository } from "../domain/quotation.repository.js";
import { Quotation } from "../domain/quotation.entity.js";
export class HttpQuotationRepository extends QuotationRepository {
  constructor(http) {
    super();
    this.http = http;
  }
  async list(id, signal) {
    return (
      await this.http.request(`/purchase-requests/${id}/quotations`, { signal })
    ).map((dto) => new Quotation(dto));
  }
  async get(id) {
    return new Quotation(await this.http.request(`/quotations/${id}`));
  }
  async upload(id, supplier, file) {
    const body = new FormData();
    Object.entries(supplier).forEach(([key, value]) => body.set(key, value));
    body.set("file", file);
    return new Quotation(
      await this.http.request(`/purchase-requests/${id}/quotations`, {
        method: "POST",
        body,
      }),
    );
  }
  async process(id) {
    return new Quotation(
      await this.http.request(`/quotations/${id}/process`, { method: "POST" }),
    );
  }
  correct(quote, fieldId, value, reason) {
    return this.http.request(
      `/quotations/${quote.quotationId}/fields/${fieldId}`,
      {
        method: "PUT",
        body: JSON.stringify({ value, reason, expectedVersion: quote.version }),
      },
    );
  }
  confirm(quote, mappings) {
    return this.http.request(`/quotations/${quote.quotationId}/confirm`, {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: quote.version,
        lineMappings: Object.entries(mappings).map(
          ([lineId, requestedItemId]) => ({ lineId, requestedItemId }),
        ),
      }),
    });
  }
}
