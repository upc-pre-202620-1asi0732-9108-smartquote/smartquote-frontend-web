export class HttpPurchasingMetricsRepository {
  constructor(http) {
    this.http = http;
  }

  get(from, to, signal) {
    const query = new URLSearchParams({ from, to });
    return this.http.request(`/purchasing-metrics?${query}`, { signal });
  }
}
