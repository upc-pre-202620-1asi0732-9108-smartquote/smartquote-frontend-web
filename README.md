# SmartQuote web

Procurement workspace built with Vue 3, JavaScript, PrimeVue and the Material theme. English (en_US) is the default language; Latin American Spanish (es_419) is available throughout the interface. This repository delivers the responsive web application. The native mobile application is a separate team deliverable.

Integrates with `smartquote-web-services`. Deploy the frontend and backend changes together: the request view now uses the request-scoped simulation and purchase-order endpoints.

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

On a new database, the first registered account becomes the purchase manager. Subsequent accounts require manager approval. Existing local databases may already contain test accounts; their credentials are not embedded in this frontend.

The access token remains only in browser memory. The refresh session uses an `HttpOnly` cookie issued by the backend; signing out revokes it. Simulation and order history are read from the backend, not localStorage.

## Purchasing workflow

1. Production creates a request with items, quantities, delivery date and mandatory technical requirements.
2. Purchasing starts collection in one action; the API records both underlying status transitions.
3. Upload up to 20 supplier PDFs without pretyping supplier details. At most two files process concurrently. Review source evidence, confirm or correct supplier and technical fields, check suggested item mappings and verify. Two verified quotations move the request to evaluation.
4. Adjust the price/delivery slider and run a comparison; the scenario version is saved automatically. Prior runs remain available from the request history.
5. A manager reviews an eligible quotation and explicitly approves the order. The backend issues at most one order per request and records the final status. Print the order if needed.

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

### CI/CD

GitHub Actions runs lint, unit tests, the production build and the default Playwright browser suite before deployment. Tests requiring a real local backend remain opt-in; this pipeline does not run them against Azure.

| Event | Result |
| --- | --- |
| Push to a feature branch or pull request into develop/main | Validation only. |
| Push to develop | Validation, then deployment to the named Azure Static Web Apps preview environment `staging`. |
| Push to main | Validation, then deployment to the existing production site. |

Deployment uploads the exact `dist/` artifact from validation without rebuilding it. A failed check blocks publication. `ci.yml` provides shared validation; `cd-staging.yml` and `cd-production.yml` call it before deploying. Deployment uses the Azure deployment token, without GitHub OIDC or a required Azure-generated filename. The deployment action is pinned to an official revision that declares the required deployment inputs; the older `v1` tag does not declare them. Production updates from `main`, rather than `develop`.

Keep the existing repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN_AGREEABLE_BUSH_0F1889D10`. Optionally set repository variables `PRODUCTION_API_BASE_URL` and `STAGING_API_BASE_URL` under GitHub Settings > Secrets and variables > Actions > Variables. Both default to the current Azure backend; a frontend preview does not create or deploy a separate backend. Public API URLs are embedded at build time, so Azure runtime environment settings alone do not change them.

The existing GitHub secret must contain the current deployment token for this Static Web App. If the portal does not expose the deployment authorization policy, use Azure Cloud Shell (Bash) to inspect it:

```bash
frontend_resource_id=$(az staticwebapp show --name smartquote-frontend --resource-group smartquote-rg --query id --output tsv)
az rest --method get --url "https://management.azure.com${frontend_resource_id}?api-version=2024-04-01" --query properties.deploymentAuthPolicy --output tsv
```

If the result is `GitHub`, Azure requires a GitHub repository token as well to change the policy. An Azure deployment token is not a repository token. Create a short-lived GitHub personal access token from an account with access to this repository (Settings > Developer settings > Personal access tokens > Tokens (classic)); select `repo` and `workflow` for repository/workflow access. Organization restrictions or SSO may require additional authorization. Do not commit or share this temporary token, and do not replace the Azure deployment secret with it. In Cloud Shell Bash, read it without displaying it or putting its literal value in command history:

```bash
read -s -p 'Temporary GitHub repository token: ' frontend_repository_token
printf '\n'
frontend_current_config=$(az rest --method get --url "https://management.azure.com${frontend_resource_id}?api-version=2024-04-01" --output json)
frontend_policy_body=$(jq -c --arg token "$frontend_repository_token" '{properties:{deploymentAuthPolicy:"DeploymentToken",repositoryToken:$token,repositoryUrl:.properties.repositoryUrl,branch:.properties.branch,buildProperties:({appLocation:"/",apiLocation:"",outputLocation:"dist"}+(.properties.buildProperties // {})+{skipGithubActionWorkflowGeneration:true})}}' <<< "$frontend_current_config")
az rest --method patch --url "https://management.azure.com${frontend_resource_id}?api-version=2024-04-01" --headers Content-Type=application/json --body "$frontend_policy_body" --output none
unset frontend_repository_token frontend_policy_body frontend_current_config
az rest --method get --url "https://management.azure.com${frontend_resource_id}?api-version=2024-04-01" --query properties.deploymentAuthPolicy --output tsv
```

Once the policy is confirmed as `DeploymentToken`, revoke the temporary GitHub personal access token; future workflow deployments use the Azure deployment secret. If the request fails or the property remains `GitHub`, preserve the error output (without tokens) for diagnosis before retrying deployment. This repository-token requirement is described in [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/2125291/change-deployment-configuration-option-in-static-w).

The policy-change request also supplies the existing repository URL, branch and build properties required by Azure. `skipGithubActionWorkflowGeneration` prevents Azure from generating a competing workflow. Existing build settings are retained; missing locations default to the original app root, no Functions API and `dist` output.

After the first develop deployment, open Azure > smartquote-frontend > Environments and copy the `staging` URL. Add its exact origin (scheme and hostname, without a trailing slash) to the backend's allowed CORS origins alongside the existing production origin. No additional Static Web App is required.

Use develop for integration, feature branches for focused changes, release branches for stabilization and hotfix branches for urgent production fixes. Merge verified releases into main and back into develop. Use conventional commits and semantic versions. Group changes by completed behavior and review the diff and checks before committing or pushing.
