const ECOSYSTEMS = {
  "package.json": "npm",
  "package-lock.json": "npm",
  "requirements.txt": "python",
  "pyproject.toml": "python",
  "Pipfile": "python",
  "Cargo.toml": "rust",
  "go.mod": "go",
  "Gemfile": "ruby",
  "pom.xml": "maven",
  "build.gradle": "gradle",
  "build.gradle.kts": "gradle",
  "composer.json": "php"
};

const KNOWN = {
  react: ["UI framework for building component-driven interfaces.", "frontend"],
  "react-dom": ["React renderer for the browser DOM.", "frontend"],
  next: ["Full-stack React framework for routing, rendering, and deployment.", "framework"],
  vite: ["Fast frontend dev server and production bundler.", "build"],
  webpack: ["JavaScript module bundler and asset pipeline.", "build"],
  typescript: ["Typed JavaScript language tooling and compiler.", "build"],
  eslint: ["Static analysis and linting for JavaScript and TypeScript.", "quality"],
  prettier: ["Opinionated code formatter.", "quality"],
  express: ["Minimal Node.js HTTP server framework.", "backend"],
  fastify: ["Low-overhead Node.js web framework.", "backend"],
  lodash: ["Utility helpers for arrays, objects, strings, and functions.", "utility"],
  axios: ["Promise-based HTTP client.", "network"],
  zod: ["Runtime schema validation and TypeScript inference.", "validation"],
  prisma: ["Database ORM, schema tooling, and migrations.", "database"],
  mongoose: ["MongoDB object modeling for Node.js.", "database"],
  jest: ["JavaScript testing framework.", "testing"],
  vitest: ["Vite-native JavaScript and TypeScript test runner.", "testing"],
  playwright: ["Browser automation and end-to-end testing toolkit.", "testing"],
  tailwindcss: ["Utility-first CSS framework.", "styling"],
  "@tailwindcss/vite": ["Tailwind CSS integration for Vite projects.", "styling"],
  "lucide-react": ["Icon component library for React.", "frontend"],
  clsx: ["Conditional className string composition utility.", "utility"],
  "@vitejs/plugin-react": ["React transform plugin for Vite.", "build"],
  django: ["Python web framework with ORM, templates, and admin tools.", "backend"],
  flask: ["Lightweight Python web framework.", "backend"],
  fastapi: ["Python API framework with validation and OpenAPI support.", "backend"],
  requests: ["Python HTTP client for web requests.", "network"],
  pytest: ["Python testing framework.", "testing"],
  numpy: ["Numerical computing package for arrays and linear algebra.", "data"],
  pandas: ["Data analysis library for tabular datasets.", "data"],
  serde: ["Rust serialization and deserialization framework.", "serialization"],
  tokio: ["Async runtime for Rust applications.", "runtime"],
  axum: ["Rust web framework built on Tokio and Tower.", "backend"],
  reqwest: ["Rust HTTP client.", "network"],
  gin: ["HTTP web framework for Go.", "backend"],
  rails: ["Ruby web application framework.", "backend"],
  spring_boot: ["Spring Boot application framework dependency.", "backend"]
};

const CATEGORY_RULES = [
  ["testing", /(^|[-_@/])(test|testing|jest|vitest|pytest|mocha|chai|playwright|cypress|rspec)([-_@/]|$)/i],
  ["quality", /(^|[-_@/])(eslint|lint|prettier|ruff|black|checkstyle)([-_@/]|$)/i],
  ["build", /(^|[-_@/])(vite|webpack|rollup|babel|swc|esbuild|tsup|compiler|loader|plugin)([-_@/]|$)/i],
  ["frontend", /(^|[-_@/])(react|vue|svelte|angular|solid|dom|ui|icons?)([-_@/]|$)/i],
  ["styling", /(^|[-_@/])(css|sass|less|tailwind|postcss|style)([-_@/]|$)/i],
  ["backend", /(^|[-_@/])(server|express|fastify|django|flask|rails|spring|axum|gin)([-_@/]|$)/i],
  ["database", /(^|[-_@/])(sql|sqlite|postgres|mysql|mongo|redis|prisma|typeorm|sequelize|db)([-_@/]|$)/i],
  ["network", /(^|[-_@/])(http|fetch|request|axios|reqwest|grpc|socket)([-_@/]|$)/i],
  ["security", /(^|[-_@/])(auth|jwt|crypto|bcrypt|passport|oauth|secure)([-_@/]|$)/i],
  ["data", /(^|[-_@/])(data|numpy|pandas|arrow|spark|plot|chart)([-_@/]|$)/i],
  ["utility", /(^|[-_@/])(util|utils|helper|lodash|date|time|uuid|clsx)([-_@/]|$)/i]
];

const RISKY_RANGES = [
  ["latest tag", /\blatest\b/i],
  ["wildcard version", /(^|\s|[<>=~^])[*xX](\.|$)/],
  ["unpinned version", /^(~=|!=|>=|>|<=|<)/],
  ["local file dependency", /^(file:|link:|workspace:)/],
  ["remote dependency", /^(git\+|https?:\/\/|ssh:)/]
];

const KEY_SEP = "\u0000";

export function analyzeFiles(files) {
  const normalized = files
    .map((file) => ({ name: basename(file.name || file.path || ""), path: file.path || file.name || "", content: String(file.content || "") }))
    .filter((file) => file.name && file.content.trim());

  const dependencies = [];
  const warnings = [];
  for (const file of normalized) {
    try {
      dependencies.push(...parseFile(file));
    } catch (error) {
      warnings.push(`${file.path || file.name}: ${error.message}`);
    }
  }

  const duplicateSummary = inspectDuplicates(dependencies);
  warnings.push(...duplicateSummary.warnings);

  const deduped = dedupe(dependencies).map((dep) => enrichDependency(dep, duplicateSummary.conflictKeys));
  const categories = countBy(deduped, "category");
  const ecosystems = countBy(deduped, "ecosystem");
  const scopes = countBy(deduped, "scope");
  const riskCount = deduped.reduce((sum, dep) => sum + dep.flags.length, 0);
  const directCount = deduped.filter((dep) => dep.direct).length;

  return {
    generatedAt: new Date().toISOString(),
    files: normalized.map((file) => ({ name: file.name, path: file.path, ecosystem: ecosystemFor(file.name) || "unknown" })),
    dependencies: deduped,
    summary: {
      files: normalized.length,
      dependencies: deduped.length,
      directDependencies: directCount,
      ecosystems,
      categories,
      scopes,
      riskFlags: riskCount,
      duplicateGroups: duplicateSummary.duplicateGroups,
      versionConflicts: duplicateSummary.conflicts.length
    },
    conflicts: duplicateSummary.conflicts,
    warnings,
    recommendations: buildRecommendations(deduped, warnings)
  };
}

export function parseFile(file) {
  const ecosystem = ecosystemFor(file.name);
  if (!ecosystem) return [];
  if (file.name === "package.json") return parsePackageJson(file);
  if (file.name === "package-lock.json") return parsePackageLock(file);
  if (file.name === "composer.json") return parseComposer(file);
  if (file.name === "requirements.txt") return parseRequirements(file);
  if (file.name === "pyproject.toml") return parsePyproject(file);
  if (file.name === "Pipfile") return parsePipfile(file);
  if (file.name === "Cargo.toml") return parseCargo(file);
  if (file.name === "go.mod") return parseGoMod(file);
  if (file.name === "Gemfile") return parseGemfile(file);
  if (file.name === "pom.xml") return parsePom(file);
  if (file.name === "build.gradle" || file.name === "build.gradle.kts") return parseGradle(file);
  return [];
}

export function exportMarkdown(report) {
  const lines = [
    `# StackLens Dependency Report`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `## Summary`,
    "",
    `- Files analyzed: ${report.summary.files}`,
    `- Dependencies: ${report.summary.dependencies}`,
    `- Direct dependencies: ${report.summary.directDependencies}`,
    `- Risk flags: ${report.summary.riskFlags}`,
    `- Duplicate groups: ${report.summary.duplicateGroups || 0}`,
    `- Version conflicts: ${report.summary.versionConflicts || 0}`,
    "",
    `## Dependencies`,
    "",
    `| Name | Ecosystem | Scope | Version | Category | Sources | Explanation | Flags |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |`
  ];

  for (const dep of report.dependencies) {
    lines.push(`| ${escapePipe(dep.name)} | ${dep.ecosystem} | ${dep.scope} | ${escapePipe(dep.version || "")} | ${dep.category} | ${escapePipe((dep.sourceFiles || [dep.sourceFile]).join(", "))} | ${escapePipe(dep.explanation)} | ${escapePipe(dep.flags.join(", "))} |`);
  }

  if (report.conflicts?.length) {
    lines.push("", "## Version Conflicts", "");
    for (const conflict of report.conflicts) {
      lines.push(`- ${conflict.ecosystem}:${conflict.name} (${conflict.scope}) has ${conflict.versions.length} versions: ${conflict.versions.map((item) => `${item.version || "unspecified"} from ${item.sources.join(", ")}`).join("; ")}`);
    }
  }

  if (report.recommendations.length) {
    lines.push("", "## Recommendations", "");
    for (const item of report.recommendations) lines.push(`- ${item}`);
  }

  if (report.warnings.length) {
    lines.push("", "## Parser Warnings", "");
    for (const item of report.warnings) lines.push(`- ${item}`);
  }

  return `${lines.join("\n")}\n`;
}

function parsePackageJson(file) {
  const json = JSON.parse(file.content);
  const fields = [
    ["dependencies", "runtime", true],
    ["devDependencies", "development", true],
    ["peerDependencies", "peer", true],
    ["optionalDependencies", "optional", true],
    ["bundledDependencies", "bundled", true],
    ["bundleDependencies", "bundled", true]
  ];
  const deps = [];
  for (const [field, scope, direct] of fields) {
    const value = json[field];
    if (Array.isArray(value)) {
      for (const name of value) deps.push(makeDep({ name, scope, ecosystem: "npm", sourceFile: sourcePath(file), direct }));
    } else if (value && typeof value === "object") {
      for (const [name, version] of Object.entries(value)) deps.push(makeDep({ name, version, scope, ecosystem: "npm", sourceFile: sourcePath(file), direct }));
    }
  }
  return deps;
}

function parsePackageLock(file) {
  const json = JSON.parse(file.content);
  const deps = [];

  if (json.packages && typeof json.packages === "object") {
    for (const [path, meta] of Object.entries(json.packages)) {
      if (!path.startsWith("node_modules/")) continue;
      const name = packageNameFromNodeModulesPath(path);
      if (!name) continue;
      deps.push(makeDep({
        name,
        version: meta.version || "",
        scope: meta.dev ? "development" : meta.optional ? "optional" : "locked",
        ecosystem: "npm",
        sourceFile: sourcePath(file),
        direct: false
      }));
    }
  } else if (json.dependencies && typeof json.dependencies === "object") {
    walkLockDependencies(json.dependencies, deps, sourcePath(file));
  }
  return deps;
}

function parseComposer(file) {
  const json = JSON.parse(file.content);
  const deps = [];
  for (const [field, scope] of [["require", "runtime"], ["require-dev", "development"]]) {
    const value = json[field] || {};
    for (const [name, version] of Object.entries(value)) {
      if (name === "php") continue;
      deps.push(makeDep({ name, version, scope, ecosystem: "php", sourceFile: sourcePath(file), direct: true }));
    }
  }
  return deps;
}

function parseRequirements(file) {
  return file.content
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => pythonSpecToDep(line, "runtime", sourcePath(file)))
    .filter(Boolean);
}

function parsePyproject(file) {
  const deps = [];
  const projectBlock = findNamedBlock(file.content, "project");
  const projectDeps = findArray(projectBlock?.body || file.content, "dependencies");
  for (const entry of projectDeps) deps.push(pythonSpecToDep(entry, "runtime", sourcePath(file)));

  const optionalBlock = findNamedBlock(file.content, "project.optional-dependencies");
  if (optionalBlock) {
    for (const group of findTomlArrayAssignments(optionalBlock.body)) {
      for (const entry of group.values) deps.push(pythonSpecToDep(entry, group.key, sourcePath(file)));
    }
  }

  for (const block of findTomlBlocks(file.content, "project.optional-dependencies.")) {
    const scope = block.name.replace("project.optional-dependencies.", "") || "optional";
    for (const entry of findArraysInBlock(block.body)) deps.push(pythonSpecToDep(entry, scope, sourcePath(file)));
  }

  const poetryBlock = findNamedBlock(file.content, "tool.poetry.dependencies");
  if (poetryBlock) {
    for (const dep of parseTomlAssignments(poetryBlock.body, "runtime", "python", sourcePath(file))) deps.push(dep);
  }
  const poetryDevBlock = findNamedBlock(file.content, "tool.poetry.group.dev.dependencies") || findNamedBlock(file.content, "tool.poetry.dev-dependencies");
  if (poetryDevBlock) {
    for (const dep of parseTomlAssignments(poetryDevBlock.body, "development", "python", sourcePath(file))) deps.push(dep);
  }
  return deps.filter(Boolean);
}

function parsePipfile(file) {
  const deps = [];
  for (const section of [["packages", "runtime"], ["dev-packages", "development"]]) {
    const block = findNamedBlock(file.content, section[0]);
    if (block) deps.push(...parseTomlAssignments(block.body, section[1], "python", sourcePath(file)));
  }
  return deps;
}

function parseCargo(file) {
  const deps = [];
  for (const [section, scope] of [["dependencies", "runtime"], ["dev-dependencies", "development"], ["build-dependencies", "build"]]) {
    const block = findNamedBlock(file.content, section);
    if (block) deps.push(...parseTomlAssignments(block.body, scope, "rust", sourcePath(file)));
  }
  return deps;
}

function parseGoMod(file) {
  const deps = [];
  const requireBlock = file.content.match(/require\s*\(([\s\S]*?)\)/);
  if (requireBlock) {
    for (const line of requireBlock[1].split(/\r?\n/)) {
      const clean = line.replace(/\/\/.*$/, "").trim();
      const [name, version] = clean.split(/\s+/);
      if (name && version) deps.push(makeDep({ name, version, scope: "runtime", ecosystem: "go", sourceFile: sourcePath(file), direct: true }));
    }
  }
  for (const match of file.content.matchAll(/^require\s+([^\s(]+)\s+(\S+)/gm)) {
    deps.push(makeDep({ name: match[1], version: match[2], scope: "runtime", ecosystem: "go", sourceFile: sourcePath(file), direct: true }));
  }
  return deps;
}

function parseGemfile(file) {
  const deps = [];
  for (const match of file.content.matchAll(/^\s*gem\s+["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?/gm)) {
    deps.push(makeDep({ name: match[1], version: match[2] || "", scope: "runtime", ecosystem: "ruby", sourceFile: sourcePath(file), direct: true }));
  }
  return deps;
}

function parsePom(file) {
  const deps = [];
  for (const match of file.content.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const body = match[1];
    const group = tag(body, "groupId");
    const artifact = tag(body, "artifactId");
    if (!artifact) continue;
    deps.push(makeDep({
      name: group ? `${group}:${artifact}` : artifact,
      version: tag(body, "version"),
      scope: tag(body, "scope") || "runtime",
      ecosystem: "maven",
      sourceFile: sourcePath(file),
      direct: true
    }));
  }
  return deps;
}

function parseGradle(file) {
  const deps = [];
  const pattern = /^\s*(implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly)\s*\(?\s*["']([^"']+)["']/gm;
  for (const match of file.content.matchAll(pattern)) {
    const parts = match[2].split(":");
    const version = parts.length > 2 ? parts.pop() : "";
    const name = parts.join(":");
    deps.push(makeDep({
      name,
      version,
      scope: match[1].toLowerCase().includes("test") ? "development" : "runtime",
      ecosystem: "gradle",
      sourceFile: sourcePath(file),
      direct: true
    }));
  }
  return deps;
}

function makeDep({ name, version = "", scope, ecosystem, sourceFile, direct }) {
  return { name: String(name).trim(), version: String(version || "").trim(), scope, ecosystem, sourceFile, direct: Boolean(direct) };
}

function enrichDependency(dep, conflictKeys = new Set()) {
  const key = dep.name.toLowerCase();
  const shortKey = key.split("/").pop().replace(/[-.]/g, "_");
  const known = KNOWN[key] || KNOWN[shortKey];
  const category = known?.[1] || inferCategory(dep.name);
  const explanation = known?.[0] || explainByName(dep.name, category, dep.ecosystem);
  const flags = flagsFor(dep);
  if (conflictKeys.has(dependencyKey(dep))) flags.push("version conflict");
  return {
    ...dep,
    category,
    explanation,
    flags,
    confidence: known ? "known package" : "name heuristic"
  };
}

function explainByName(name, category, ecosystem) {
  const readable = name.split(/[/:@_-]/).filter(Boolean).slice(-2).join(" ");
  const label = readable ? `${readable}` : name;
  const templates = {
    testing: `Likely provides test tooling or test helpers for the ${ecosystem} project.`,
    quality: `Likely enforces code style, lint rules, or static checks.`,
    build: `Likely participates in compiling, bundling, or project build automation.`,
    frontend: `Likely supports browser UI, components, rendering, or client-side behavior.`,
    styling: `Likely handles CSS, styling transforms, or design-system utilities.`,
    backend: `Likely supports server routes, API behavior, or backend application structure.`,
    database: `Likely connects to, models, or migrates application data stores.`,
    network: `Likely handles HTTP, RPC, sockets, or other network communication.`,
    security: `Likely supports authentication, authorization, cryptography, or secure credentials.`,
    data: `Likely supports data processing, analysis, visualization, or numeric work.`,
    utility: `Likely provides general-purpose helpers used across the codebase.`,
    unknown: `No known profile yet; inspect where "${label}" is imported before upgrading or removing it.`
  };
  return templates[category] || templates.unknown;
}

function flagsFor(dep) {
  const flags = [];
  for (const [label, pattern] of RISKY_RANGES) {
    if (pattern.test(dep.version)) flags.push(label);
  }
  if (!dep.version && dep.ecosystem !== "npm") flags.push("missing version");
  if (dep.scope === "runtime" && ["testing", "quality", "build"].includes(inferCategory(dep.name))) {
    flags.push("tooling package in runtime scope");
  }
  return flags;
}

function buildRecommendations(deps, warnings) {
  const recommendations = [];
  if (deps.some((dep) => dep.flags.includes("wildcard version") || dep.flags.includes("latest tag"))) {
    recommendations.push("Replace wildcard or latest ranges with explicit version ranges before release.");
  }
  if (deps.some((dep) => dep.flags.includes("remote dependency"))) {
    recommendations.push("Review remote dependencies because they can bypass normal registry provenance controls.");
  }
  if (deps.some((dep) => dep.flags.includes("tooling package in runtime scope"))) {
    recommendations.push("Move build, lint, and test packages out of runtime dependency groups when possible.");
  }
  if (deps.length > 50) {
    recommendations.push("Audit high-cardinality dependency groups and remove packages that duplicate the same role.");
  }
  if (warnings.length) {
    recommendations.push("Fix parser warnings so the report covers every manifest completely.");
  }
  if (deps.some((dep) => dep.flags.includes("version conflict"))) {
    recommendations.push("Resolve conflicting versions before upgrading or pruning dependencies.");
  }
  if (!recommendations.length) {
    recommendations.push("No urgent dependency hygiene issues found from manifest metadata.");
  }
  return recommendations;
}

function inferCategory(name) {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(name)) return category;
  }
  return "unknown";
}

function ecosystemFor(name) {
  return ECOSYSTEMS[basename(name)] || null;
}

function basename(path) {
  return String(path).split(/[\\/]/).pop();
}

function dedupe(dependencies) {
  const map = new Map();
  for (const dep of dependencies.filter((item) => item.name)) {
    const key = dependencyKey(dep);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, withAggregateMetadata(dep));
    } else {
      const merged = mergeAggregateMetadata(existing, dep);
      if (!existing.direct && dep.direct) {
        map.set(key, mergeAggregateMetadata({ ...dep }, merged));
      } else {
        map.set(key, merged);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name));
}

function sourcePath(file) {
  return file.path || file.name;
}

function dependencyKey(dep) {
  return [dep.ecosystem, canonicalName(dep), dep.scope].join(KEY_SEP);
}

function canonicalName(dep) {
  if (dep.ecosystem === "python") {
    return dep.name.toLowerCase().replace(/[-_.]+/g, "-");
  }
  if (["npm", "php", "ruby"].includes(dep.ecosystem)) {
    return dep.name.toLowerCase();
  }
  return dep.name;
}

function withAggregateMetadata(dep) {
  return {
    ...dep,
    sourceFiles: dep.sourceFile ? [dep.sourceFile] : [],
    versions: dep.version ? [dep.version] : []
  };
}

function mergeAggregateMetadata(base, dep) {
  const sourceFiles = unique([...(base.sourceFiles || []), base.sourceFile, ...(dep.sourceFiles || []), dep.sourceFile].filter(Boolean));
  const versions = unique([...(base.versions || []), base.version, ...(dep.versions || []), dep.version].filter(Boolean));
  return { ...base, sourceFiles, versions };
}

function inspectDuplicates(dependencies) {
  const groups = new Map();
  for (const dep of dependencies.filter((item) => item.name)) {
    const key = dependencyKey(dep);
    const list = groups.get(key) || [];
    list.push(dep);
    groups.set(key, list);
  }

  const warnings = [];
  const conflicts = [];
  const conflictKeys = new Set();
  let duplicateGroups = 0;

  for (const [key, group] of groups.entries()) {
    if (group.length < 2) continue;
    duplicateGroups += 1;
    const byVersion = new Map();
    for (const dep of group) {
      const version = dep.version || "";
      const sources = byVersion.get(version) || [];
      sources.push(dep.sourceFile);
      byVersion.set(version, sources);
    }
    if (byVersion.size > 1) {
      const [ecosystem, name, scope] = key.split(KEY_SEP);
      const versions = [...byVersion.entries()].map(([version, sources]) => ({ version, sources: unique(sources) }));
      conflicts.push({ ecosystem, name, scope, versions });
      conflictKeys.add(key);
      warnings.push(`Version conflict for ${ecosystem}:${name} (${scope}): ${versions.map((item) => `${item.version || "unspecified"} from ${item.sources.join(", ")}`).join("; ")}.`);
    }
  }

  return { duplicateGroups, conflicts, conflictKeys, warnings };
}

function unique(values) {
  return [...new Set(values)];
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
}

function tag(xml, name) {
  return xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim() || "";
}

function findNamedBlock(content, name) {
  const pattern = /^\s*\[([^\]]+)\]\s*$/gm;
  const matches = [...content.matchAll(pattern)];
  for (let index = 0; index < matches.length; index += 1) {
    if (matches[index][1] !== name) continue;
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? content.length;
    return { name, body: content.slice(start, end) };
  }
  return null;
}

function findTomlBlocks(content, prefix) {
  const blocks = [];
  const pattern = /^\s*\[([^\]]+)\]\s*$/gm;
  const matches = [...content.matchAll(pattern)];
  for (let index = 0; index < matches.length; index += 1) {
    const name = matches[index][1];
    if (!name.startsWith(prefix)) continue;
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? content.length;
    blocks.push({ name, body: content.slice(start, end) });
  }
  return blocks;
}

function findArray(content, key) {
  return findTomlArrayAssignments(content).find((assignment) => assignment.key === key)?.values || [];
}

function findArraysInBlock(block) {
  return findTomlArrayAssignments(block).flatMap((assignment) => assignment.values);
}

function findTomlArrayAssignments(content) {
  const assignments = [];
  const pattern = /^\s*([A-Za-z0-9_.-]+)\s*=\s*\[/gm;
  for (const match of content.matchAll(pattern)) {
    const start = content.indexOf("[", match.index);
    const end = findTomlArrayEnd(content, start);
    if (end === -1) continue;
    assignments.push({ key: match[1], values: parseQuotedArray(content.slice(start + 1, end)) });
  }
  return assignments;
}

function findTomlArrayEnd(content, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function parseQuotedArray(body) {
  const values = [];
  let quote = "";
  let escaped = false;
  let value = "";

  for (const char of body) {
    if (!quote) {
      if (char === "\"" || char === "'") {
        quote = char;
        value = "";
      }
      continue;
    }
    if (escaped) {
      value += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === quote) {
      values.push(value);
      quote = "";
    } else {
      value += char;
    }
  }

  return values;
}

function pythonSpecToDep(spec, scope, sourceFile) {
  const withoutMarker = spec.split(";")[0].trim();
  const directUrl = withoutMarker.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s+@\s+(.+)$/);
  if (directUrl) {
    return makeDep({ name: directUrl[1], version: directUrl[2].trim(), scope, ecosystem: "python", sourceFile, direct: true });
  }

  const match = withoutMarker.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(.*)$/);
  if (!match) return null;
  return makeDep({ name: match[1], version: match[2].trim(), scope, ecosystem: "python", sourceFile, direct: true });
}

function parseTomlAssignments(body, scope, ecosystem, sourceFile) {
  const deps = [];
  for (const line of body.split(/\r?\n/)) {
    const clean = line.replace(/\s+#.*$/, "").trim();
    if (!clean || clean.startsWith("[") || !clean.includes("=")) continue;
    const [rawName, ...rest] = clean.split("=");
    const name = rawName.trim().replace(/^["']|["']$/g, "");
    if (["python", "ruby", "node"].includes(name.toLowerCase())) continue;
    const version = normalizeTomlVersion(rest.join("=").trim());
    deps.push(makeDep({ name, version, scope, ecosystem, sourceFile, direct: true }));
  }
  return deps;
}

function walkLockDependencies(tree, deps, sourceFile) {
  for (const [name, meta] of Object.entries(tree)) {
    deps.push(makeDep({
      name,
      version: meta.version || "",
      scope: meta.dev ? "development" : meta.optional ? "optional" : "locked",
      ecosystem: "npm",
      sourceFile,
      direct: false
    }));
    if (meta.dependencies && typeof meta.dependencies === "object") {
      walkLockDependencies(meta.dependencies, deps, sourceFile);
    }
  }
}

function packageNameFromNodeModulesPath(path) {
  const parts = path.split("/");
  const index = parts.lastIndexOf("node_modules");
  if (index === -1 || !parts[index + 1]) return "";
  if (parts[index + 1].startsWith("@") && parts[index + 2]) {
    return `${parts[index + 1]}/${parts[index + 2]}`;
  }
  return parts[index + 1];
}

function normalizeTomlVersion(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    const version = trimmed.match(/\bversion\s*=\s*["']([^"']+)["']/);
    const git = trimmed.match(/\bgit\s*=\s*["']([^"']+)["']/);
    const path = trimmed.match(/\bpath\s*=\s*["']([^"']+)["']/);
    return version?.[1] || git?.[1] || (path ? `file:${path[1]}` : trimmed);
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function escapePipe(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}
