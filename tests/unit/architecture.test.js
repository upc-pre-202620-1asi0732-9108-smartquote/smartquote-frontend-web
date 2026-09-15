import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import messages from "../../src/shared/presentation/i18n/messages.js";
const root = resolve("src");
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(resolve(path, entry.name))
      : [resolve(path, entry.name)],
  );
}
test("domain and application remain independent from Vue and HTTP infrastructure", () => {
  for (const file of walk(root).filter((f) => f.endsWith(".js"))) {
    const layer = relative(root, file).replaceAll("\\", "/");
    for (const match of readFileSync(file, "utf8").matchAll(
      /(?:from\s+|import\s*)['"]([^'"]+)['"]/g,
    )) {
      const dependency = match[1],
        target = dependency.startsWith(".")
          ? relative(root, resolve(dirname(file), dependency)).replaceAll(
              "\\",
              "/",
            )
          : dependency;
      if (layer.includes("/domain/"))
        assert.ok(
          !/\/application\/|\/infrastructure\/|\/presentation\/|^vue|^primevue/.test(
            target,
          ),
          layer + " imports " + target,
        );
      if (layer.includes("/application/"))
        assert.ok(
          !/\/infrastructure\/|\/presentation\/|^vue|^primevue/.test(target),
          layer + " imports " + target,
        );
    }
  }
});
test("presentation uses application services rather than direct HTTP calls", () => {
  for (const file of walk(root).filter((f) => f.endsWith(".vue"))) {
    const code = readFileSync(file, "utf8");
    assert.doesNotMatch(code, /from\s+['"][^'"]*infrastructure\//);
    assert.doesNotMatch(code, /\bfetch\s*\(|\baxios\./);
  }
});
test("English and Latin American Spanish provide matching translation keys", () => {
  const keys = (obj, prefix = "") =>
    Object.entries(obj)
      .flatMap(([key, value]) =>
        typeof value === "object"
          ? keys(value, prefix + key + ".")
          : [prefix + key],
      )
      .sort();
  assert.deepEqual(keys(messages.en_US), keys(messages.es_419));
  const lookup = (key) =>
    key.split(".").reduce((value, part) => value?.[part], messages.en_US);
  for (const file of walk(root).filter((f) => f.endsWith(".vue"))) {
    for (const match of readFileSync(file, "utf8").matchAll(
      /\bt\(['"]([^'"]+)['"]\)/g,
    ))
      assert.equal(
        typeof lookup(match[1]),
        "string",
        "Missing translation: " + match[1],
      );
  }
});
test("application sources contain Vue and JavaScript, with no React or TypeScript files", () => {
  assert.equal(
    walk(root).some((file) => /\.(tsx?|jsx)$/.test(file)),
    false,
  );
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.ok(pkg.dependencies.vue && pkg.dependencies.primevue);
  assert.ok(!pkg.dependencies.react && !pkg.devDependencies.typescript);
});
