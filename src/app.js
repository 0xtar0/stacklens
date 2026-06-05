import { analyzeFiles, exportMarkdown } from "./analyzer.js";
import { SAMPLE_FILES } from "./sample-files.js";

const state = {
  report: analyzeFiles([]),
  query: "",
  category: "",
  ecosystem: "",
  riskOnly: false,
  view: "cards"
};

const elements = {
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  browseButton: document.querySelector("#browseButton"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  dependencyCount: document.querySelector("#dependencyCount"),
  ecosystemCount: document.querySelector("#ecosystemCount"),
  riskCount: document.querySelector("#riskCount"),
  fileCount: document.querySelector("#fileCount"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  ecosystemFilter: document.querySelector("#ecosystemFilter"),
  riskOnly: document.querySelector("#riskOnly"),
  recommendations: document.querySelector("#recommendations"),
  warningSection: document.querySelector("#warningSection"),
  warnings: document.querySelector("#warnings"),
  resultCaption: document.querySelector("#resultCaption"),
  cardsView: document.querySelector("#cardsView"),
  tableView: document.querySelector("#tableView"),
  dependencyTable: document.querySelector("#dependencyTable"),
  copyMarkdown: document.querySelector("#copyMarkdown"),
  downloadJson: document.querySelector("#downloadJson")
};

elements.browseButton.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", async (event) => {
  await loadFiles([...event.target.files]);
  elements.fileInput.value = "";
});

elements.sampleButton.addEventListener("click", () => {
  state.report = analyzeFiles(SAMPLE_FILES);
  resetFilters();
  render();
});

elements.clearButton.addEventListener("click", () => {
  state.report = analyzeFiles([]);
  resetFilters();
  render();
});

elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("dragging");
});

elements.dropZone.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
elements.dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("dragging");
  await loadFiles([...event.dataTransfer.files]);
});

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderResults();
});

elements.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  renderResults();
});

elements.ecosystemFilter.addEventListener("change", (event) => {
  state.ecosystem = event.target.value;
  renderResults();
});

elements.riskOnly.addEventListener("change", (event) => {
  state.riskOnly = event.target.checked;
  renderResults();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach((tab) => tab.classList.toggle("active", tab === button));
    elements.cardsView.classList.toggle("hidden", state.view !== "cards");
    elements.tableView.classList.toggle("hidden", state.view !== "table");
  });
});

elements.copyMarkdown.addEventListener("click", async () => {
  await navigator.clipboard.writeText(exportMarkdown(state.report));
  elements.copyMarkdown.textContent = "Copied";
  setTimeout(() => {
    elements.copyMarkdown.textContent = "Copy report";
  }, 1200);
});

elements.downloadJson.addEventListener("click", () => {
  download("stacklens-report.json", JSON.stringify(state.report, null, 2), "application/json");
});

async function loadFiles(files) {
  const loaded = await Promise.all(files.map(async (file) => ({
    name: file.name,
    path: file.webkitRelativePath || file.name,
    content: await file.text()
  })));
  state.report = analyzeFiles(loaded);
  resetFilters();
  render();
}

function resetFilters() {
  state.query = "";
  state.category = "";
  state.ecosystem = "";
  state.riskOnly = false;
  elements.searchInput.value = "";
  elements.riskOnly.checked = false;
}

function render() {
  const { summary } = state.report;
  elements.dependencyCount.textContent = summary.dependencies;
  elements.ecosystemCount.textContent = Object.keys(summary.ecosystems).length;
  elements.riskCount.textContent = summary.riskFlags;
  elements.fileCount.textContent = summary.files;
  fillSelect(elements.categoryFilter, "All categories", Object.keys(summary.categories));
  fillSelect(elements.ecosystemFilter, "All ecosystems", Object.keys(summary.ecosystems));
  elements.recommendations.innerHTML = state.report.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  elements.warningSection.classList.toggle("hidden", !state.report.warnings.length);
  elements.warnings.innerHTML = state.report.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  renderResults();
}

function renderResults() {
  const deps = filteredDependencies();
  elements.resultCaption.textContent = state.report.summary.dependencies
    ? `${deps.length} of ${state.report.summary.dependencies} dependencies shown.`
    : "Load files to start analysis.";

  if (!deps.length) {
    elements.cardsView.innerHTML = `<div class="empty-state">No dependencies match the current filters.</div>`;
    elements.dependencyTable.innerHTML = `<tr><td colspan="6">No dependencies match the current filters.</td></tr>`;
    return;
  }

  elements.cardsView.innerHTML = deps.map((dep) => `
    <article class="dependency-card category-${escapeHtml(dep.category)}">
      <div class="card-top">
        <div>
          <h3>${escapeHtml(dep.name)}</h3>
          <div class="version">${escapeHtml(dep.version || "No version specified")}</div>
        </div>
        <span class="badge">${escapeHtml(dep.category)}</span>
      </div>
      <p class="explanation">${escapeHtml(dep.explanation)}</p>
      <div class="chips">
        <span class="chip">${escapeHtml(dep.ecosystem)}</span>
        <span class="chip">${escapeHtml(dep.scope)}</span>
        <span class="chip">${escapeHtml(dep.confidence)}</span>
        <span class="chip">${escapeHtml(sourceLabel(dep))}</span>
        ${dep.flags.map((flag) => `<span class="chip flag">${escapeHtml(flag)}</span>`).join("")}
      </div>
    </article>
  `).join("");

  elements.dependencyTable.innerHTML = deps.map((dep) => `
    <tr>
      <td><strong>${escapeHtml(dep.name)}</strong><br><small>${escapeHtml(dep.explanation)}</small></td>
      <td>${escapeHtml(dep.version || "-")}</td>
      <td>${escapeHtml(dep.scope)}</td>
      <td>${escapeHtml(dep.category)}</td>
      <td>${escapeHtml(dep.flags.join(", ") || "-")}</td>
      <td>${escapeHtml((dep.sourceFiles || [dep.sourceFile]).join(", "))}</td>
    </tr>
  `).join("");
}

function filteredDependencies() {
  return state.report.dependencies.filter((dep) => {
    const haystack = `${dep.name} ${dep.version} ${dep.scope} ${dep.ecosystem} ${dep.category} ${dep.explanation}`.toLowerCase();
    return (!state.query || haystack.includes(state.query))
      && (!state.category || dep.category === state.category)
      && (!state.ecosystem || dep.ecosystem === state.ecosystem)
      && (!state.riskOnly || dep.flags.length);
  });
}

function fillSelect(select, label, values) {
  const selected = select.value;
  select.innerHTML = `<option value="">${label}</option>${values.sort().map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  select.value = values.includes(selected) ? selected : "";
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sourceLabel(dep) {
  const count = (dep.sourceFiles || [dep.sourceFile]).filter(Boolean).length;
  return count === 1 ? "1 source" : `${count} sources`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

render();
