import {
  PurchaseRequest,
  RequestDraft,
} from "../domain/purchase-request.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";
export class PurchaseRequestService {
  constructor(repository) {
    this.repository = repository;
  }
  list(status, page, signal) {
    return this.repository.list(status, page, signal);
  }
  get(id, signal) {
    return this.repository.get(id, signal);
  }
  history(id, signal) {
    return this.repository.history(id, signal);
  }
  create(data) {
    return this.repository.create(new RequestDraft(data).validate());
  }
  changeStatus(request, status, reason) {
    new PurchaseRequest(request).assertTransition(status, reason);
    return this.repository.changeStatus(request, status, reason);
  }
  attach(request, file) {
    requireCondition(
      file.size > 0 && file.size <= 10 * 1024 * 1024,
      "attachmentSize",
    );
    return this.repository.attach(request, file);
  }
  notifications(signal) {
    return this.repository.notifications(signal);
  }
  readNotification(id) {
    return this.repository.readNotification(id);
  }
}
