import {
  Clarification,
  validateAssignment,
} from "../domain/request-collaboration.entity.js";
export class RequestCollaborationService {
  constructor(repository) {
    this.repository = repository;
  }
  // US22
  analysts(signal) {
    return this.repository.analysts(signal);
  }
  assign(request, analystId, reason) {
    validateAssignment(request, analystId, reason ?? "");
    return this.repository.assign(request, analystId, reason?.trim() || null);
  }
  assignmentHistory(requestId, signal) {
    return this.repository.assignmentHistory(requestId, signal);
  }
  // US15
  clarifications(requestId, signal) {
    return this.repository.clarifications(requestId, signal);
  }
  inbox(status, signal) {
    return this.repository.inbox(status, signal);
  }
  ask(request, data) {
    Clarification.validateQuestion(request, data);
    return this.repository.ask(request, {
      ...data,
      specialistId: request.requesterId,
      question: data.question.trim(),
    });
  }
  markRead(id) {
    return this.repository.markRead(id);
  }
  respond(clarification, answer) {
    Clarification.validateAnswer(answer);
    return this.repository.respond(clarification, answer.trim());
  }
  revise(clarification, request, specification, reason) {
    const current = request.items
      .find((item) => item.itemId === clarification.itemId)
      ?.requirements.find((r) => r.requirementId === clarification.requirementId);
    Clarification.validateRevision(specification, reason, current);
    return this.repository.revise(clarification, request, specification, reason.trim());
  }
  revisions(requestId, signal) {
    return this.repository.revisions(requestId, signal);
  }
}
