import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { analyzeFiles, exportMarkdown } from "../src/analyzer.js";

const cliPath = new URL("../cli.mjs", import.meta.url).pathname;

const report = analyzeFiles([
  {
    name: "package.json",
    content: JSON.stringify({
      dependencies: {
        react: "^19.0.0",
        express: "latest",
        eslint: "^9.0.0"
      },
      devDependencies: {
        vitest: "^3.0.0"
      }
    })
  },
  {
    name: "requirements.txt",
    content: "fastapi==0.115.0\nrequests>=2\n# ignored\n"
  },
  {
    name: "go.mod",
    content: "module example\n\nrequire (\n  github.com/gin-gonic/gin v1.10.0\n)\n"
  },
  {
    name: "pom.xml",
    content: "<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId><version>3.3.0</version></dependency></dependencies></project>"
  }
]);

assert.equal(report.summary.files, 4);
assert.equal(report.summary.dependencies, 8);
assert.equal(report.summary.ecosystems.npm, 4);
assert.equal(report.summary.ecosystems.python, 2);
assert.equal(report.dependencies.find((dep) => dep.name === "react").category, "frontend");
assert.equal(report.dependencies.find((dep) => dep.name === "fastapi").category, "backend");
assert.ok(report.dependencies.find((dep) => dep.name === "express").flags.includes("latest tag"));
assert.ok(report.dependencies.find((dep) => dep.name === "eslint").flags.includes("tooling package in runtime scope"));

const markdown = exportMarkdown(report);
assert.match(markdown, /StackLens Dependency Report/);
assert.match(markdown, /express/);
assert.match(markdown, /Recommendations/);
assert.match(markdown, /Duplicate groups/);

const lockReport = analyzeFiles([
  {
    name: "package-lock.json",
    content: JSON.stringify({
      lockfileVersion: 1,
      dependencies: {
        lodash: {
          version: "4.17.21",
          dependencies: {
            uuid: { version: "9.0.1", optional: true }
          }
        },
        eslint: { version: "9.0.0", dev: true }
      }
    })
  }
]);

assert.equal(lockReport.summary.dependencies, 3);
assert.equal(lockReport.dependencies.find((dep) => dep.name === "eslint").scope, "development");
assert.equal(lockReport.dependencies.find((dep) => dep.name === "uuid").scope, "optional");

const pythonReport = analyzeFiles([
  {
    name: "requirements.txt",
    content: [
      "uvicorn[standard]==0.30.0; python_version >= '3.11'",
      "internal-lib @ https://example.com/internal-lib-1.0.0.tar.gz",
      "pytest~=8.3"
    ].join("\n")
  }
]);

assert.equal(pythonReport.dependencies.find((dep) => dep.name === "uvicorn").version, "==0.30.0");
assert.ok(pythonReport.dependencies.find((dep) => dep.name === "internal-lib").flags.includes("remote dependency"));
assert.ok(pythonReport.dependencies.find((dep) => dep.name === "pytest").flags.includes("tooling package in runtime scope"));

const tomlReport = analyzeFiles([
  {
    name: "Cargo.toml",
    content: [
      "[dependencies]",
      "serde = { version = \"1.0\", features = [\"derive\"] }",
      "local-crate = { path = \"../local-crate\" }",
      "",
      "[dev-dependencies]",
      "insta = \"1.39\""
    ].join("\n")
  }
]);

assert.equal(tomlReport.dependencies.find((dep) => dep.name === "serde").version, "1.0");
assert.equal(tomlReport.dependencies.find((dep) => dep.name === "insta").scope, "development");
assert.ok(tomlReport.dependencies.find((dep) => dep.name === "local-crate").flags.includes("local file dependency"));

const conflictReport = analyzeFiles([
  {
    name: "package.json",
    path: "packages/web/package.json",
    content: JSON.stringify({ dependencies: { react: "^18.3.1" } })
  },
  {
    name: "package.json",
    path: "packages/admin/package.json",
    content: JSON.stringify({ dependencies: { react: "^19.1.0" } })
  },
  {
    name: "pom.xml",
    path: "services/api/pom.xml",
    content: "<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId><version>3.3.0</version></dependency></dependencies></project>"
  },
  {
    name: "pom.xml",
    path: "services/worker/pom.xml",
    content: "<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId><version>3.4.0</version></dependency></dependencies></project>"
  }
]);

assert.equal(conflictReport.summary.duplicateGroups, 2);
assert.equal(conflictReport.summary.versionConflicts, 2);
assert.ok(conflictReport.dependencies.find((dep) => dep.name === "react").flags.includes("version conflict"));
assert.ok(conflictReport.dependencies.find((dep) => dep.name === "org.springframework.boot:spring-boot-starter-web").flags.includes("version conflict"));
assert.deepEqual(conflictReport.dependencies.find((dep) => dep.name === "react").sourceFiles.sort(), ["packages/admin/package.json", "packages/web/package.json"]);
assert.match(exportMarkdown(conflictReport), /Version Conflicts/);

let cliError = null;
try {
  execFileSync(process.execPath, [cliPath, "missing-manifest.json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
} catch (error) {
  cliError = error;
}
assert.equal(cliError?.status, 1);
assert.match(cliError?.stderr, /Path not found: missing-manifest\.json/);

let emptyCliError = null;
try {
  execFileSync(process.execPath, [cliPath, "."], {
    cwd: new URL("fixtures/empty", import.meta.url),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
} catch (error) {
  emptyCliError = error;
}
assert.equal(emptyCliError?.status, 1);
assert.match(emptyCliError?.stderr, /No supported manifest files found/);

console.log("analyzer tests passed");
