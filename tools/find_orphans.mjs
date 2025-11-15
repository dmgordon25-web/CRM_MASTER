#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const graphPath = path.join(repoRoot, "docs", "generated", "import_graph.json");
const manifestModuleId = "crm-app/js/boot/manifest.js";
const routerModuleId = "crm-app/js/router/init.js";
const manifestBaseDir = "crm-app/js";

function normalizePath(input) {
  if (!input) return null;
  const replaced = input.replace(/\\/g, "/");
  return path.posix.normalize(replaced.startsWith("./") ? replaced.slice(2) : replaced);
}

function ensureEntry(adjacency, moduleId) {
  if (!moduleId) return;
  if (!adjacency.has(moduleId)) {
    adjacency.set(moduleId, new Set());
  }
}

function addEdge(adjacency, fromModule, toModule) {
  if (!fromModule || !toModule) return;
  ensureEntry(adjacency, fromModule);
  ensureEntry(adjacency, toModule);
  adjacency.get(fromModule).add(toModule);
}

function resolveImport(fromModule, spec) {
  if (typeof spec !== "string" || !spec) return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return null;
  }
  if (trimmed.startsWith("crm-app/")) {
    return normalizePath(trimmed);
  }
  if (trimmed.startsWith("/")) {
    return normalizePath(trimmed.replace(/^\/+/, ""));
  }
  if (trimmed.startsWith("./") || trimmed.startsWith("../")) {
    const baseDir = fromModule === manifestModuleId
      ? manifestBaseDir
      : path.posix.dirname(fromModule);
    return normalizePath(path.posix.join(baseDir, trimmed));
  }
  return normalizePath(trimmed);
}

async function listJsFiles(rootDir) {
  const results = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err && err.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        const rel = normalizePath(path.relative(repoRoot, fullPath));
        results.push(rel);
      }
    }
  }
  await walk(rootDir);
  return results;
}

async function augmentWithManifestEntries(adjacency) {
  const manifestFilePath = path.join(repoRoot, "crm-app", "js", "boot", "manifest.js");
  const manifestSource = await fs.readFile(manifestFilePath, "utf8");
  const inlineSpecs = new Set();
  const manifestRegex = /['"](\.?\.?\/[^'"\n]+\.js)['"]/g;
  let match;
  while ((match = manifestRegex.exec(manifestSource))) {
    inlineSpecs.add(match[1]);
  }
  for (const spec of inlineSpecs) {
    const resolved = resolveImport(manifestModuleId, spec);
    if (resolved) {
      addEdge(adjacency, manifestModuleId, resolved);
    }
  }

  const patchManifestPath = path.join(repoRoot, "crm-app", "patches", "manifest.json");
  try {
    const patchRaw = await fs.readFile(patchManifestPath, "utf8");
    const patchJson = JSON.parse(patchRaw);
    const patchList = Array.isArray(patchJson?.patches)
      ? patchJson.patches
      : (Array.isArray(patchJson) ? patchJson : []);
    for (const spec of patchList) {
      if (typeof spec !== "string") continue;
      const trimmed = spec.trim();
      if (!trimmed) continue;
      const resolved = resolveImport(manifestModuleId, trimmed);
      if (resolved) {
        addEdge(adjacency, manifestModuleId, resolved);
      }
    }
  } catch (err) {
    console.warn("[find_orphans] Failed to read patches manifest:", err);
  }
}

async function augmentWithPostPaintModules(adjacency) {
  const indexPath = path.join(repoRoot, "crm-app", "index.html");
  const html = await fs.readFile(indexPath, "utf8");
  const re = /['"](\.\/js\/[^'"\n]+\.js)['"]/g;
  const specs = new Set();
  let match;
  while ((match = re.exec(html))) {
    specs.add(match[1]);
  }
  for (const spec of specs) {
    const withoutPrefix = spec.replace(/^\.\//, "");
    const normalized = normalizePath(path.posix.join("crm-app", withoutPrefix));
    addEdge(adjacency, routerModuleId, normalized);
  }
}

async function augmentWithSourceImports(adjacency, modules) {
  const staticImportRegex = /import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;
  const dynamicImportRegex = /import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
  for (const moduleId of modules) {
    const fullPath = path.join(repoRoot, moduleId);
    let source;
    try {
      source = await fs.readFile(fullPath, "utf8");
    } catch (err) {
      console.warn(`[find_orphans] Failed to read ${moduleId}:`, err);
      continue;
    }
    let match;
    staticImportRegex.lastIndex = 0;
    while ((match = staticImportRegex.exec(source))) {
      const spec = match[1];
      const resolved = resolveImport(moduleId, spec);
      if (resolved) {
        addEdge(adjacency, moduleId, resolved);
      }
    }
    dynamicImportRegex.lastIndex = 0;
    while ((match = dynamicImportRegex.exec(source))) {
      const spec = match[1];
      const resolved = resolveImport(moduleId, spec);
      if (resolved) {
        addEdge(adjacency, moduleId, resolved);
      }
    }
  }
}

async function main() {
  const dataRaw = await fs.readFile(graphPath, "utf8");
  const importGraph = JSON.parse(dataRaw);
  const adjacency = new Map();

  for (const [rawModule, deps] of Object.entries(importGraph)) {
    const moduleId = normalizePath(rawModule);
    ensureEntry(adjacency, moduleId);
    for (const dep of deps || []) {
      const resolved = resolveImport(moduleId, dep);
      if (resolved) {
        addEdge(adjacency, moduleId, resolved);
      }
    }
  }

  await augmentWithManifestEntries(adjacency);
  await augmentWithPostPaintModules(adjacency);

  const jsDir = path.join(repoRoot, "crm-app", "js");
  const jsFiles = await listJsFiles(jsDir);
  const jsFileSet = new Set(jsFiles);
  for (const file of jsFiles) {
    ensureEntry(adjacency, file);
  }

  await augmentWithSourceImports(adjacency, jsFiles);

  const roots = [
    "crm-app/js/app.js",
    "crm-app/js/boot/loader.js",
    "crm-app/js/boot/early_trap.js",
    "crm-app/js/router/init.js",
    "crm-app/js/boot/boot_hardener.js",
    "crm-app/js/boot/manifest.js"
  ];

  const reachable = new Set();
  const queue = [...roots];
  while (queue.length) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (!reachable.has(next)) {
        queue.push(next);
      }
    }
  }

  const modules = [];
  for (const [moduleId, deps] of adjacency.entries()) {
    if (!moduleId.startsWith("crm-app/js/")) continue;
    if (!jsFileSet.has(moduleId)) continue;
    const classification = roots.includes(moduleId)
      ? "entry"
      : (reachable.has(moduleId) ? "core" : "unused");
    modules.push({
      file: moduleId,
      reachable: reachable.has(moduleId),
      classification,
      directImports: Array.from(deps).sort()
    });
  }

  const quarantineDir = path.join(repoRoot, "QUARANTINE", "crm-app", "js");
  const quarantineFiles = await listJsFiles(quarantineDir);
  for (const file of quarantineFiles) {
    modules.push({
      file,
      reachable: false,
      classification: "quarantined",
      directImports: []
    });
  }

  modules.sort((a, b) => a.file.localeCompare(b.file));

  const report = {
    generatedAt: new Date().toISOString(),
    roots,
    summary: {
      total: modules.length,
      reachable: modules.filter((m) => m.reachable).length,
      unused: modules.filter((m) => m.classification === "unused").length,
      quarantined: modules.filter((m) => m.classification === "quarantined").length
    },
    modules
  };

  const reportsDir = path.join(repoRoot, "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  const outputPath = path.join(reportsDir, "orphans.json");
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

