export const SAMPLE_FILES = [
  {
    name: "package.json",
    content: JSON.stringify({
      dependencies: {
        "@tailwindcss/vite": "^4.1.8",
        axios: "^1.9.0",
        express: "^5.1.0",
        react: "^19.1.0",
        "react-dom": "^19.1.0",
        zod: "^3.25.36"
      },
      devDependencies: {
        eslint: "^9.28.0",
        playwright: "^1.52.0",
        typescript: "^5.8.3",
        vite: "latest",
        vitest: "^3.1.4"
      }
    }, null, 2)
  },
  {
    name: "requirements.txt",
    content: ["fastapi==0.115.12", "pandas>=2.2", "pytest==8.3.5", "requests>=2"].join("\n")
  },
  {
    name: "Cargo.toml",
    content: ["[dependencies]", "serde = \"1.0\"", "tokio = { version = \"1\", features = [\"full\"] }", "reqwest = \"0.12\"", "", "[dev-dependencies]", "insta = \"1\""].join("\n")
  }
];
