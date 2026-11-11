import {
  PurchaseRequest,
  RequestDraft,
} from "../domain/purchase-request.entity.js";
import { requireCondition } from "../../shared/domain/domain-error.js";
export class PurchaseRequestService {
  constructor(repository) {
    this.repository = repository;
  }
  list(status, page, signal, assignedToMe = false) {
    return this.repository.list(status, page, signal, assignedToMe);
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
  // US16: generated drafts are reviewed by their specialist before reaching purchasing.
  editDraft(request, data) {
    requireCondition(request.status === "Draft", "draftOnly");
    return this.repository.editDraft(request, new RequestDraft(data).validate());
  }
  submitDraft(request) {
    requireCondition(request.status === "Draft", "draftOnly");
    return this.repository.submitDraft(request);
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
