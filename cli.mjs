#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { analyzeFiles, exportMarkdown } from "./src/analyzer.js";

const SUPPORTED = new Set([
  "package.json",
  "package-lock.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json"
]);

const args = process.argv.slice(2);
const FORMATS = new Set(["table", "json", "markdown", "md"]);
let format = "table";
const targets = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--format") {
    format = args[index + 1] || "table";
    index += 1;
  } else if (!arg.startsWith("--")) {
    targets.push(arg);
  }
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (!FORMATS.has(format)) {
  console.error(`Unsupported format "${format}". Use table, json, or markdown.`);
  process.exit(1);
}

let files = [];
try {
  files = await collectFiles(targets.length ? targets : [process.cwd()]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const report = analyzeFiles(files);

if (format === "json") {
  console.log(JSON.stringify(report, null, 2));
} else if (format === "markdown" || format === "md") {
  console.log(exportMarkdown(report));
} else {
  printTable(report);
}

async function collectFiles(paths) {
  const found = [];
  for (const path of paths) {
    let info;
    try {
      info = await stat(path);
    } catch {
      throw new Error(`Path not found: ${path}`);
    }
    if (info.isDirectory()) {
      await walk(path, found);
    } else if (SUPPORTED.has(basename(path))) {
      found.push({ name: basename(path), path, content: await readFile(path, "utf8") });
    } else {
      throw new Error(`Unsupported manifest file: ${path}`);
    }
  }
  return found;
}

async function walk(dir, found, depth = 0) {
  if (depth > 4 || dir.includes("node_modules") || dir.includes(".git")) return;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path, found, depth + 1);
    } else if (SUPPORTED.has(entry.name)) {
      found.push({ name: entry.name, path, content: await readFile(path, "utf8") });
    }
  }
}

function printTable(report) {
  console.log(`StackLens analyzed ${report.summary.files} file(s), ${report.summary.dependencies} dependencies, ${report.summary.riskFlags} risk flag(s).\n`);
  const rows = report.dependencies.map((dep) => [
    dep.name,
    dep.ecosystem,
    dep.scope,
    dep.version || "-",
    dep.category,
    dep.flags.join(", ") || "-"
  ]);
  const headers = ["Name", "Eco", "Scope", "Version", "Category", "Flags"];
  const widths = headers.map((head, index) => Math.max(head.length, ...rows.map((row) => row[index].length)));
  console.log(formatRow(headers, widths));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(formatRow(row, widths));
  console.log("\nRecommendations:");
  for (const item of report.recommendations) console.log(`- ${item}`);
}

function formatRow(row, widths) {
  return row.map((cell, index) => cell.padEnd(widths[index])).join("  ");
}

function basename(path) {
  return String(path).split(/[\\/]/).pop();
}

function printHelp() {
  console.log(`StackLens

Usage:
  stacklens [path ...] [--format table|json|markdown]

Examples:
  npm run analyze -- .
  node cli.mjs ./package.json --format markdown
  node cli.mjs ../my-project --format json
`);
}
