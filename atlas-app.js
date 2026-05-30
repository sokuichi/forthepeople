"use strict";

const API_ANALYZE_URL = "/api/analyze";
const API_SOURCES_URL = "/api/sources/status";
const DEFAULT_SOURCE_COUNT = 28;
const CACHE_PREFIX = "atlas-bibliotheca:api-v6:";
const CACHE_TTL_MS = 1000 * 60 * 12;
const MAX_CLIENT_CACHE_ENTRIES = 6;

const state = {
  abortController: null,
  payload: null,
  activeLens: "overview",
  searchCategory: "auto",
  sourceSnapshot: [],
  lastCopyText: ""
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  refreshIcons();
  loadSourceSnapshot();
  updateDetectedIntent();
});

function bindElements() {
  elements.form = document.querySelector("#searchForm");
  elements.promptInput = document.querySelector("#promptInput");
  elements.intentPill = document.querySelector("#intentPill");
  elements.providerPill = document.querySelector("#providerPill");
  elements.answerPanel = document.querySelector("#answerPanel");
  elements.inspectorList = document.querySelector("#inspectorList");
  elements.resultGrid = document.querySelector("#resultGrid");
  elements.analyzeButton = document.querySelector("#analyzeButton");
  elements.sortSelect = document.querySelector("#sortSelect");
  elements.showOnlyCited = document.querySelector("#showOnlyCited");
  elements.copyQueryButton = document.querySelector("#copyQueryButton");
  elements.clearCacheButton = document.querySelector("#clearCacheButton");
  elements.latencyMetric = document.querySelector("#latencyMetric");
  elements.coverageMetric = document.querySelector("#coverageMetric");
  elements.sourceMetric = document.querySelector("#sourceMetric");
  elements.conflictMetric = document.querySelector("#conflictMetric");
  elements.aiMetric = document.querySelector("#aiMetric");
  elements.sourceHealth = document.querySelector("#sourceHealth");
  elements.sourceMatrix = document.querySelector("#sourceMatrix");
  elements.briefingSources = document.querySelector("#briefingSources");
  elements.briefingWorks = document.querySelector("#briefingWorks");
  elements.briefingCitations = document.querySelector("#briefingCitations");
  elements.briefingConflicts = document.querySelector("#briefingConflicts");
  elements.spotlightPanel = document.querySelector("#spotlightPanel");
  elements.graphPanel = document.querySelector("#graphPanel");
  elements.graphCaption = document.querySelector("#graphCaption");
  elements.evidencePanel = document.querySelector("#evidencePanel");
  elements.detailDrawer = document.querySelector("#detailDrawer");
  elements.detailContent = document.querySelector("#detailContent");
  elements.closeDetailButton = document.querySelector("#closeDetailButton");
  elements.lensButtons = [...document.querySelectorAll("[data-lens]")];
  elements.categoryButtons = [...document.querySelectorAll("[data-category]")].filter((button) => button.classList.contains("category-button"));
}

function bindEvents() {
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runAnalysis();
  });

  elements.promptInput.addEventListener("input", debounce(updateDetectedIntent, 140));

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.category) setSearchCategory(button.dataset.category);
      elements.promptInput.value = button.dataset.prompt || "";
      updateDetectedIntent();
      runAnalysis();
    });
  });

  elements.sortSelect.addEventListener("change", renderResults);
  elements.showOnlyCited.addEventListener("change", renderResults);
  elements.copyQueryButton.addEventListener("click", copyAnalysisPayload);
  elements.clearCacheButton.addEventListener("click", clearCache);
  elements.closeDetailButton.addEventListener("click", closeDetailDrawer);
  elements.detailDrawer.addEventListener("click", (event) => {
    if (event.target === elements.detailDrawer) closeDetailDrawer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetailDrawer();
  });

  elements.lensButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLens = button.dataset.lens || "overview";
      elements.lensButtons.forEach((lensButton) => {
        lensButton.classList.toggle("active", lensButton === button);
      });
      if (state.payload) {
        renderAnswer(state.payload, false);
      }
    });
  });

  elements.categoryButtons.forEach((button) => {
    button.addEventListener("click", () => setSearchCategory(button.dataset.category || "auto"));
  });
}

function setSearchCategory(category) {
  state.searchCategory = normalizeClientCategory(category);
  elements.categoryButtons.forEach((button) => {
    button.classList.toggle("active", normalizeClientCategory(button.dataset.category) === state.searchCategory);
  });
  updateDetectedIntent();
}

async function loadSourceSnapshot() {
  try {
    const response = await fetch(API_SOURCES_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const json = await response.json();
    state.sourceSnapshot = json.sources || [];
    renderSourceTelemetry(state.sourceSnapshot);
    renderSourceMatrix(state.sourceSnapshot);
    renderBriefing({ sources: state.sourceSnapshot, works: [], citations: [], conflicts: [] });
  } catch (error) {
    renderSourceTelemetry([]);
    renderSourceMatrix([]);
    renderBriefing({ sources: [], works: [], citations: [], conflicts: [] });
  }
}

function updateDetectedIntent() {
  const parsed = clientParsePrompt(elements.promptInput.value, state.searchCategory);
  elements.intentPill.textContent = parsed.intentLabel;
  elements.providerPill.textContent = `${categoryLabel(parsed.searchCategory || state.searchCategory)} / ${currentSourceCount()} sources`;
  renderInspector({ parsed, queryPlan: null, sources: state.sourceSnapshot, fromCache: false });
}

async function runAnalysis() {
  const prompt = elements.promptInput.value.trim();
  if (!prompt) {
    renderEmpty("Type a title, author, subject, ISBN, or book question first.");
    return;
  }

  if (state.abortController) {
    state.abortController.abort();
  }
  state.abortController = new AbortController();

  const cacheKey = makeCacheKey(`${state.searchCategory}:${prompt}`);
  const cached = readCache(cacheKey);
  if (cached) {
    state.payload = { ...cached, fromCache: true };
    renderPayload(state.payload, "cached");
    return;
  }

  setLoading(true);
  renderLoading();
  const startedAt = performance.now();

  try {
    const response = await fetch(API_ANALYZE_URL, {
      method: "POST",
      signal: state.abortController.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        prompt,
        options: {
          lens: state.activeLens,
          searchCategory: state.searchCategory,
          onlySourceBacked: true
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || payload.detail || "Analysis failed.");
    }

    const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
    state.payload = payload;
    writeCache(cacheKey, payload);
    renderPayload(payload, `${elapsed} ms`);
  } catch (error) {
    if (error.name !== "AbortError") {
      renderError(error);
    }
  } finally {
    setLoading(false);
  }
}

function renderPayload(payload, latencyText) {
  elements.latencyMetric.textContent = latencyText;
  elements.coverageMetric.textContent = String(payload.works?.length || 0);
  elements.conflictMetric.textContent = String(payload.conflicts?.length || 0);
  elements.aiMetric.textContent = payload.aiStatus?.state || "deterministic";
  elements.intentPill.textContent = payload.parsed?.intentLabel || clientParsePrompt(elements.promptInput.value, state.searchCategory).intentLabel;
  elements.providerPill.textContent = `${categoryLabel(payload.parsed?.searchCategory || state.searchCategory)} / ${currentSourceCount(payload)} sources`;
  renderSourceTelemetry(payload.sources || []);
  renderSourceMatrix(payload.sources || []);
  renderBriefing(payload);
  renderSpotlight(payload);
  renderAnswer(payload, payload.fromCache);
  renderInspector(payload);
  renderEvidenceBoard(payload);
  renderGraph(payload);
  renderResults();
  state.lastCopyText = JSON.stringify(payload, null, 2);
}

function renderAnswer(payload, fromCache) {
  const answer = payload.answer || {};
  clearNode(elements.answerPanel);

  if (!payload.works?.length) {
    renderNoResults(payload);
    return;
  }

  const shell = el("div", "answer-shell");
  const main = el("div", "answer-main");
  const label = el("div", "answer-label", fromCache ? "Cached source-backed answer" : answer.mode === "hybrid-llm" ? "Hybrid AI answer" : "Deterministic AI answer");
  const title = el("h2", "", answer.headline || "Source-backed answer");
  const summary = el("p", "answer-prose", answer.summary || "Atlas returned source-backed results.");
  main.append(label, title, summary);

  const lens = renderLensCallout(payload);
  main.append(lens);

  const brief = renderResearchBrief(payload);
  if (brief) main.append(brief);

  const sections = el("div", "answer-sections");
  selectSectionsForLens(answer.sections || []).forEach((section) => {
    const article = el("article", "answer-section");
    article.append(el("h3", "", section.title), el("p", "", section.body));
    const citations = renderCitationChips(section.citations || [], payload.citations || []);
    if (citations.childNodes.length) article.append(citations);
    sections.append(article);
  });
  main.append(sections);

  const side = el("aside", "answer-side");
  (answer.insights || []).slice(0, 8).forEach((insight) => {
    const item = el("div");
    item.append(el("span", "", insight.label), el("strong", "", insight.value));
    side.append(item);
  });

  shell.append(main, side);
  elements.answerPanel.append(shell);
  refreshIcons();
}

function renderSpotlight(payload) {
  clearNode(elements.spotlightPanel);
  const top = payload.works?.[0];
  if (!top) {
    const empty = el("div", "spotlight-empty");
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", "scan-eye");
    icon.setAttribute("aria-hidden", "true");
    empty.append(icon, el("span", "", "Top match waits for evidence"));
    elements.spotlightPanel.append(empty);
    refreshIcons();
    return;
  }

  const confidence = clamp(top.confidence || 0, 0, 100);
  const shell = el("div", "spotlight-shell");
  const coverWrap = el("div", "spotlight-cover");
  renderCoverArt(coverWrap, top);

  const copy = el("div", "spotlight-copy");
  const eyebrow = el("div", "answer-label", "Top fused work");
  const title = el("h2", "", top.title);
  const byline = el("p", "spotlight-byline", top.authors?.length ? top.authors.join(", ") : "Author not returned");
  const description = el("p", "spotlight-description", top.description || "No long source summary returned.");
  const tags = el("div", "spotlight-tags");
  [
    `${top.sourceCount || 0} source families`,
    top.year ? `${top.year}` : "date uncertain",
    top.isbn ? `ISBN ${top.isbn}` : "identifier sparse",
    `${payload.citations?.length || 0} citations`
  ].forEach((tag) => tags.append(el("span", "", tag)));
  const subjectRail = el("div", "spotlight-subjects");
  (top.subjects || []).slice(0, 6).forEach((subject) => subjectRail.append(el("span", "", subject)));
  copy.append(eyebrow, title, byline, description, tags, subjectRail);

  const meter = el("aside", "spotlight-meter");
  const ring = el("div", "confidence-ring");
  ring.style.setProperty("--confidence", `${confidence}%`);
  ring.append(el("strong", "", `${confidence}`), el("span", "", "confidence"));
  const sourceStack = el("div", "spotlight-sources");
  (top.sources || []).slice(0, 5).forEach((source) => {
    const link = el("a", "", source.name);
    link.href = source.url || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    sourceStack.append(link);
  });
  meter.append(ring, sourceStack);

  shell.append(coverWrap, copy, meter);
  elements.spotlightPanel.append(shell);
}

function renderLensCallout(payload) {
  const callout = el("div", "ai-callout");
  const reasoning = payload.answer?.reasoning || {};
  const failed = (payload.sources || []).filter((source) => ["partial", "unavailable", "not configured"].includes(source.state));
  const top = payload.works?.[0];
  const brief = payload.answer?.researchBrief;
  const textByLens = {
    overview: top
      ? `Atlas fused ${brief?.sourceCoverage?.records || payload.sourceRecords?.length || 0} records and ranked "${top.title}" highest using agreement, identifiers, reader fit, criteria fit, source authority, and conflict risk.`
      : "Atlas could not fuse a confident work from the returned source records.",
    evidence: `Evidence mode: ${top?.sourceCount || 0} source families support the top candidate. ${failed.length} sources need attention or credentials.`,
    themes: top?.subjects?.length
      ? `Theme mode: source tags cluster around ${top.subjects.slice(0, 8).join(", ")}.`
      : "Theme mode: the returned records did not include strong subject metadata.",
    reader: payload.answer?.sections?.find((section) => /reader/i.test(section.title))?.body || "Reader path mode uses confidence and source spread to suggest the next step.",
    conflicts: payload.conflicts?.length
      ? `Conflict mode: ${payload.conflicts.slice(0, 3).map((conflict) => conflict.message).join(" ")}`
      : "Conflict mode: no major date or author conflicts detected.",
    brain: `Brain mode: intent=${reasoning.parsedIntent || payload.parsed?.intent}; complexity=${brief?.promptRead?.complexityScore ?? "n/a"}; search=${brief?.searchStrategy?.queryExpansions?.length || 0} seeds; plan=${brief?.searchStrategy?.goal || "source-backed lookup"}.`
  };
  callout.textContent = textByLens[state.activeLens] || textByLens.overview;
  return callout;
}

function renderResearchBrief(payload) {
  const brief = payload.answer?.researchBrief;
  if (!brief) return null;
  const wrapper = el("section", "research-brief");
  const strategy = brief.searchStrategy || payload.parsed?.humanSearchPlan || payload.queryPlan?.humanSearchPlan;
  const cards = [
    ["Category route", `${categoryLabel(payload.parsed?.searchCategory || payload.queryPlan?.searchCategory)} search across ${currentSourceCount(payload)} configured source lanes.`],
    ["Prompt read", (brief.interpretation || []).slice(0, 5).join(" | ") || "No prompt profile returned."],
    ["Search plan", strategy?.strategy || "Catalog identity first, then context and evidence sources."],
    ["Query seeds", (strategy?.queryExpansions || []).slice(0, 7).join(" | ") || "No expanded query seeds returned."],
    ["Top takeaways", (brief.topTakeaways || []).slice(0, 4).join(" ") || "No takeaways returned."],
    ["Coverage", `${brief.sourceCoverage?.online || 0}/${brief.sourceCoverage?.total || 0} online, ${brief.sourceCoverage?.records || 0} records, ${brief.sourceCoverage?.conflicts || 0} conflicts.`],
    ["Next questions", (brief.nextQuestions || []).slice(0, 3).join(" ") || "No follow-up questions needed."]
  ];
  cards.forEach(([title, body]) => {
    const card = el("article", "brief-card");
    card.append(el("span", "", title), el("p", "", body));
    wrapper.append(card);
  });

  const strategyConsole = renderStrategyConsole(strategy);
  if (strategyConsole) wrapper.append(strategyConsole);

  const table = el("div", "brief-table");
  (brief.rankingTable || []).slice(0, 4).forEach((row) => {
    const item = el("div");
    item.append(
      el("span", "", `#${row.rank}`),
      el("strong", "", row.title),
      el("small", "", `${row.confidence}% | ${row.fit} | ${row.consensus}`)
    );
    table.append(item);
  });
  if (table.childNodes.length) wrapper.append(table);
  return wrapper;
}

function renderStrategyConsole(strategy) {
  if (!strategy) return null;
  const panel = el("div", "strategy-console");
  const header = el("div", "strategy-header");
  header.append(el("span", "", "Search party route"), el("strong", "", `${strategy.confidence ?? "?"}% lock`));
  panel.append(header);

  const lanes = el("div", "strategy-lanes");
  (strategy.sourceTiers || []).slice(0, 5).forEach((tier) => {
    const lane = el("article", "strategy-lane");
    lane.append(el("strong", "", tier.label), el("p", "", (tier.sources || []).slice(0, 6).join(", ")));
    lanes.append(lane);
  });
  if (lanes.childNodes.length) panel.append(lanes);

  const chips = el("div", "strategy-chips");
  [
    ...(strategy.mustHave || []).slice(0, 5).map((item) => `need: ${item}`),
    ...(strategy.avoid || []).slice(0, 4).map((item) => `avoid: ${item}`)
  ].forEach((item) => chips.append(el("span", "", item)));
  if (chips.childNodes.length) panel.append(chips);
  return panel;
}

function selectSectionsForLens(sections) {
  if (state.activeLens === "evidence") return sections.filter((section) => /evidence|source|direct/i.test(section.title));
  if (state.activeLens === "conflicts") return sections.filter((section) => /conflict|limit|direct/i.test(section.title));
  if (state.activeLens === "reader") return sections.filter((section) => /reader|direct/i.test(section.title));
  if (state.activeLens === "themes") return sections.filter((section) => /theme|comparison|direct/i.test(section.title));
  if (state.activeLens === "brain") return sections.filter((section) => /prompt|search|ranking|intelligence|direct/i.test(section.title));
  return sections;
}

function renderCitationChips(ids, citations) {
  const wrapper = el("div", "citation-row");
  ids.slice(0, 8).forEach((id) => {
    const citation = citations.find((entry) => entry.id === id);
    if (!citation) return;
    const link = el("a", "citation-chip", `[${id}] ${citation.sourceName}`);
    link.href = citation.url || citation.docsUrl || "#";
    link.target = "_blank";
    link.rel = "noreferrer";
    wrapper.append(link);
  });
  return wrapper;
}

function renderResults() {
  clearNode(elements.resultGrid);
  const payload = state.payload;
  if (!payload?.works?.length) return;

  const onlyCited = elements.showOnlyCited.checked;
  const records = sortWorks(payload.works, elements.sortSelect.value)
    .filter((work) => (onlyCited ? work.sourceCount > 1 : true));

  records.forEach((work, index) => elements.resultGrid.append(renderBookCard(work, payload, index)));
  refreshIcons();
}

function renderBookCard(work, payload, index) {
  const template = document.querySelector("#bookCardTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  const rank = card.querySelector(".rank-stamp");
  const cover = card.querySelector(".book-cover");
  const coverWrap = card.querySelector(".cover-wrap");
  const confidence = card.querySelector(".confidence-badge");
  const sourceBadge = card.querySelector(".source-badge");
  const title = card.querySelector("h3");
  const byline = card.querySelector(".byline");
  const description = card.querySelector(".description");
  const factGrid = card.querySelector(".fact-grid");
  const subjectRow = card.querySelector(".subject-row");
  const actions = card.querySelector(".card-actions");
  const detailButton = card.querySelector(".detail-button");

  card.style.setProperty("--confidence", `${clamp(work.confidence || 0, 0, 100)}%`);
  rank.textContent = `#${index + 1}`;

  cover.remove();
  renderCoverArt(coverWrap, work, "book-cover");

  confidence.textContent = `${work.confidence}%`;
  confidence.classList.add(confidenceClass(work.confidence));
  sourceBadge.textContent = `${work.sourceCount} source${work.sourceCount === 1 ? "" : "s"}`;
  title.textContent = work.title;
  byline.textContent = work.authors?.length ? work.authors.join(", ") : "Author not returned";
  description.textContent = work.description || "No source summary was returned. Open citations to inspect the source metadata.";

  [
    ["Year", work.year || "Unknown"],
    ["Publisher", work.publisher || "Unknown"],
    ["ISBN", work.isbn || "Unknown"],
    ["DOI", work.identifiers?.doi?.[0] || "None"],
    ["Conflicts", work.conflicts?.length || 0],
    ["Evidence", work.evidenceDensity || 0]
  ].forEach(([label, value]) => factGrid.append(renderFact(label, value)));

  const tags = (work.subjects || []).slice(0, 5);
  const intelligence = el("div", "intelligence-strip");
  workSignals(work).slice(0, 5).forEach((signal) => intelligence.append(el("span", "", signal)));
  if (intelligence.childNodes.length) factGrid.after(intelligence);

  const sourceMix = el("div", "source-mix");
  Object.entries(work.analytics?.sourceBreakdown || {}).slice(0, 4).forEach(([kind, count]) => {
    sourceMix.append(el("span", "", `${kind}: ${count}`));
  });
  if (sourceMix.childNodes.length) intelligence.after(sourceMix);

  if (tags.length) tags.forEach((tag) => subjectRow.append(el("span", "", tag)));
  else subjectRow.append(el("span", "", "No subjects returned"));

  (work.sources || []).slice(0, 6).forEach((source) => {
    const link = el("a", "", source.citationId || source.name);
    link.href = source.url || "#";
    link.title = source.name;
    link.target = "_blank";
    link.rel = "noreferrer";
    actions.append(link);
  });

  detailButton.addEventListener("click", () => openDetailDrawer(work, payload));
  return card;
}

function renderFact(label, value) {
  const fact = el("div", "fact");
  fact.append(el("span", "", label), el("strong", "", String(value)));
  return fact;
}

function renderCoverFallback(container, work) {
  clearNode(container);
  container.classList.add("cover-empty");
  container.classList.remove("has-cover");
  container.setAttribute("aria-label", `Generated cover placeholder for ${work.title}`);
  const title = collapseWhitespace(work.title || "Untitled");
  const author = work.authors?.[0] || work.publisher || "Atlas";
  const placeholder = el("div", "cover-placeholder");
  placeholder.append(
    el("span", "cover-monogram", initialsForTitle(title)),
    el("strong", "", title),
    el("small", "", author)
  );
  container.append(placeholder);
}

function renderCoverArt(container, work, imageClass = "") {
  renderCoverFallback(container, work);
  const coverUrl = work.coverUrl || work.cover;
  if (!coverUrl) return;

  const cover = document.createElement("img");
  if (imageClass) cover.className = imageClass;
  cover.src = coverUrl;
  cover.alt = `Cover of ${work.title}`;
  cover.loading = "lazy";
  cover.addEventListener("load", () => {
    if (cover.naturalWidth > 8 && cover.naturalHeight > 8) {
      container.classList.add("has-cover");
    } else {
      cover.remove();
    }
  });
  cover.addEventListener("error", () => cover.remove());
  container.append(cover);
}

function openDetailDrawer(work, payload) {
  clearNode(elements.detailContent);
  const heading = el("div", "drawer-heading");
  heading.append(el("span", "answer-label", "Book detail"), el("h2", "", work.title), el("p", "", work.description || "No long description returned."));

  const facts = el("div", "drawer-facts");
  [
    ["Authors", work.authors?.join(", ") || "Unknown"],
    ["Confidence", `${work.confidence}%`],
    ["Year", work.year || "Unknown"],
    ["Publisher", work.publisher || "Unknown"],
    ["ISBNs", work.identifiers?.isbn?.join(", ") || "None"],
    ["DOIs", work.identifiers?.doi?.join(", ") || "None"],
    ["Constraint fit", work.constraintFit?.label || "No constraints"],
    ["Signals", work.intelligenceSignals?.join(", ") || "Basic metadata"]
  ].forEach(([label, value]) => facts.append(renderFact(label, value)));

  const profile = el("div", "drawer-list");
  profile.append(el("h3", "", "Intelligence profile"));
  const profileGrid = el("div", "drawer-pill-grid");
  workSignals(work).forEach((signal) => profileGrid.append(el("span", "", signal)));
  if (!profileGrid.childNodes.length) profileGrid.append(el("span", "", "No extra profile signals"));
  profile.append(profileGrid);

  const mix = el("div", "drawer-list");
  mix.append(el("h3", "", "Source mix"));
  const mixGrid = el("div", "drawer-pill-grid");
  Object.entries(work.analytics?.sourceBreakdown || {}).forEach(([kind, count]) => mixGrid.append(el("span", "", `${kind}: ${count}`)));
  if (!mixGrid.childNodes.length) mixGrid.append(el("span", "", "No source mix returned"));
  mix.append(mixGrid);

  const criteria = el("div", "drawer-list");
  criteria.append(el("h3", "", "Criteria fit"));
  const criteriaGrid = el("div", "drawer-pill-grid");
  (work.analytics?.criteriaFit || []).forEach((entry) => criteriaGrid.append(el("span", "", `${entry.criterion}: ${entry.label} ${entry.score}`)));
  if (!criteriaGrid.childNodes.length) criteriaGrid.append(el("span", "", "No explicit criteria detected"));
  criteria.append(criteriaGrid);

  const verification = el("div", "drawer-list");
  verification.append(el("h3", "", "Verification audit"));
  const verificationRisk = work.analytics?.verification?.risk || "unknown";
  verification.append(el("p", "", `Risk: ${verificationRisk}. ${(work.analytics?.verification?.warnings || []).join(" ") || "No major verification warnings."}`));

  const sourceList = el("div", "drawer-list");
  sourceList.append(el("h3", "", "Source evidence"));
  (work.sources || []).forEach((source) => {
    const row = el("a", "drawer-source");
    row.href = source.url || "#";
    row.target = "_blank";
    row.rel = "noreferrer";
    row.append(el("strong", "", `${source.citationId} ${source.name}`), el("span", "", `${source.accessType || "metadata"} - ${(source.evidenceFields || []).join(", ")}`));
    sourceList.append(row);
  });

  const conflicts = el("div", "drawer-list");
  conflicts.append(el("h3", "", "Conflicts"));
  if (work.conflicts?.length) {
    work.conflicts.forEach((conflict) => conflicts.append(el("p", "", conflict.message)));
  } else {
    conflicts.append(el("p", "", "No major conflicts detected on this merged work."));
  }

  const related = el("div", "drawer-list");
  related.append(el("h3", "", "Metadata-only links"));
  const links = (payload.relatedLinks || []).filter((link) => link.metadataOnly);
  if (links.length) {
    links.forEach((link) => {
      const anchor = el("a", "drawer-source");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.append(el("strong", "", link.sourceName), el("span", "", link.note));
      related.append(anchor);
    });
  } else {
    related.append(el("p", "", "No metadata-only link-outs were returned."));
  }

  elements.detailContent.append(heading, facts, profile, mix, criteria, verification, sourceList, conflicts, related);
  elements.detailDrawer.classList.add("open");
  elements.detailDrawer.setAttribute("aria-hidden", "false");
}

function closeDetailDrawer() {
  elements.detailDrawer.classList.remove("open");
  elements.detailDrawer.setAttribute("aria-hidden", "true");
}

function renderInspector(payload) {
  const parsed = payload.parsed || clientParsePrompt(elements.promptInput.value);
  clearNode(elements.inspectorList);
  const rows = [
    ["Intent", parsed.intentLabel || parsed.intent || "Auto"],
    ["Category", categoryLabel(parsed.searchCategory || payload.queryPlan?.searchCategory || state.searchCategory)],
    ["Search terms", parsed.searchText || "None"],
    ["Signals", (parsed.signals || []).join(", ") || "Plain catalog search"],
    ["Domain", parsed.domain || parsed.promptProfile?.domain || "General"],
    ["Tasks", (parsed.tasks || parsed.intentFrame?.tasks || []).join(", ") || "None"],
    ["Aspects", (parsed.questionAspects || []).join(", ") || "None yet"],
    ["Axes", (parsed.comparisonAxes || []).join(", ") || "None yet"],
    ["Constraints", describeParsedConstraints(parsed.constraints) || "None"],
    ["Identifiers", describeIdentifierHints(parsed.identifierHints) || "None"],
    ["Search plan", parsed.humanSearchPlan?.strategy || payload.queryPlan?.humanSearchPlan?.strategy || "Auto"],
    ["Query seeds", (parsed.humanSearchPlan?.queryExpansions || payload.queryPlan?.jobs?.flatMap((job) => job.queryVariants || []) || []).slice(0, 8).join(", ") || "None"],
    ["Editions", (parsed.editionPreferences || []).join(", ") || "None"],
    ["Sources", (parsed.sourcePreferences || []).join(", ") || "Default"],
    ["Spoilers", parsed.spoilerPolicy || "Unspecified"],
    ["Strictness", parsed.strictness || "Balanced"],
    ["Audience", parsed.audience || "None"],
    ["Criteria", (parsed.evaluationCriteria || []).join(", ") || "None"],
    ["Avoid", (parsed.negativeConstraints || []).join(", ") || "None"],
    ["Output", parsed.requestedOutput || parsed.answerStyle || "Auto"],
    ["Lookups", payload.queryPlan?.jobs?.map((job) => job.label).join(", ") || parsed.searchText || "None"],
    ["AI mode", payload.aiStatus?.message || "Waiting"],
    ["Cache", payload.fromCache ? "Yes" : "No"]
  ];

  rows.forEach(([label, value]) => {
    const wrapper = document.createElement("div");
    wrapper.append(el("dt", "", label), el("dd", "", String(value)));
    elements.inspectorList.append(wrapper);
  });
}

function renderEvidenceBoard(payload) {
  clearNode(elements.evidencePanel);

  const top = payload.works?.[0];
  if (top) {
    const profile = el("div", "evidence-item meta");
    const header = el("header");
    header.append(el("strong", "", "Top work intelligence"), el("span", "", top.constraintFit?.label || "profile"));
    profile.append(header, el("p", "", workSignals(top).join(" | ") || "No expanded intelligence signals returned."));
    elements.evidencePanel.append(profile);
  }

  const brief = payload.answer?.researchBrief;
  (brief?.evidenceWarnings || []).slice(0, 3).forEach((warning) => {
    const item = el("div", "evidence-item warn");
    const header = el("header");
    header.append(el("strong", "", "Research warning"), el("span", "", "audit"));
    item.append(header, el("p", "", warning));
    elements.evidencePanel.append(item);
  });

  if (brief?.sourceBalance?.length) {
    const balance = el("div", "evidence-item meta");
    const header = el("header");
    header.append(el("strong", "", "Source balance"), el("span", "", "mix"));
    balance.append(header, el("p", "", brief.sourceBalance.slice(0, 6).map((entry) => `${entry.kind}: ${entry.count}`).join(" | ")));
    elements.evidencePanel.append(balance);
  }

  const topSources = (payload.works?.[0]?.sources || []).slice(0, 6);
  topSources.forEach((source) => {
    const item = el("div", "evidence-item ok");
    const header = el("header");
    header.append(el("strong", "", `${source.citationId} ${source.name}`), el("span", "", source.accessType || "metadata"));
    item.append(header, el("p", "", `Evidence: ${(source.evidenceFields || []).join(", ") || "source link"}`));
    elements.evidencePanel.append(item);
  });

  (payload.conflicts || []).slice(0, 5).forEach((conflict) => {
    const item = el("div", "evidence-item warn");
    const header = el("header");
    header.append(el("strong", "", conflict.type || "conflict"), el("span", "", conflict.title || ""));
    item.append(header, el("p", "", conflict.message));
    elements.evidencePanel.append(item);
  });

  (payload.sources || [])
    .filter((status) => status.state !== "online")
    .slice(0, 8)
    .forEach((status) => {
      const item = el("div", status.state === "metadata only" ? "evidence-item meta" : "evidence-item fail");
      const header = el("header");
      header.append(el("strong", "", status.sourceName), el("span", "", status.state));
      item.append(header, el("p", "", status.message));
      elements.evidencePanel.append(item);
    });

  if (!elements.evidencePanel.childNodes.length) {
    elements.evidencePanel.append(el("div", "evidence-item", "No evidence yet."));
  }
}

function renderGraph(payload) {
  clearNode(elements.graphPanel);
  const top = payload.works?.[0];
  if (!top) {
    elements.graphCaption.textContent = "No evidence nodes";
    return;
  }

  elements.graphCaption.textContent = `${top.sourceCount} source families`;
  const nodes = [
    { label: top.title, detail: "top work", x: 38, y: 44, main: true },
    { label: top.authors?.[0] || "Unknown author", detail: "author", x: 8, y: 14 },
    { label: top.year || "Unknown year", detail: "date", x: 68, y: 14 },
    { label: `${top.sourceCount} sources`, detail: "agreement", x: 7, y: 72 },
    { label: `${payload.conflicts?.length || 0} conflicts`, detail: "risk", x: 68, y: 72 }
  ];

  drawLine(47, 50, 20, 21);
  drawLine(53, 50, 78, 21);
  drawLine(47, 56, 20, 77);
  drawLine(54, 56, 78, 77);
  nodes.forEach((node) => drawNode(node));
}

function drawLine(x1, y1, x2, y2) {
  const line = el("span", "graph-line");
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  line.style.left = `${x1}%`;
  line.style.top = `${y1}%`;
  line.style.width = `${length}%`;
  line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  elements.graphPanel.append(line);
}

function drawNode(node) {
  const wrapper = el("div", `graph-node${node.main ? " main" : ""}`);
  wrapper.style.left = `${node.x}%`;
  wrapper.style.top = `${node.y}%`;
  wrapper.append(el("strong", "", String(node.label)), el("small", "", node.detail));
  elements.graphPanel.append(wrapper);
}

function renderSourceTelemetry(statuses) {
  const sourceStatuses = statuses.length ? statuses : state.sourceSnapshot;
  const online = sourceStatuses.filter((status) => status.state === "online" || status.state === "metadata only").length;
  elements.sourceMetric.textContent = `${online}/${currentSourceCount({ sources: sourceStatuses })}`;
  clearNode(elements.sourceHealth);
  (sourceStatuses.length ? sourceStatuses : buildIdleStatuses()).forEach((status) => {
    const row = el("div", "health-row");
    const label = el("span", "", status.sourceName || status.name);
    const state = el("b", statusClass(status.state), status.state || "idle");
    row.append(label, state);
    elements.sourceHealth.append(row);
  });
}

function renderSourceMatrix(statuses) {
  clearNode(elements.sourceMatrix);
  const sourceStatuses = statuses.length ? statuses : buildIdleStatuses();
  sourceStatuses.forEach((status) => {
    const card = el("article", `source-tile ${statusClass(status.state)}`);
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", sourceIcon(status));
    icon.setAttribute("aria-hidden", "true");
    const header = el("header");
    header.append(el("strong", "", status.sourceName || status.name), el("span", "", status.state || "idle"));
    const detail = el("p", "", sourceDetail(status));
    const meta = el("div", "source-meta");
    meta.append(
      el("span", "", `${status.total || 0} hits`),
      el("span", "", status.latencyMs ? `${status.latencyMs} ms` : status.metadataOnly ? "link-out" : "ready")
    );
    const bar = el("div", "source-bar");
    bar.style.setProperty("--source-fill", sourceFill(status));
    const footer = el("a", "", "docs");
    footer.href = status.docsUrl || "#";
    footer.target = "_blank";
    footer.rel = "noreferrer";
    card.append(icon, header, detail, meta, bar, footer);
    elements.sourceMatrix.append(card);
  });
  refreshIcons();
}

function buildIdleStatuses() {
  return Array.from({ length: currentSourceCount() }, (_, index) => ({
    sourceName: `Source ${index + 1}`,
    state: "idle",
    message: "Waiting"
  }));
}

function renderLoading() {
  clearNode(elements.answerPanel);
  const loading = el("div", "loading-list");
  loading.append(
    el("div", "skeleton-line"),
    el("div", "skeleton-line short"),
    el("div", "source-scan"),
    el("div", "skeleton-line"),
    el("div", "skeleton-line short")
  );
  elements.answerPanel.append(loading);
  clearNode(elements.resultGrid);
  clearNode(elements.evidencePanel);
  elements.evidencePanel.append(el("div", "evidence-item", `Firing the ${currentSourceCount()}-source pipeline.`));
  renderSpotlight({ works: [] });
  renderBriefing({ sources: state.sourceSnapshot, works: [], citations: [], conflicts: [] });
  if (elements.graphPanel) {
    clearNode(elements.graphPanel);
    elements.graphCaption.textContent = "Scanning sources";
  }
}

function renderEmpty(message) {
  clearNode(elements.answerPanel);
  const empty = el("div", "empty-state");
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", "book-open-check");
  icon.setAttribute("aria-hidden", "true");
  empty.append(icon, el("h2", "", message), el("p", "", "Ask naturally. Atlas will extract the intent and send it through the backend source engine."));
  elements.answerPanel.append(empty);
  clearNode(elements.resultGrid);
  renderSpotlight({ works: [] });
  renderBriefing({ sources: state.sourceSnapshot, works: [], citations: [], conflicts: [] });
  refreshIcons();
}

function renderNoResults(payload) {
  const empty = el("div", "empty-state");
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", "search-x");
  icon.setAttribute("aria-hidden", "true");
  empty.append(
    icon,
    el("h2", "", payload.answer?.headline || "No verified matches came back."),
    el("p", "", payload.answer?.summary || "Try adding an author, exact title, or ISBN.")
  );
  elements.answerPanel.append(empty);
  refreshIcons();
}

function renderError(error) {
  clearNode(elements.answerPanel);
  const empty = el("div", "empty-state");
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", "triangle-alert");
  icon.setAttribute("aria-hidden", "true");
  empty.append(icon, el("h2", "", "The lookup failed."), el("p", "", error.message || "Unknown error"));
  elements.answerPanel.append(empty);
  renderSpotlight({ works: [] });
  refreshIcons();
}

function renderBriefing(payload) {
  const sources = payload.sources || [];
  const online = sources.filter((status) => status.state === "online" || status.state === "metadata only").length;
  elements.briefingSources.textContent = `${online}/${currentSourceCount(payload)}`;
  elements.briefingWorks.textContent = String(payload.works?.length || 0);
  elements.briefingCitations.textContent = String(payload.citations?.length || 0);
  elements.briefingConflicts.textContent = String(payload.conflicts?.length || 0);
}

function sortWorks(works, sortMode) {
  const copy = [...works];
  if (sortMode === "year-desc") return copy.sort((a, b) => (b.year || 0) - (a.year || 0));
  if (sortMode === "year-asc") return copy.sort((a, b) => (a.year || 9999) - (b.year || 9999));
  if (sortMode === "sources") return copy.sort((a, b) => (b.sourceCount || 0) - (a.sourceCount || 0));
  return copy.sort((a, b) => b.confidence - a.confidence);
}

function currentSourceCount(payload) {
  return payload?.sources?.length || state.sourceSnapshot.length || DEFAULT_SOURCE_COUNT;
}

function workSignals(work) {
  const facts = work.analytics?.facts || {};
  const signals = [
    work.analytics?.readerFit?.label,
    work.analytics?.consensus?.label,
    work.analytics?.authority?.label,
    work.analytics?.completeness?.label,
    work.constraintFit?.label,
    work.analytics?.verification?.risk && `${work.analytics.verification.risk} verification risk`,
    facts.pages?.length ? `${facts.pages[0]}${facts.pages.length > 1 ? `-${facts.pages[facts.pages.length - 1]}` : ""} pages` : "",
    facts.languages?.length ? facts.languages.slice(0, 2).join("/") : "",
    facts.bestRating ? `rating ${facts.bestRating}` : "",
    facts.citationSignal ? `${facts.citationSignal} citations` : "",
    facts.downloadSignal ? `${facts.downloadSignal} demand` : "",
    facts.editionSignal ? `${facts.editionSignal} editions` : "",
    ...(work.intelligenceSignals || []).slice(0, 4)
  ].filter(Boolean);
  return [...new Set(signals)].slice(0, 9);
}

function describeParsedConstraints(constraints = {}) {
  const parts = [];
  if (constraints.year?.after) parts.push(`after ${constraints.year.after}`);
  if (constraints.year?.before) parts.push(`before ${constraints.year.before}`);
  if (constraints.year?.between) parts.push(`${constraints.year.between[0]}-${constraints.year.between[1]}`);
  if (constraints.pages?.max) parts.push(`under ${constraints.pages.max} pages`);
  if (constraints.pages?.min) parts.push(`over ${constraints.pages.min} pages`);
  if (constraints.language) parts.push(constraints.language);
  if (constraints.format) parts.push(constraints.format);
  if (constraints.access?.length) parts.push(`${constraints.access.join("/")} access`);
  if (constraints.region) parts.push(constraints.region);
  if (constraints.rating) parts.push(`${constraints.rating} rating`);
  return parts.join(", ");
}

function describeIdentifierHints(hints = {}) {
  return Object.entries(hints)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([key, values]) => `${key.toUpperCase()} ${values.slice(0, 2).join(", ")}`)
    .join("; ");
}

function setLoading(isLoading) {
  elements.analyzeButton.disabled = isLoading;
  elements.analyzeButton.querySelector("span").textContent = isLoading ? "Analyzing" : "Analyze";
}

function copyAnalysisPayload() {
  const text = state.lastCopyText || JSON.stringify({ prompt: elements.promptInput.value }, null, 2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function clearCache() {
  if (!window.localStorage) return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
  elements.latencyMetric.textContent = "0 ms";
}

function readCache(key) {
  try {
    const raw = window.localStorage?.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return cached.payload;
  } catch {
    return null;
  }
}

function writeCache(key, payload) {
  try {
    pruneClientCache();
    window.localStorage?.setItem(key, JSON.stringify({ createdAt: Date.now(), payload }));
  } catch {
    // Local storage may be unavailable or full.
  }
}

function pruneClientCache() {
  if (!window.localStorage) return;
  const entries = Object.keys(window.localStorage)
    .filter((key) => key.startsWith(CACHE_PREFIX))
    .map((key) => {
      try {
        return { key, createdAt: JSON.parse(window.localStorage.getItem(key) || "{}").createdAt || 0 };
      } catch {
        return { key, createdAt: 0 };
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  entries.slice(MAX_CLIENT_CACHE_ENTRIES - 1).forEach((entry) => window.localStorage.removeItem(entry.key));
}

function makeCacheKey(prompt) {
  return `${CACHE_PREFIX}${hashString(prompt)}`;
}

function clientParsePrompt(input, selectedCategory = "auto") {
  const raw = collapseWhitespace(input || "");
  const lower = raw.toLowerCase();
  const requestedCategory = normalizeClientCategory(selectedCategory);
  const isbn = extractIsbn(raw);
  const compare = /\b(compare|versus|vs\.?|difference between|which should i read)\b/i.test(raw);
  const subject = extractSubject(raw);
  const definitionTerm = extractClientDefinitionTerm(raw, lower);
  const aspects = extractClientAspects(lower);
  const axes = extractClientAxes(lower);
  const constraints = extractClientConstraints(lower);
  const audience = extractClientAudience(lower);
  const evaluationCriteria = extractClientCriteria(lower);
  const negativeConstraints = extractClientNegatives(lower);
  const requestedOutput = extractClientRequestedOutput(lower);
  let intent = "Catalog search";
  if (isbn) intent = "ISBN lookup";
  else if (compare) intent = "Compare";
  else if (/\b(who wrote|author)\b/i.test(raw)) intent = "Author answer";
  else if (/\b(when|published|publication)\b/i.test(raw)) intent = "Publication date";
  else if (/\b(recommend|beginner|starter|similar)\b/i.test(raw)) intent = "Recommend";
  else if (/\b(theme|analy[sz]e|meaning|important)\b/i.test(raw)) intent = "Theme analysis";
  else if (subject) intent = "Subject search";
  const searchCategory = requestedCategory === "auto" ? inferClientCategory(lower, { isbn, subject, definitionTerm, aspects }) : requestedCategory;
  const searchText = isbn || definitionTerm || subject || cleanPromptForSearch(raw);
  const constraintText = [constraints.year, constraints.pages, constraints.language, constraints.format].filter(Boolean).join(", ");
  const queryExpansions = buildClientQuerySeeds({ raw, isbn, subject, searchText, aspects, axes, constraints, audience, evaluationCriteria });
  const strategy = buildClientSearchStrategy({ intent, searchText, queryExpansions, evaluationCriteria, negativeConstraints });
  return {
    raw,
    intentLabel: intent,
    searchText,
    searchCategory,
    definitionTerm,
    questionAspects: aspects,
    comparisonAxes: axes,
    constraints: constraints.raw,
    audience,
    evaluationCriteria,
    negativeConstraints,
    requestedOutput,
    answerStyle: requestedOutput,
    humanSearchPlan: {
      goal: `${intent} for ${searchText || "the prompt"}`,
      strategy,
      targets: [searchText].filter(Boolean),
      mustHave: [
        isbn && `exact ISBN ${isbn}`,
        subject && `subject relevance to ${subject}`,
        constraints.language && `${constraints.language} language`,
        constraints.format && `${constraints.format} format`
      ].filter(Boolean),
      avoid: negativeConstraints,
      queryExpansions,
      sourceTiers: [
        { label: "identity catalogs", sources: ["Open Library", "Google Books", "Library of Congress"] },
        { label: "context graphs", sources: ["Wikidata", "Wikipedia", "DBpedia"] },
        { label: "evidence lanes", sources: ["OpenAlex", "Crossref", "Semantic Scholar"] }
      ]
    },
    signals: [
      isbn && "ISBN",
      compare && "comparison",
      subject && "subject",
      ...aspects,
      ...axes.map((axis) => `axis: ${axis}`),
      constraintText && `constraints: ${constraintText}`,
      audience && `audience: ${audience}`,
      ...evaluationCriteria.map((criterion) => `criterion: ${criterion}`),
      ...negativeConstraints.map((constraint) => `avoid: ${constraint}`),
      requestedOutput && `output: ${requestedOutput}`,
      raw && "natural language"
    ].filter(Boolean)
  };
}

function buildClientQuerySeeds({ raw, isbn, subject, searchText, aspects, axes, constraints, audience, evaluationCriteria }) {
  const seeds = [isbn, subject, searchText];
  if (subject) {
    if (audience === "beginner" || /\bbeginner|starter|intro\b/i.test(raw)) seeds.push(`${subject} beginner books`);
    if (constraints.format) seeds.push(`${subject} ${constraints.format} books`);
    if (evaluationCriteria.includes("accuracy")) seeds.push(`${subject} reliable sources books`);
    if (evaluationCriteria.includes("scholarly impact")) seeds.push(`${subject} cited books`);
  }
  if (aspects.includes("themes")) seeds.push(`${searchText} themes`);
  if (aspects.includes("edition")) seeds.push(`${searchText} edition`);
  if (axes.includes("publication history")) seeds.push(`${searchText} publication history`);
  return uniqueStrings(seeds.filter(Boolean)).slice(0, 8);
}

function normalizeClientCategory(value) {
  const key = collapseWhitespace(value || "auto").toLowerCase();
  if (["book", "books", "catalog"].includes(key)) return "books";
  if (["study", "studies", "papers", "paper", "articles", "research"].includes(key)) return "studies";
  if (["definition", "definitions", "terms"].includes(key)) return "definitions";
  if (["all", "broad", "everything"].includes(key)) return "all";
  return "auto";
}

function inferClientCategory(lower, context = {}) {
  if (context.definitionTerm || /\b(define|definition|meaning|what does .+ mean)\b/.test(lower)) return "definitions";
  if (context.isbn || /\b(isbn|edition|publisher|audiobook|ebook)\b/.test(lower)) return "books";
  if (/\b(studies?|papers?|articles?|journal|doi|pubmed|clinical trial|randomized|meta[-\s]?analysis|systematic review|scholar)\b/.test(lower)) return "studies";
  if (/\b(books?|novels?|author|read)\b/.test(lower)) return "books";
  return "all";
}

function extractClientDefinitionTerm(raw, lower) {
  if (!/\b(define|definition|meaning|what\s+does)\b/.test(lower)) return "";
  const match = String(raw || "").match(/\b(?:define|definition of|meaning of|what does)\s+["']?(.+?)["']?(?:\s+mean\b|[?.!]|$)/i);
  return match ? collapseWhitespace(match[1]).replace(/\s+\b(?:in|for|within)\b.*$/i, "") : "";
}

function categoryLabel(value) {
  return {
    auto: "Auto",
    all: "All",
    books: "Books",
    studies: "Studies",
    definitions: "Definitions"
  }[normalizeClientCategory(value)] || "Auto";
}

function buildClientSearchStrategy({ intent, searchText, queryExpansions, evaluationCriteria, negativeConstraints }) {
  const criteria = evaluationCriteria.length ? `, weighting ${evaluationCriteria.slice(0, 3).join(", ")}` : "";
  const avoids = negativeConstraints.length ? `, avoiding ${negativeConstraints.slice(0, 3).join(", ")}` : "";
  return `${intent}: lock the entity for "${searchText}", fan out with ${queryExpansions.length || 1} query seed${queryExpansions.length === 1 ? "" : "s"}${criteria}${avoids}.`;
}

function extractIsbn(text) {
  const match = String(text || "").match(/\b(?:isbn(?:-1[03])?\s*[:#]?\s*)?((?:97[89][-\s]?)?\d[\d-\s]{8,17}[\dXx])\b/i);
  if (!match) return "";
  const normalized = match[1].replace(/[^0-9Xx]/g, "").toUpperCase();
  return normalized.length === 10 || normalized.length === 13 ? normalized : "";
}

function extractSubject(text) {
  const match = String(text || "").match(/\b(?:books|novels|works|stories)\s+(?:about|on|for)\s+(.+?)(?:\s+for\s+|[?.!]|$)/i);
  return match ? collapseWhitespace(match[1]) : "";
}

function cleanPromptForSearch(text) {
  return collapseWhitespace(
    String(text || "")
      .replace(/\b(please|can you|could you|give me|show me|find me|search for|information on|info on)\b/gi, " ")
      .replace(/\b(book|books|novel|novels|data|information|summary|analysis)\b/gi, " ")
  );
}

function extractClientAspects(lower) {
  return [
    /\b(who wrote|author|written by)\b/.test(lower) && "author",
    /\b(when|published|publication|release date)\b/.test(lower) && "publication",
    /\b(summary|summarize|what is|plot|synopsis)\b/.test(lower) && "summary",
    /\b(theme|symbolism|meaning|important|analy[sz]e)\b/.test(lower) && "themes",
    /\b(recommend|similar|read next|beginner|starter)\b/.test(lower) && "recommendation",
    /\b(edition|translation|publisher|pages|format)\b/.test(lower) && "edition"
  ].filter(Boolean);
}

function extractClientAxes(lower) {
  return [
    /\b(theme|themes|political|ecological|symbolism)\b/.test(lower) && "themes",
    /\b(publication history|first published|edition|translation)\b/.test(lower) && "publication history",
    /\b(read first|where to start|reading order)\b/.test(lower) && "reading order",
    /\b(difficulty|hard|easy|accessible|dense|beginner)\b/.test(lower) && "difficulty",
    /\b(style|prose|voice|tone|pacing)\b/.test(lower) && "style",
    /\b(impact|influence|legacy|important|significance)\b/.test(lower) && "influence"
  ].filter(Boolean);
}

function extractClientConstraints(lower) {
  const year = lower.match(/\b(?:after|since|before)\s*(1[0-9]{3}|20[0-9]{2})\b/);
  const pages = lower.match(/\b(?:under|over|less than|more than)\s+(\d{2,4})\s+pages?\b/);
  const language = lower.match(/\b(?:in|language:)\s+(english|spanish|french|german|russian|japanese|chinese|arabic|latin)\b/);
  const format = lower.match(/\b(audiobook|ebook|paperback|hardcover|graphic novel|manga|poetry|nonfiction|fiction)\b/);
  const raw = {};
  if (year) {
    raw.year = year[0].includes("before") ? { before: Number(year[1]) } : { after: Number(year[1]) };
  }
  if (pages) {
    raw.pages = /under|less|fewer/i.test(pages[0]) ? { max: Number(pages[1]) } : { min: Number(pages[1]) };
  }
  if (language) raw.language = language[1];
  if (format) raw.format = format[1];
  return {
    year: year ? year[0] : "",
    pages: pages ? pages[0] : "",
    language: language ? language[1] : "",
    format: format ? format[1] : "",
    raw
  };
}

function extractClientAudience(lower) {
  if (/\b(book club|discussion group)\b/.test(lower)) return "book club";
  if (/\b(classroom|school|students?|college|course|syllabus)\b/.test(lower)) return "classroom";
  if (/\b(kids?|children|young readers?)\b/.test(lower)) return "young readers";
  if (/\b(teens?|young adult|ya)\b/.test(lower)) return "teens";
  if (/\b(researchers?|scholars?|academic)\b/.test(lower)) return "research";
  if (/\b(gift|present|friend)\b/.test(lower)) return "gift";
  if (/\b(beginner|starter|intro)\b/.test(lower)) return "beginner";
  return "";
}

function extractClientCriteria(lower) {
  return [
    /\b(accurate|reliable|source-backed|credible)\b/.test(lower) && "accuracy",
    /\b(beginner|accessible|easy|starter|not too dense)\b/.test(lower) && "beginner friendliness",
    /\b(deep|comprehensive|scholarly|advanced)\b/.test(lower) && "depth",
    /\b(short|concise|quick|under\s+\d+\s+pages?)\b/.test(lower) && "brevity",
    /\b(recent|new|current|modern|contemporary)\b/.test(lower) && "recency",
    /\b(prose|style|literary|well-written)\b/.test(lower) && "literary quality",
    /\b(popular|bestseller|rating|demand)\b/.test(lower) && "popularity",
    /\b(citation|impact|influence|legacy|canon)\b/.test(lower) && "scholarly impact",
    /\b(public domain|free|read online|audiobook|ebook)\b/.test(lower) && "availability",
    /\b(book club|discussion|debate|questions)\b/.test(lower) && "discussion value"
  ].filter(Boolean);
}

function extractClientNegatives(lower) {
  return [
    /\b(?:avoid|no|not)\s+(?:textbooks?|manuals?)\b/.test(lower) && "textbooks",
    /\b(?:avoid|no|not too|less)\s+(?:academic|dense|scholarly|technical)\b/.test(lower) && "academic density",
    /\b(?:avoid|no|not)\s+(?:ya|young adult|teen)\b/.test(lower) && "young adult",
    /\b(?:avoid|no|not)\s+fiction\b/.test(lower) && "fiction",
    /\b(?:avoid|no|not)\s+nonfiction\b/.test(lower) && "nonfiction",
    /\b(?:avoid|no|not too)\s+(?:long|huge|big)\b/.test(lower) && "long books"
  ].filter(Boolean);
}

function extractClientRequestedOutput(lower) {
  if (/\b(table|matrix|spreadsheet)\b/.test(lower)) return "comparison table";
  if (/\b(timeline|chronology)\b/.test(lower)) return "timeline";
  if (/\b(reading list|list)\b/.test(lower)) return "reading list";
  if (/\b(verdict|pick one|choose)\b/.test(lower)) return "verdict";
  if (/\b(summary|brief)\b/.test(lower)) return "summary";
  if (/\b(deep dive|deep analysis|comprehensive)\b/.test(lower)) return "deep brief";
  return "";
}

function confidenceClass(score) {
  if (score < 50) return "low";
  if (score < 75) return "medium";
  return "high";
}

function statusClass(state) {
  const value = String(state || "idle").replace(/\s+/g, "-");
  if (value === "online" || value === "metadata-only") return "ok";
  if (value === "partial" || value === "idle") return "partial";
  if (value === "not-configured") return "muted";
  return "fail";
}

function sourceIcon(status) {
  const state = status.state || "idle";
  if (state === "online") return "radio-tower";
  if (state === "metadata only") return "external-link";
  if (state === "not configured") return "key-round";
  if (state === "unavailable") return "wifi-off";
  return "activity";
}

function sourceDetail(status) {
  if (status.metadataOnly) return "Safe search link only";
  if (status.state === "not configured") return "Credentialed source";
  if (status.state === "online") return status.message || "Evidence returned";
  if (status.state === "unavailable") return status.message || "No response";
  return status.message || status.kind || "Ready";
}

function sourceFill(status) {
  if (status.state === "online") return "100%";
  if (status.state === "metadata only") return "72%";
  if (status.state === "partial") return "42%";
  if (status.state === "not configured") return "18%";
  if (status.state === "unavailable") return "8%";
  return "24%";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = collapseWhitespace(value).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function initialsForTitle(value) {
  const words = collapseWhitespace(value)
    .replace(/^(the|a|an)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return (words[0]?.[0] || "A").toUpperCase() + (words[1]?.[0] || "B").toUpperCase();
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function debounce(callback, wait) {
  let id;
  return (...args) => {
    window.clearTimeout(id);
    id = window.setTimeout(() => callback(...args), wait);
  };
}

function clearNode(node) {
  while (node?.firstChild) {
    node.firstChild.remove();
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}
