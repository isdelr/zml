#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CONVEX_DIR = path.join(ROOT, "convex");
const OUTPUT_FILE = path.join(ROOT, "docs", "convex-refactor-baseline.md");
const FRONTEND_DIRS = ["app", "components", "hooks", "lib"];

const FUNCTION_EXPORT_RE =
  /export const (\w+)\s*=\s*(query|mutation|action|internalQuery|internalMutation|internalAction|httpAction)\s*\(/g;
const API_USAGE_RE = /\bapi\.(\w+)\.(\w+)\b/g;

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await listFiles(full)));
      continue;
    }
    output.push(full);
  }
  return output;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function findLineMatches(text, pattern) {
  const lines = text.split("\n");
  const matches = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) {
      matches.push(i + 1);
    }
    pattern.lastIndex = 0;
  }
  return matches;
}

async function gatherConvexFunctions() {
  const files = (await listFiles(CONVEX_DIR))
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !file.includes(`${path.sep}_generated${path.sep}`));

  const functions = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    let match;
    while ((match = FUNCTION_EXPORT_RE.exec(text)) !== null) {
      const [, fnName, kind] = match;
      functions.push({
        file: relative(file),
        module: path.basename(file, ".ts"),
        name: fnName,
        kind,
        line: lineNumberFromIndex(text, match.index),
      });
    }
    FUNCTION_EXPORT_RE.lastIndex = 0;
  }

  return functions.sort((a, b) => {
    const aKey = `${a.module}.${a.name}`;
    const bKey = `${b.module}.${b.name}`;
    return aKey.localeCompare(bKey);
  });
}

async function gatherFrontendApiUsages() {
  const allFiles = [];
  for (const dir of FRONTEND_DIRS) {
    const target = path.join(ROOT, dir);
    try {
      allFiles.push(
        ...(await listFiles(target)).filter(
          (file) =>
            file.endsWith(".ts") ||
            file.endsWith(".tsx") ||
            file.endsWith(".js") ||
            file.endsWith(".jsx"),
        ),
      );
    } catch {
      // Ignore missing dirs.
    }
  }

  const usages = [];
  for (const file of allFiles) {
    const text = await fs.readFile(file, "utf8");
    let match;
    while ((match = API_USAGE_RE.exec(text)) !== null) {
      const [, module, fn] = match;
      usages.push({
        file: relative(file),
        module,
        fn,
        line: lineNumberFromIndex(text, match.index),
      });
    }
    API_USAGE_RE.lastIndex = 0;
  }

  return usages.sort((a, b) => {
    const aKey = `${a.module}.${a.fn}`;
    const bKey = `${b.module}.${b.fn}`;
    if (aKey === bKey) return a.file.localeCompare(b.file);
    return aKey.localeCompare(bKey);
  });
}

async function gatherUnsafePatterns() {
  const targets = [
    ...(await listFiles(path.join(ROOT, "convex")).catch(() => [])),
    ...(await listFiles(path.join(ROOT, "app")).catch(() => [])),
    ...(await listFiles(path.join(ROOT, "components")).catch(() => [])),
    ...(await listFiles(path.join(ROOT, "hooks")).catch(() => [])),
    ...(await listFiles(path.join(ROOT, "lib")).catch(() => [])),
  ].filter(
    (file) =>
      (file.endsWith(".ts") || file.endsWith(".tsx")) &&
      !file.includes(`${path.sep}_generated${path.sep}`),
  );

  const checks = [
    { label: "as never", pattern: /\bas never\b/ },
    { label: "as any", pattern: /\bas any\b/ },
    { label: "as unknown as", pattern: /\bas unknown as\b/ },
    { label: "v.any(", pattern: /v\.any\(/ },
  ];

  const findings = [];
  for (const file of targets) {
    const text = await fs.readFile(file, "utf8");
    for (const check of checks) {
      const lines = findLineMatches(text, check.pattern);
      if (lines.length === 0) continue;
      for (const line of lines) {
        findings.push({
          file: relative(file),
          line,
          kind: check.label,
        });
      }
    }
  }

  return findings.sort((a, b) => {
    const aKey = `${a.kind}|${a.file}|${a.line}`;
    const bKey = `${b.kind}|${b.file}|${b.line}`;
    return aKey.localeCompare(bKey);
  });
}

function countBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function uniqueApiKeys(usages) {
  return [...new Set(usages.map((u) => `${u.module}.${u.fn}`))].sort((a, b) => a.localeCompare(b));
}

function getMissingApiRefs(usages, functions) {
  const backendKeys = new Set(
    functions
      .filter((f) => !f.kind.startsWith("internal"))
      .map((f) => `${f.module}.${f.name}`),
  );
  return uniqueApiKeys(usages).filter((key) => !backendKeys.has(key));
}

async function writeReport() {
  const [functions, usages, unsafePatterns] = await Promise.all([
    gatherConvexFunctions(),
    gatherFrontendApiUsages(),
    gatherUnsafePatterns(),
  ]);

  const publicFunctions = functions.filter((f) => !f.kind.startsWith("internal"));
  const internalFunctions = functions.filter((f) => f.kind.startsWith("internal"));
  const usageCounts = countBy(usages, (u) => `${u.module}.${u.fn}`);
  const missingApiRefs = getMissingApiRefs(usages, functions);
  const kindCounts = countBy(functions, (f) => f.kind);
  const unsafeCounts = countBy(unsafePatterns, (f) => f.kind);
  const generatedAt = new Date().toISOString();

  const lines = [
    "# Convex Refactor Baseline",
    "",
    `Generated: ${generatedAt}`,
    "",
    "## Summary",
    `- Convex exported functions: ${functions.length}`,
    `- Convex public functions: ${publicFunctions.length}`,
    `- Convex internal functions: ${internalFunctions.length}`,
    `- Unique frontend API references: ${usageCounts.length}`,
    `- Total frontend API usage sites: ${usages.length}`,
    `- Potential missing frontend refs (not found in public exports): ${missingApiRefs.length}`,
    `- Unsafe pattern findings: ${unsafePatterns.length}`,
    "",
    "## Function Kinds",
  ];

  for (const [kind, count] of kindCounts) {
    lines.push(`- ${kind}: ${count}`);
  }

  lines.push("", "## Top Frontend API References");
  for (const [key, count] of usageCounts.slice(0, 40)) {
    lines.push(`- ${key}: ${count}`);
  }

  lines.push("", "## Potential Missing Frontend API References");
  if (missingApiRefs.length === 0) {
    lines.push("- none");
  } else {
    for (const key of missingApiRefs) {
      lines.push(`- ${key}`);
    }
  }

  lines.push("", "## Unsafe Patterns");
  if (unsafePatterns.length === 0) {
    lines.push("- none");
  } else {
    for (const [kind, count] of unsafeCounts) {
      lines.push(`- ${kind}: ${count}`);
    }
  }

  lines.push("", "## Unsafe Pattern Locations");
  if (unsafePatterns.length === 0) {
    lines.push("- none");
  } else {
    for (const finding of unsafePatterns.slice(0, 200)) {
      lines.push(`- ${finding.kind}: ${finding.file}:${finding.line}`);
    }
  }

  lines.push("", "## Public Convex Exports");
  for (const fn of publicFunctions) {
    lines.push(`- ${fn.module}.${fn.name} (${fn.kind}) - ${fn.file}:${fn.line}`);
  }

  lines.push("", "## Frontend API Usage Sites");
  for (const usage of usages) {
    lines.push(`- ${usage.module}.${usage.fn} - ${usage.file}:${usage.line}`);
  }

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
}

await writeReport();
console.log(`Wrote ${relative(OUTPUT_FILE)}`);
