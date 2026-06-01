![StackLens banner](./assets/banner.png)

# StackLens

StackLens turns dependency manifests into a readable dependency map. Drop in the files you already have, and it explains package roles, groups dependencies by ecosystem and category, highlights risky version declarations, and exports reports for pull requests or audits.

## Features

- Browser app that runs locally with no accounts, registry calls, or telemetry.
- Drag-and-drop analysis for `package.json`, `package-lock.json`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `Cargo.toml`, `go.mod`, `Gemfile`, `pom.xml`, Gradle files, and `composer.json`.
- Dependency explanations using known-package profiles plus transparent name heuristics.
- Category, ecosystem, search, and risk filters.
- Risk flags for wildcard ranges, `latest`, remote dependencies, local file links, unpinned ranges, and tooling packages in runtime scope.
- Markdown and JSON export from the UI.
- Zero-dependency Node CLI for terminal and CI use.
- MIT licensed and easy to fork.

## Quick Start

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173), then drop manifest files into the app or press **Load sample**.

## CLI

```bash
node cli.mjs ./path/to/project
node cli.mjs ./package.json --format markdown
node cli.mjs ./path/to/project --format json
node cli.mjs ./examples/demo
```

When installed globally or linked locally:

```bash
stacklens . --format table
```

## How It Works

StackLens parses common manifest formats locally, normalizes each dependency into a shared model, and enriches it with:

- ecosystem and scope
- inferred category
- short explanation
- confidence source
- dependency hygiene flags

It does not claim to be a full vulnerability scanner. It is designed to make dependency intent and hygiene review faster before deeper security, license, or provenance checks.

## Supported Files

| Ecosystem | Files |
| --- | --- |
| npm | `package.json`, `package-lock.json` |
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile` |
| Rust | `Cargo.toml` |
| Go | `go.mod` |
| Ruby | `Gemfile` |
| JVM | `pom.xml`, `build.gradle`, `build.gradle.kts` |
| PHP | `composer.json` |

## Development

```bash
npm test
npm start
```

The app is intentionally dependency-free. The browser UI imports the same analyzer module used by the CLI and tests.

## Roadmap

- SPDX license detection from lockfiles.
- Registry metadata adapters behind an explicit opt-in network mode.
- SBOM export.
- Import graph overlays from source files.

## License

MIT
