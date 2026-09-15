# SmartQuote web

Procurement workspace built with Vue 3, JavaScript, PrimeVue and the Material theme. English (en_US) is the default language; Latin American Spanish (es_419) is available throughout the interface. This repository delivers the responsive web application. The native mobile application is a separate team deliverable.

Integrates with [smartquote-web-services](https://github.com/upc-pre-202620-1asi0732-9108-smartquote/smartquote-web-services), develop branch. Checked against commit e0b4d9287108cc9699f1b1ff325351c6f259429f with the real .NET 10 API and PostgreSQL 16.

## Run locally

Requirements: Node.js 22.18 or newer (24 recommended), npm and a running backend.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell use `Copy-Item .env.example .env.local`. Set VITE_API_BASE_URL to the backend root URL and open http://localhost:5173. The access screen also accepts a backend address.

An .env file supplies environment configuration. Here it only supplies the public API address. Vite embeds VITE_* values into browser assets, so they must never contain signing keys or passwords. .env.local is excluded from Git; .env.example is the shared template.

The local backend already allows `http://localhost:5173` through CORS. Follow the backend instructions for database migrations, ConnectionStrings__DefaultConnection, Jwt__Issuer, Jwt__Audience and Jwt__SigningKey. A deployed frontend requires an accessible HTTPS backend and its exact frontend origin allowed by CORS.

## Authentication and roles

The application uses the Identity and Access Management (IAM) backend context. The access screen accepts an email address and password, never a JWT or the API address. The backend issues a short-lived access token after authentication and remains the authority for every permission.

| JWT role | Available workflow |
| --- | --- |
| ProductionSpecialist | Create requests, attach documents, track states and read notifications. |
| PurchaseAnalyst | Review requests, change states, upload and verify quotations, configure criteria and compare suppliers. |
| PurchaseManager | Purchasing workflow, order approval, lookup and printing. |

For local development, configure `IdentityAccess__Bootstrap__Password` in the backend `.env` before starting Docker. The backend provisions the following accounts once, using that password:

| Account | Role |
| --- | --- |
| `production@smartquote.local` | ProductionSpecialist |
| `analyst@smartquote.local` | PurchaseAnalyst |
| `manager@smartquote.local` | PurchaseManager |

The access token remains only in browser memory. The refresh session uses an `HttpOnly` cookie issued by the backend; signing out revokes it. API address, language preference and simulation references use localStorage.

## Purchasing workflow

1. Production creates a request with items, quantities, delivery date and mandatory technical requirements.
2. Purchasing reviews the request and moves it to quotation collection.
3. Upload supplier PDFs, process them through the API, review evidence, correct extracted fields, map lines to requested items and verify quotations.
4. Move to evaluation, save criteria with weights totaling 100% and compare at least two eligible, verified quotations in the same currency.
5. A manager reviews an eligible quotation and explicitly approves the purchase order. Print it and finish the request as Ordered.

Versioned updates send expectedVersion. Conflicts require refreshing before another save. Approval rechecks the active evaluation scenario to reject superseded results.

## Domain-driven structure

```text
src/
  app/                    Composition root, routing and web shell
  identity/               Session validation and persistence
  supply-requests/        Requests, attachments, states and notifications
  quotation-intake/       PDF intake, extraction review and verification
  evaluation-simulation/  Criteria, scenario versions and comparisons
  purchase-ordering/      Approval and purchase orders
  shared/                 Domain errors, HTTP transport and shared UI
```

Business contexts separate domain, application, infrastructure and presentation. Domain entities enforce client-side invariants; application services coordinate use cases through injected repositories. HTTP adapters implement repository contracts. Vue components call application services. The backend remains authoritative for rules, persistence and permissions. See [architecture](docs/architecture.md) and [guide alignment](docs/guide-compliance.md).

## Checks

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The default browser suite checks language switching, persistence and the responsive login page. The purchasing browser test requires local bootstrapped IAM accounts:

```powershell
$env:SMARTQUOTE_API_URL = 'http://localhost:8080'
$env:SMARTQUOTE_BOOTSTRAP_PASSWORD = 'your-local-bootstrap-password'
$env:SMARTQUOTE_E2E_AUTH = '1' # Runs only the real IAM login check.
$env:SMARTQUOTE_E2E_STUB = '1' # Set AI__Provider=Stub in the backend first.
$env:SMARTQUOTE_E2E_REAL = '1'
npm run test:e2e
```

For an installed Microsoft Edge browser, optionally set PLAYWRIGHT_CHANNEL=msedge. The integration test requires `AI__Provider=Stub` and applied migrations. It is restricted to localhost and creates persistent test data. Reports and screenshots remain in ignored `.local/`. See [validation results](docs/integration-validation.md).

Build output is static dist/. `npm run preview` serves the production build locally.

## Backend limitations

- Stub extraction validates upload, processing and review, not extraction accuracy for arbitrary PDFs. Configure and validate the backend provider for real supplier documents.
- The current backend exposes no PDF download or server-side order export. Orders use browser printing.
- A superseded scenario can still return isCurrent=true. The client checks the active scenario again before approval. The backend should enforce this as well to cover concurrent requests and other clients.
- Hosting the frontend does not deploy its API or PostgreSQL.

## Collaboration

Use develop for integration, feature branches for focused changes, release branches for stabilization and hotfix branches for urgent production fixes. Merge verified releases into main and back into develop. Use conventional commits and semantic versions. Group changes by completed behavior and review the diff and checks before committing or pushing.
