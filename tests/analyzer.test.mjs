import assert from "node:assert/strict";
import { analyzeFiles, exportMarkdown } from "../src/analyzer.js";

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

console.log("analyzer tests passed");
