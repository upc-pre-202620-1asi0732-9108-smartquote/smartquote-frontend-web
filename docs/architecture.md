# Architecture

The web frontend follows the backend business contexts using JavaScript entities and repository ports. Vue and PrimeVue remain in presentation and application setup.

| Context | Domain responsibility | Application service |
| --- | --- | --- |
| identity | API URL, JWT session validity and role capabilities | SessionService |
| supply-requests | Request drafts, mandatory requirements and transitions | PurchaseRequestService |
| quotation-intake | Upload validation, extracted fields and line mappings | QuotationService |
| evaluation-simulation | Weights, scenario versions, current results and eligibility | EvaluationService |
| purchase-ordering | Approval prerequisites and order details | PurchaseOrderService |

Each context separates domain, application, infrastructure and presentation. Business repository contracts live in domain. Infrastructure adapters translate HTTP operations into domain objects. Application services receive repositories through constructors and do not import HTTP clients, Vue or PrimeVue.

The composition root creates the transport, repositories and application services for the session. The web shell provides services to Vue components. Shared presentation contains translated feedback, formatting, accessible fields and styles.

Cross-context orchestration is explicit: the order service asks the evaluation service to reload the current simulation before validating approval. The request detail page coordinates panels through application services and events.

Domain checks provide early feedback and interface safeguards. The API remains authoritative for validation, roles, concurrency and storage. Simulation scores and recommendations always come from the API.

Architecture tests detect forbidden domain/application imports, direct HTTP usage in Vue, translation-key mismatches and accidental React or TypeScript application sources. Behavior tests cover stale simulations, weights, request requirements, mappings, order prerequisites and transport conflicts.

Hash routing supports deep links on static hosts. Saved simulation references are scoped to the backend and request, and can also be restored from the request URL. Server-side persistence remains the source of truth.
