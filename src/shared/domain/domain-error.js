export class DomainError extends Error {
  constructor(code) {
    super(code);
    this.name = "DomainError";
    this.code = code;
  }
}
export function requireCondition(condition, code) {
  if (!condition) throw new DomainError(code);
}
