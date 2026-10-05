import { HttpClient } from "../shared/infrastructure/http-client.js";
import { HttpPurchaseRequestRepository } from "../supply-requests/infrastructure/http-purchase-request.repository.js";
import { PurchaseRequestService } from "../supply-requests/application/purchase-request.service.js";
import { HttpQuotationRepository } from "../quotation-intake/infrastructure/http-quotation.repository.js";
import { QuotationService } from "../quotation-intake/application/quotation.service.js";
import { HttpEvaluationRepository } from "../evaluation-simulation/infrastructure/http-evaluation.repository.js";
import { EvaluationService } from "../evaluation-simulation/application/evaluation.service.js";
import { HttpPurchaseOrderRepository } from "../purchase-ordering/infrastructure/http-purchase-order.repository.js";
import { PurchaseOrderService } from "../purchase-ordering/application/purchase-order.service.js";
import { HttpPurchasingMetricsRepository } from "../purchase-ordering/infrastructure/http-purchasing-metrics.repository.js";
import { PurchasingMetricsService } from "../purchase-ordering/application/purchasing-metrics.service.js";
import { SessionService } from "../identity/application/session.service.js";
import { AuthApiRepository } from "../identity/infrastructure/auth-api.repository.js";
import { RegistrationService } from "../identity/application/registration.service.js";
import { RegistrationApprovalService } from "../identity/application/registration-approval.service.js";
import { HttpRegistrationApprovalRepository } from "../identity/infrastructure/http-registration-approval.repository.js";
export function createSessionService() {
  return new SessionService(new AuthApiRepository());
}
export function createRegistrationService() {
  return new RegistrationService(new AuthApiRepository());
}
export function createServices(session) {
  const http = new HttpClient(session);
  const evaluations = new EvaluationService(new HttpEvaluationRepository(http));
  return {
    requests: new PurchaseRequestService(
      new HttpPurchaseRequestRepository(http),
    ),
    quotations: new QuotationService(new HttpQuotationRepository(http)),
    evaluations,
    orders: new PurchaseOrderService(
      new HttpPurchaseOrderRepository(http),
      evaluations,
    ),
    metrics: new PurchasingMetricsService(new HttpPurchasingMetricsRepository(http)),
    registrations: new RegistrationApprovalService(
      new HttpRegistrationApprovalRepository(http),
    ),
  };
}
