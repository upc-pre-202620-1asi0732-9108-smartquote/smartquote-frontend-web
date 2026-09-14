export type Session = {
  baseUrl: string;
  token: string;
  userId: string;
  roles: string[];
  expiresAt: number;
};
export type RequirementInput = {
  name: string;
  operator: string;
  expectedValue: string;
  unitOfMeasure: string;
  isMandatory: boolean;
};
export type ItemInput = {
  description: string;
  quantity: number;
  unitOfMeasure: string;
  requirements: RequirementInput[];
};
export type RequestInput = {
  requiredDate: string;
  priority: string;
  items: ItemInput[];
};
export type Requirement = RequirementInput & { requirementId: string };
export type Item = Omit<ItemInput, 'requirements'> & {
  itemId: string;
  lineNumber: number;
  requirements: Requirement[];
};
export type PurchaseRequest = Omit<RequestInput, 'items'> & {
  requestId: string;
  requesterId: string;
  status: string;
  nextResponsibleArea: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: Item[];
  attachments: {
    attachmentId: string;
    fileName: string;
    contentType: string;
    uploadedAt: string;
  }[];
};
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
export type RequestHistory = {
  requestId: string;
  entries: {
    fromStatus: string;
    toStatus: string;
    changedBy: string;
    changedAt: string;
    reason: string;
  }[];
};
export type ExtractedField = {
  fieldId: string;
  fieldPath: string;
  originalValue: string | null;
  currentValue: string | null;
  isRequired: boolean;
  confidence: number;
  sourcePageNumber: number;
  sourceTextReference: string;
  status: string;
  corrections: {
    previousValue: string;
    correctedValue: string;
    correctedBy: string;
    correctedAt: string;
    reason: string;
  }[];
};
export type QuoteLine = {
  lineId: string;
  requestedItemId: string | null;
  lineNumber: number;
  description: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  unitPrice: number | null;
  specifications: { name: string; value: string; unitOfMeasure: string }[];
};
export type Quotation = {
  quotationId: string;
  requestId: string;
  supplierId: string;
  supplierBusinessName: string;
  supplierTaxIdentifier: string;
  fileName: string;
  validUntil: string | null;
  currency: string | null;
  deliveryLeadTimeDays: number | null;
  status: string;
  version: number;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  lines: QuoteLine[];
  fields: ExtractedField[];
};
export type SupplierInput = {
  supplierId: string;
  supplierBusinessName: string;
  supplierTaxIdentifier: string;
};
export type Criterion = {
  criterionId?: string;
  name: string;
  targetField: string;
  category: string;
  mode: string;
  operator: string;
  expectedValue: string;
  unitOfMeasure: string;
  weight: number;
  displayOrder: number;
};
export type Scenario = {
  scenarioId: string;
  requestId: string;
  version: number;
  status: string;
  criteria: Criterion[];
};
export type Simulation = {
  simulationRunId: string;
  scenarioId: string;
  criteriaVersion: number;
  inputFingerprint: string;
  executedAt: string;
  isCurrent: boolean;
  recommendation: {
    quotationId: string;
    score: number;
    explanation: string;
  } | null;
  evaluations: {
    quotationId: string;
    isEligible: boolean;
    totalScore: number;
    rank: number | null;
    criterionResults: {
      criterionId: string;
      passed: boolean;
      normalizedScore: number;
      weightedContribution: number;
      explanation: string;
    }[];
    exclusionReasons: {
      criterionId: string;
      code: string;
      explanation: string;
    }[];
  }[];
};
export type PurchaseOrder = {
  purchaseOrderId: string;
  orderNumber: string;
  simulationRunId: string;
  purchaseRequestId: string;
  quotationId: string;
  supplierBusinessName: string;
  supplierTaxIdentifier: string;
  approvedBy: string;
  approvedAt: string;
  status: string;
  currency: string;
  deliveryLeadTimeDays: number;
  deliveryConditions: string;
  deliveryDestination: string;
  total: number;
  createdAt: string;
  lines: {
    lineId: string;
    description: string;
    quantity: number;
    unitOfMeasure: string;
    unitPrice: number;
  }[];
};
export type Notification = {
  notificationId: string;
  purchaseRequestId: string;
  newStatus: string;
  message: string;
  createdAt: string;
  readAt: string | null;
};
