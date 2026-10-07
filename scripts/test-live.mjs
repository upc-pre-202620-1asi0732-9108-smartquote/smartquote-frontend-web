import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Este comando falla si faltan precondiciones; no permite un CI verde por omisión.
for (const name of ["SMARTQUOTE_API_URL", "SMARTQUOTE_BOOTSTRAP_PASSWORD", "SMARTQUOTE_E2E_AUTH", "SMARTQUOTE_E2E_REAL", "SMARTQUOTE_E2E_STUB"]) {
  if (!process.env[name]) throw new Error(`${name} is required. Use the backend tests/run-tests.ps1 harness.`);
}
if (!["localhost", "127.0.0.1"].includes(new URL(process.env.SMARTQUOTE_API_URL).hostname)) {
  throw new Error("Live fixture-writing tests require a local isolated API.");
}
const result = readFileSync(".local/integration-result.json", "utf8");
process.env.SMARTQUOTE_E2E_REQUEST_ID = JSON.parse(result).requestId;
process.env.SMARTQUOTE_E2E_READONLY = "1";
process.env.VITE_API_BASE_URL = process.env.SMARTQUOTE_API_URL;
const args = ["node_modules/@playwright/test/cli.js", "test", "tests/e2e/workflow.spec.js", "--grep", "@live"];
const child = spawnSync(process.execPath, args, { encoding: "utf8" });
process.stdout.write(child.stdout ?? "");
process.stderr.write(child.stderr ?? "");
if (child.status !== 0 || /\bskipped\b/i.test(child.stdout ?? "") || !/3 passed/.test(child.stdout ?? "")) process.exit(1);
