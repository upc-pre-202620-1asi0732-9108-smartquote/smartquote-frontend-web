import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const story = process.argv[2]?.toUpperCase();
if (!/^(US\d{2}|TS\d{2})$/.test(story ?? "")) {
  throw new Error("Use: npm run test:story -- US07 (or TS03)");
}
const files = readdirSync("tests/unit").filter((f) => f.endsWith(".test.js"))
  .map((f) => `tests/unit/${f}`)
  .filter((file) => new RegExp(`test\\(\"[^\"]*${story}\\b`).test(readFileSync(file, "utf8")));
const pattern = `\\b${story}\\b`;
if (!files.length) {
  throw new Error(`${story}: no client unit test registered. See backend/tests coverage; US01 belongs to the Landing Page.`);
}
const result = spawnSync(process.execPath, ["--test", "--test-name-pattern", pattern, ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
