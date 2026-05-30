"use strict";

const MAX_RESULTS_PER_SOURCE = 12;
const FETCH_TIMEOUT_MS = 8500;
const CACHE_TTL_MS = 1000 * 60 * 20;
const MAX_MEMORY_CACHE_ENTRIES = 24;
const MAX_RESPONSE_RECORDS = 160;
const MAX_RESPONSE_RELATED_LINKS = 48;
const ANALYSIS_VERSION = "atlas-28-source-v6";
const SEARCH_CATEGORIES = new Set(["auto", "all", "books", "studies", "definitions"]);

const memoryCache = new Map();

const SOURCE_CATALOG = [
  {
    id: "open-library",
    name: "Open Library",
    kind: "catalog",
    docsUrl: "https://openlibrary.org/dev/docs/api/search",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "google-books",
    name: "Google Books",
    kind: "catalog",
    docsUrl: "https://developers.google.com/books/docs/v1/reference/volumes/list",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "library-of-congress",
    name: "Library of Congress",
    kind: "catalog",
    docsUrl: "https://www.loc.gov/apis/json-and-yaml/",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "wikidata",
    name: "Wikidata",
    kind: "knowledge graph",
    docsUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
    requiresConfig: false,
    categories: ["books", "studies", "definitions"]
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    kind: "encyclopedia",
    docsUrl: "https://www.mediawiki.org/wiki/API:REST_API",
    requiresConfig: false,
    categories: ["books", "studies", "definitions"]
  },
  {
    id: "dbpedia",
    name: "DBpedia",
    kind: "linked data graph",
    docsUrl: "https://www.dbpedia.org/resources/lookup/",
    requiresConfig: false,
    categories: ["books", "studies", "definitions"]
  },
  {
    id: "wiktionary",
    name: "Wiktionary",
    kind: "definition database",
    docsUrl: "https://www.mediawiki.org/wiki/API:Search",
    requiresConfig: false,
    categories: ["definitions"]
  },
  {
    id: "wikisource",
    name: "Wikisource",
    kind: "public-domain text index",
    docsUrl: "https://www.mediawiki.org/wiki/API:Search",
    requiresConfig: false,
    categories: ["books", "definitions"]
  },
  {
    id: "internet-archive",
    name: "Internet Archive",
    kind: "digital library",
    docsUrl: "https://archive.org/advancedsearch.php",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "gutendex",
    name: "Gutendex / Project Gutenberg",
    kind: "public domain catalog",
    docsUrl: "https://gutendex.com/",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "standard-ebooks",
    name: "Standard Ebooks",
    kind: "metadata-only link-out",
    docsUrl: "https://standardebooks.org/ebooks",
    requiresConfig: false,
    metadataOnly: true,
    categories: ["books"]
  },
  {
    id: "librivox",
    name: "LibriVox",
    kind: "public-domain audiobook catalog",
    docsUrl: "https://librivox.org/api/info",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "openalex",
    name: "OpenAlex",
    kind: "scholarly graph",
    docsUrl: "https://docs.openalex.org/api-entities/works",
    requiresConfig: false,
    categories: ["books", "studies"]
  },
  {
    id: "crossref",
    name: "Crossref",
    kind: "doi metadata",
    docsUrl: "https://api.crossref.org/swagger-ui/index.html",
    requiresConfig: false,
    categories: ["books", "studies"]
  },
  {
    id: "datacite",
    name: "DataCite",
    kind: "doi metadata",
    docsUrl: "https://support.datacite.org/docs/api",
    requiresConfig: false,
    categories: ["studies"]
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    kind: "scholarly graph",
    docsUrl: "https://api.semanticscholar.org/api-docs/graph",
    requiresConfig: false,
    categories: ["books", "studies"]
  },
  {
    id: "google-scholar",
    name: "Google Scholar",
    kind: "metadata-only scholar link-out",
    docsUrl: "https://scholar.google.com/",
    requiresConfig: false,
    metadataOnly: true,
    categories: ["studies"]
  },
  {
    id: "pubmed",
    name: "PubMed",
    kind: "biomedical literature database",
    docsUrl: "https://www.ncbi.nlm.nih.gov/books/NBK25497/",
    requiresConfig: false,
    categories: ["studies"]
  },
  {
    id: "europe-pmc",
    name: "Europe PMC",
    kind: "life-sciences literature database",
    docsUrl: "https://europepmc.org/RestfulWebService",
    requiresConfig: false,
    categories: ["studies"]
  },
  {
    id: "arxiv",
    name: "arXiv",
    kind: "preprint repository",
    docsUrl: "https://info.arxiv.org/help/api/index.html",
    requiresConfig: false,
    categories: ["studies"]
  },
  {
    id: "opencitations",
    name: "OpenCitations",
    kind: "open DOI citation index",
    docsUrl: "https://api.opencitations.net/index/v2",
    requiresConfig: false,
    categories: ["studies"]
  },
  {
    id: "hathitrust",
    name: "HathiTrust",
    kind: "bibliographic catalog",
    docsUrl: "https://www.hathitrust.org/member-libraries/resources-for-librarians/data-resources/bibliographic-api/",
    requiresConfig: false,
    categories: ["books"]
  },
  {
    id: "open-textbook-library",
    name: "Open Textbook Library",
    kind: "open textbook catalog",
    docsUrl: "https://open.umn.edu/opentextbooks",
    requiresConfig: false,
    categories: ["books", "studies"]
  },
  {
    id: "doab",
    name: "DOAB",
    kind: "metadata-only link-out",
    docsUrl: "https://www.doabooks.org/",
    requiresConfig: false,
    metadataOnly: true,
    categories: ["books", "studies"]
  },
  {
    id: "bookbrainz",
    name: "BookBrainz",
    kind: "metadata-only link-out",
    docsUrl: "https://bookbrainz.org/",
    requiresConfig: false,
    metadataOnly: true,
    categories: ["books"]
  },
  {
    id: "annas-archive",
    name: "Anna's Archive",
    kind: "metadata-only link-out",
    docsUrl: "https://annas-archive.org/",
    requiresConfig: false,
    metadataOnly: true,
    categories: ["books"]
  },
  {
    id: "scribd",
    name: "Scribd",
    kind: "metadata-only link-out",
    docsUrl: "https://www.scribd.com/search",
    requiresConfig: false,
    metadataOnly: true,
    categories: ["books"]
  },
  {
    id: "worldcat",
    name: "WorldCat",
    kind: "credentialed library catalog",
    docsUrl: "https://developer.api.oclc.org/",
    requiresConfig: true,
    envKeys: ["WORLDCAT_API_URL", "WORLDCAT_API_KEY"],
    categories: ["books"]
  }
];

const SOURCE_ADAPTERS = {
  "open-library": openLibraryAdapter,
  "google-books": googleBooksAdapter,
  "library-of-congress": libraryOfCongressAdapter,
  wikidata: wikidataAdapter,
  wikipedia: wikipediaAdapter,
  dbpedia: dbpediaAdapter,
  wiktionary: wiktionaryAdapter,
  wikisource: wikisourceAdapter,
  "internet-archive": internetArchiveAdapter,
  gutendex: gutendexAdapter,
  "standard-ebooks": standardEbooksAdapter,
  librivox: librivoxAdapter,
  openalex: openAlexAdapter,
  crossref: crossrefAdapter,
  datacite: dataCiteAdapter,
  "semantic-scholar": semanticScholarAdapter,
  "google-scholar": googleScholarAdapter,
  pubmed: pubMedAdapter,
  "europe-pmc": europePmcAdapter,
  arxiv: arxivAdapter,
  opencitations: openCitationsAdapter,
  hathitrust: hathiTrustAdapter,
  "open-textbook-library": openTextbookLibraryAdapter,
  doab: doabAdapter,
  bookbrainz: bookBrainzAdapter,
  "annas-archive": annasArchiveAdapter,
  scribd: scribdAdapter,
  worldcat: worldCatAdapter
};

async function analyzePrompt(prompt, config = {}) {
  const env = config.env || process.env;
  const fetchImpl = config.fetchImpl || global.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("This Node runtime does not expose fetch. Use Node 18+.");
  }

  const parsed = parsePrompt(prompt, config.options || {});
  const queryPlan = buildQueryPlan(parsed);
  const cacheKey = makeCacheKey({ prompt: parsed.raw, options: config.options || {}, envShape: sourceConfigShape(env) });
  const cached = readCache(cacheKey);
  if (cached && !config.options?.disableCache) {
    return {
      ...cached,
      fromCache: true,
      generatedAt: new Date().toISOString()
    };
  }

  const context = {
    env,
    fetchImpl,
    timeoutMs: Number(env.ATLAS_FETCH_TIMEOUT_MS || FETCH_TIMEOUT_MS),
    contactEmail: env.ATLAS_CONTACT_EMAIL || "",
    options: config.options || {}
  };

  const settled = await Promise.allSettled(
    SOURCE_CATALOG.map((source) => runSource(source, queryPlan, context))
  );

  const sourceResults = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const source = SOURCE_CATALOG[index];
    return {
      source,
      records: [],
      links: [],
      status: makeStatus(source, "unavailable", {
        message: result.reason?.message || "Adapter failed before returning a response"
      })
    };
  });

  const statuses = sourceResults.map((result) => result.status);
  const relatedLinks = sourceResults.flatMap((result) => result.links || []);
  const allSourceRecords = assignCitations(
    sourceResults.flatMap((result) => result.records || []).filter((record) => record.title)
  );
  const sourceRecords = constrainRecordsForIntent(allSourceRecords, parsed);
  const fusion = fuseRecords(sourceRecords, parsed);
  const deterministic = synthesizeAnswer(parsed, queryPlan, fusion.works, statuses, fusion.conflicts, sourceRecords, relatedLinks);
  const aiResult = await maybeEnhanceWithOpenAI(deterministic, parsed, fusion.works, sourceRecords, statuses, context);
  const referencedCitationIds = collectReferencedCitationIds(aiResult.answer, fusion.works);
  const responseRecords = limitRecordsForResponse(sourceRecords, fusion.works, referencedCitationIds);
  const responseRelatedLinks = relatedLinks.slice(0, MAX_RESPONSE_RELATED_LINKS);

  const payload = {
    version: ANALYSIS_VERSION,
    generatedAt: new Date().toISOString(),
    fromCache: false,
    parsed,
    queryPlan: publicQueryPlan(queryPlan),
    sources: statuses,
    relatedLinks: responseRelatedLinks,
    sourceRecords: responseRecords,
    works: fusion.works,
    conflicts: fusion.conflicts,
    citations: responseRecords.map(toCitation),
    answer: aiResult.answer,
    aiStatus: aiResult.aiStatus
  };

  writeCache(cacheKey, payload);
  return payload;
}

function runSource(source, queryPlan, context) {
  const configured = isSourceConfigured(source, context.env);
  if (!configured) {
    return Promise.resolve({
      source,
      records: [],
      links: [],
      status: makeStatus(source, "not configured", {
        message: `Set ${source.envKeys.join(" and ")} to enable this source.`
      })
    });
  }

  if (!sourceMatchesCategory(source, queryPlan.searchCategory)) {
    return Promise.resolve({
      source,
      records: [],
      links: [],
      status: makeStatus(source, "partial", {
        message: `Skipped for ${queryPlan.searchCategory} category`,
        categorySkipped: true
      })
    });
  }

  const adapter = SOURCE_ADAPTERS[source.id];
  if (!adapter) {
    return Promise.resolve({
      source,
      records: [],
      links: [],
      status: makeStatus(source, "unavailable", { message: "No adapter registered." })
    });
  }

  const startedAt = Date.now();
  return adapter(queryPlan, context, source)
    .then((result = {}) => {
      const records = result.records || [];
      const state = result.state || (source.metadataOnly ? "metadata only" : records.length ? "online" : "partial");
      const message = result.message || defaultStatusMessage(state, records.length);
      return {
        source,
        records,
        links: result.links || [],
        status: makeStatus(source, state, {
          total: records.length,
          message,
          latencyMs: Date.now() - startedAt,
          relatedLinks: result.links || []
        })
      };
    })
    .catch((error) => ({
      source,
      records: [],
      links: [],
      status: makeStatus(source, "unavailable", {
        message: error?.message || "Lookup failed",
        latencyMs: Date.now() - startedAt
      })
    }));
}

function defaultStatusMessage(state, total) {
  if (state === "online") return `${total} source records`;
  if (state === "metadata only") return "Safe metadata/search link only";
  if (state === "not configured") return "Credentials not configured";
  if (state === "partial") return total ? `${total} partial records` : "No direct records for this prompt";
  return "Unavailable";
}

function makeStatus(source, state, extra = {}) {
  return {
    sourceId: source.id,
    sourceName: source.name,
    kind: source.kind,
    docsUrl: source.docsUrl,
    state,
    ok: state === "online" || state === "metadata only",
    configured: state !== "not configured",
    metadataOnly: Boolean(source.metadataOnly),
    categories: source.categories || ["all"],
    total: extra.total || 0,
    message: extra.message || defaultStatusMessage(state, extra.total || 0),
    latencyMs: extra.latencyMs || 0,
    relatedLinks: extra.relatedLinks || [],
    categorySkipped: Boolean(extra.categorySkipped)
  };
}

function getSourceCatalog(env = process.env) {
  return SOURCE_CATALOG.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    docsUrl: source.docsUrl,
    requiresConfig: Boolean(source.requiresConfig),
    configured: isSourceConfigured(source, env),
    metadataOnly: Boolean(source.metadataOnly),
    categories: source.categories || ["all"]
  }));
}

function buildSourceStatusSnapshot(env = process.env) {
  return SOURCE_CATALOG.map((source) => {
    if (!isSourceConfigured(source, env)) {
      return makeStatus(source, "not configured", {
        message: `Set ${source.envKeys.join(" and ")} to enable this source.`
      });
    }
    if (source.metadataOnly) {
      return makeStatus(source, "metadata only", { message: "Safe metadata/search link only" });
    }
    return makeStatus(source, "partial", { message: "Ready" });
  });
}

function isSourceConfigured(source, env) {
  if (!source.requiresConfig) return true;
  return (source.envKeys || []).every((key) => Boolean(env[key]));
}

function sourceMatchesCategory(source, category) {
  const selected = normalizeSearchCategory(category);
  if (selected === "auto" || selected === "all") return true;
  return cleanList(source.categories || ["all"]).includes(selected) || cleanList(source.categories).includes("all");
}

function sourceConfigShape(env) {
  return SOURCE_CATALOG.filter((source) => source.requiresConfig)
    .map((source) => `${source.id}:${isSourceConfigured(source, env)}`)
    .join("|");
}

function parsePrompt(input, options = {}) {
  const raw = collapseWhitespace(input || "");
  const lower = raw.toLowerCase();
  const requestedCategory = normalizeSearchCategory(options.searchCategory || "auto");
  const identifierHints = extractIdentifierHints(raw);
  const isbn = identifierHints.isbn[0] || extractIsbn(raw);
  const quoted = extractQuoted(raw);
  const titleAuthorPairs = extractTitleAuthorPairs(raw, quoted);
  const contributorHints = extractContributorHints(raw);
  const questionAspects = extractQuestionAspects(lower);
  const constraints = extractConstraints(raw);
  const editionPreferences = extractEditionPreferences(lower);
  const sourcePreferences = extractSourcePreferences(lower);
  const spoilerPolicy = extractSpoilerPolicy(lower);
  const strictness = extractStrictness(lower);
  const compareTerms = extractCompareTerms(raw, quoted, titleAuthorPairs);
  const comparisonAxes = extractComparisonAxes(lower);
  const author = extractAuthor(raw, quoted) || (titleAuthorPairs.length === 1 ? titleAuthorPairs[0].author : "");
  const subject = extractSubject(raw, constraints);
  const requestedDepth = extractRequestedDepth(lower);
  const readerLevel = extractReaderLevel(lower);
  const readerGoal = extractReaderGoal(lower);
  const answerStyle = extractAnswerStyle(lower);
  const audience = extractAudience(lower);
  const evaluationCriteria = extractEvaluationCriteria(lower);
  const negativeConstraints = extractNegativeConstraints(raw);
  const requestedOutput = extractRequestedOutput(lower);
  const intent = chooseIntent({ isbn, compareTerms, subject, questionAspects });
  const domain = inferPromptDomain(lower, { intent, questionAspects, comparisonAxes, constraints, subject, compareTerms, editionPreferences });
  const definitionTerm = extractDefinitionTerm(raw, lower);
  let studyFrame = extractStudyFrame(raw, lower, { subject, title: "", questionAspects, evaluationCriteria, constraints });
  const searchCategory = requestedCategory === "auto"
    ? inferSearchCategory(lower, { isbn, intent, domain, subject, compareTerms, questionAspects, sourcePreferences, identifierHints, definitionTerm, studyFrame })
    : requestedCategory;
  let title = inferTitle(raw, { quoted, author, subject, compareTerms, intent, constraints, titleAuthorPairs, isbn });

  if (subject && intent === "recommendation" && title && normalizeKey(title).includes(normalizeKey(subject))) {
    title = "";
  }
  if (!title && subject && !["subject", "recommendation"].includes(intent)) {
    title = subject;
  }
  if (!title && titleAuthorPairs.length === 1) {
    title = titleAuthorPairs[0].title;
  }
  if (intent === "subject") {
    title = "";
  }
  if (searchCategory === "definitions") {
    title = "";
  }
  studyFrame = extractStudyFrame(raw, lower, { subject, title, questionAspects, evaluationCriteria, constraints });

  const searchText = buildSearchText({ raw, isbn, title, author, subject, compareTerms, intent, constraints, searchCategory, definitionTerm });
  const tasks = extractTasks(lower, { isbn, compareTerms, subject, questionAspects, requestedOutput, editionPreferences, sourcePreferences, readerGoal, searchCategory, definitionTerm, studyFrame });
  const entities = extractPromptEntities({ raw, quoted, title, author, subject, compareTerms, titleAuthorPairs, identifierHints, contributorHints });
  const focus = buildFocus({ isbn, title, author, subject, compareTerms, intent, domain, tasks, questionAspects, comparisonAxes, constraints, requestedDepth, readerLevel, readerGoal, answerStyle, audience, evaluationCriteria, negativeConstraints, requestedOutput, editionPreferences, sourcePreferences, spoilerPolicy, strictness, searchCategory, definitionTerm, studyFrame });
  const promptProfile = buildPromptProfile({
    isbn,
    title,
    author,
    subject,
    compareTerms,
    intent,
    domain,
    tasks,
    questionAspects,
    comparisonAxes,
    constraints,
    readerLevel,
    readerGoal,
    answerStyle,
    audience,
    evaluationCriteria,
    negativeConstraints,
    requestedOutput,
    editionPreferences,
    sourcePreferences,
    spoilerPolicy,
    strictness,
    searchCategory,
    definitionTerm,
    studyFrame,
    identifierHints,
    contributorHints,
    entities
  });
  const humanSearchPlan = buildHumanSearchPlan({
    raw,
    normalized: normalizePromptForReading(raw),
    intent,
    intentLabel: labelForIntent(intent),
    domain,
    tasks,
    isbn,
    identifierHints,
    title,
    author,
    subject,
    compareTerms,
    titleAuthorPairs,
    contributorHints,
    searchText,
    questionAspects,
    comparisonAxes,
    constraints,
    editionPreferences,
    sourcePreferences,
    spoilerPolicy,
    strictness,
    requestedDepth,
    readerLevel,
    readerGoal,
    answerStyle,
    audience,
    evaluationCriteria,
    negativeConstraints,
    requestedOutput,
    entities,
    promptProfile,
    searchCategory,
    definitionTerm,
    studyFrame,
    focus
  });
  const intentFrame = buildIntentFrame({
    raw,
    intent,
    domain,
    tasks,
    isbn,
    title,
    author,
    subject,
    compareTerms,
    identifierHints,
    titleAuthorPairs,
    contributorHints,
    constraints,
    editionPreferences,
    sourcePreferences,
    spoilerPolicy,
    strictness,
    audience,
    evaluationCriteria,
    negativeConstraints,
    requestedOutput,
    questionAspects,
    comparisonAxes,
    promptProfile,
    humanSearchPlan,
    searchCategory,
    definitionTerm,
    studyFrame
  });

  return {
    raw,
    normalized: normalizePromptForReading(raw),
    intent,
    intentLabel: labelForIntent(intent),
    isbn,
    identifierHints,
    title,
    author,
    subject,
    compareTerms,
    titleAuthorPairs,
    contributorHints,
    searchText,
    searchCategory,
    definitionTerm,
    studyFrame,
    domain,
    tasks,
    questionAspects,
    comparisonAxes,
    constraints,
    editionPreferences,
    sourcePreferences,
    spoilerPolicy,
    strictness,
    intentFrame,
    humanSearchPlan,
    focus,
    requestedDepth,
    readerLevel,
    readerGoal,
    answerStyle,
    audience,
    evaluationCriteria,
    negativeConstraints,
    requestedOutput,
    entities,
    promptProfile,
    signals: buildSignals({ isbn, title, author, subject, compareTerms, intent, domain, tasks, requestedDepth, readerLevel, readerGoal, answerStyle, audience, evaluationCriteria, negativeConstraints, requestedOutput, questionAspects, comparisonAxes, constraints, editionPreferences, sourcePreferences, spoilerPolicy, strictness, identifierHints, searchCategory, definitionTerm, studyFrame })
  };
}

function buildQueryPlan(parsed) {
  const jobs = parsed.compareTerms.length >= 2
    ? parsed.compareTerms.slice(0, 4).map((term) => buildSingleJob({ ...parsed, title: term, subject: "", searchText: term, intent: "compare-item" }))
    : [buildSingleJob(parsed)];

  return {
    parsed,
    jobs,
    focus: parsed.focus,
    humanSearchPlan: parsed.humanSearchPlan,
    searchCategory: parsed.searchCategory || "all",
    constraints: parsed.constraints,
    maxResults: MAX_RESULTS_PER_SOURCE,
    createdAt: new Date().toISOString()
  };
}

function buildSingleJob(parsed) {
  const label = parsed.intent === "subject"
    ? parsed.subject || parsed.searchText
    : parsed.title || parsed.subject || parsed.author || parsed.isbn || parsed.searchText;

  return {
    label,
    searchText: parsed.isbn || label || parsed.searchText,
    rawSearchText: parsed.searchText,
    title: parsed.title || "",
    author: parsed.author || "",
    subject: parsed.subject || "",
    isbn: parsed.isbn || "",
    intent: parsed.intent,
    aspects: parsed.questionAspects || [],
    axes: parsed.comparisonAxes || [],
    constraints: parsed.constraints || {},
    domain: parsed.domain || "general",
    tasks: parsed.tasks || [],
    editionPreferences: parsed.editionPreferences || [],
    sourcePreferences: parsed.sourcePreferences || [],
    spoilerPolicy: parsed.spoilerPolicy || "",
    strictness: parsed.strictness || "balanced",
    searchCategory: parsed.searchCategory || "all",
    definitionTerm: parsed.definitionTerm || "",
    studyFrame: parsed.studyFrame || {},
    identifierHints: parsed.identifierHints || {},
    contributorHints: parsed.contributorHints || {},
    audience: parsed.audience || "",
    criteria: parsed.evaluationCriteria || [],
    negatives: parsed.negativeConstraints || [],
    requestedOutput: parsed.requestedOutput || "",
    humanSearchPlan: parsed.humanSearchPlan || {},
    queryVariants: buildQueryVariants(parsed),
    googleQuery: buildGoogleQuery(parsed),
    locQuery: buildSourceQuery(parsed, "catalog"),
    wikiQuery: buildSourceQuery(parsed, "knowledge"),
    scholarlyQuery: buildSourceQuery(parsed, "scholarly"),
    studyQuery: buildSourceQuery(parsed, "study"),
    definitionQuery: buildSourceQuery(parsed, "definition"),
    scholarQuery: buildSourceQuery(parsed, "scholar"),
    publicDomainQuery: buildSourceQuery(parsed, "public-domain"),
    metadataQuery: buildSourceQuery(parsed, "metadata")
  };
}

function publicQueryPlan(queryPlan) {
  return {
    maxResults: queryPlan.maxResults,
    focus: queryPlan.focus,
    humanSearchPlan: queryPlan.humanSearchPlan,
    searchCategory: queryPlan.searchCategory,
    constraints: queryPlan.constraints,
    jobs: queryPlan.jobs.map((job) => ({
      label: job.label,
      intent: job.intent,
      searchText: job.searchText,
      title: job.title,
      author: job.author,
      subject: job.subject,
      isbn: job.isbn,
      aspects: job.aspects,
      axes: job.axes,
      constraints: job.constraints,
      domain: job.domain,
      tasks: job.tasks,
      editionPreferences: job.editionPreferences,
      sourcePreferences: job.sourcePreferences,
      spoilerPolicy: job.spoilerPolicy,
      strictness: job.strictness,
      searchCategory: job.searchCategory,
      definitionTerm: job.definitionTerm,
      studyFrame: job.studyFrame,
      identifierHints: job.identifierHints,
      contributorHints: job.contributorHints,
      audience: job.audience,
      criteria: job.criteria,
      negatives: job.negatives,
      requestedOutput: job.requestedOutput,
      queryVariants: job.queryVariants,
      sourceQueries: {
        google: job.googleQuery,
        catalog: job.locQuery,
        knowledge: job.wikiQuery,
        scholarly: job.scholarlyQuery,
        study: job.studyQuery,
        definition: job.definitionQuery,
        scholar: job.scholarQuery,
        publicDomain: job.publicDomainQuery,
        metadata: job.metadataQuery
      }
    }))
  };
}

async function openLibraryAdapter(queryPlan, context, source) {
  const results = [];
  for (const job of queryPlan.jobs) {
    const url = new URL("https://openlibrary.org/search.json");
    if (job.isbn) url.searchParams.set("isbn", job.isbn);
    else if (job.title && job.author) {
      url.searchParams.set("title", job.title);
      url.searchParams.set("author", job.author);
    } else if (job.title) url.searchParams.set("title", job.title);
    else if (job.author && !job.subject) url.searchParams.set("author", job.author);
    else url.searchParams.set("q", job.subject || job.searchText);
    url.searchParams.set("limit", String(MAX_RESULTS_PER_SOURCE));
    url.searchParams.set("fields", [
      "key",
      "title",
      "subtitle",
      "author_name",
      "first_publish_year",
      "cover_i",
      "isbn",
      "edition_count",
      "subject",
      "language",
      "publisher",
      "ratings_average",
      "ratings_count",
      "ia",
      "has_fulltext",
      "number_of_pages_median"
    ].join(","));

    const json = await fetchJson(url, context);
    results.push(...cleanList(json.docs).map((doc) => normalizeOpenLibrary(doc, job, source)));

    if (job.isbn) {
      try {
        const edition = await fetchJson(`https://openlibrary.org/isbn/${encodeURIComponent(job.isbn)}.json`, context);
        results.push(normalizeOpenLibraryEdition(edition, job, source));
      } catch {
        // Search results still provide a useful fallback for exact ISBN lookups.
      }
    }
  }
  return { records: results, message: `${results.length} catalog records` };
}

async function googleBooksAdapter(queryPlan, context, source) {
  const results = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "google", 2)) {
      const url = new URL("https://www.googleapis.com/books/v1/volumes");
      url.searchParams.set("q", query);
      url.searchParams.set("maxResults", String(MAX_RESULTS_PER_SOURCE));
      url.searchParams.set("printType", "books");
      url.searchParams.set("fields", "totalItems,items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,averageRating,ratingsCount,imageLinks,infoLink,previewLink,language))");
      const json = await fetchJson(url, context);
      results.push(...cleanList(json.items).map((item) => normalizeGoogleBook(item, { ...job, searchText: query }, source)));
    }
  }
  return { records: results, message: `${results.length} volume records` };
}

async function libraryOfCongressAdapter(queryPlan, context, source) {
  const results = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "catalog", 2)) {
      const url = new URL("https://www.loc.gov/books/");
      url.searchParams.set("fo", "json");
      url.searchParams.set("c", String(MAX_RESULTS_PER_SOURCE));
      url.searchParams.set("q", query);
      const json = await fetchJson(url, context);
      const records = json.content?.results || json.results || [];
      results.push(...cleanList(records).map((item) => normalizeLibraryOfCongress(item, { ...job, searchText: query }, source)));
    }
  }
  return { records: results, message: `${results.length} LOC records` };
}

async function wikidataAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "knowledge", 2)) {
      const searchUrl = new URL("https://www.wikidata.org/w/api.php");
      searchUrl.searchParams.set("action", "wbsearchentities");
      searchUrl.searchParams.set("format", "json");
      searchUrl.searchParams.set("language", "en");
      searchUrl.searchParams.set("origin", "*");
      searchUrl.searchParams.set("limit", "8");
      searchUrl.searchParams.set("search", query);
      const searchJson = await fetchJson(searchUrl, context);
      const candidates = rankWikidataCandidates(cleanList(searchJson.search), { ...job, searchText: query }).slice(0, 4);
      if (!candidates.length) continue;
      const ids = candidates.map((candidate) => candidate.id).filter(Boolean);
      const entityUrl = new URL("https://www.wikidata.org/w/api.php");
      entityUrl.searchParams.set("action", "wbgetentities");
      entityUrl.searchParams.set("format", "json");
      entityUrl.searchParams.set("languages", "en");
      entityUrl.searchParams.set("origin", "*");
      entityUrl.searchParams.set("props", "labels|descriptions|claims|sitelinks");
      entityUrl.searchParams.set("ids", ids.join("|"));
      const entityJson = await fetchJson(entityUrl, context);
      const entities = Object.values(entityJson.entities || {});
      const linkedIds = unique(entities.flatMap(extractLinkedWikidataIds)).slice(0, 60);
      const labels = linkedIds.length ? await fetchWikidataLabels(linkedIds, context) : {};
      records.push(...entities.map((entity) => normalizeWikidataEntity(entity, labels, { ...job, searchText: query }, source)).filter(Boolean));
    }
  }
  return { records, message: `${records.length} knowledge graph records` };
}

async function fetchWikidataLabels(ids, context) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("languages", "en");
  url.searchParams.set("origin", "*");
  url.searchParams.set("props", "labels");
  url.searchParams.set("ids", ids.join("|"));
  const json = await fetchJson(url, context);
  return Object.fromEntries(Object.entries(json.entities || {}).map(([id, entity]) => [id, entity.labels?.en?.value || id]));
}

async function wikipediaAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "knowledge", 2)) {
      const searchUrl = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("limit", "5");
      const searchJson = await fetchJson(searchUrl, context);
      const pages = cleanList(searchJson.pages).filter((page) => page.title || page.key).slice(0, 4);
      for (const page of pages) {
        const title = page.title || page.key;
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
        try {
          const summary = await fetchJson(summaryUrl, context);
          records.push(normalizeWikipediaSummary(summary, { ...job, searchText: query }, source));
        } catch {
          records.push(normalizeWikipediaSearchPage(page, { ...job, searchText: query }, source));
        }
      }
    }
  }
  return { records, message: `${records.length} article summaries` };
}

async function dbpediaAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    const url = new URL("https://lookup.dbpedia.org/api/search");
    url.searchParams.set("query", job.searchText);
    url.searchParams.set("type", "Book");
    url.searchParams.set("maxResults", String(Math.min(MAX_RESULTS_PER_SOURCE, 10)));
    url.searchParams.set("format", "json");
    const json = await fetchJson(url, context, {
      headers: { Accept: "application/json" }
    });
    records.push(...cleanList(json.docs).map((doc) => normalizeDbpediaDoc(doc, job, source)));
  }
  return { records, message: `${records.length} linked-data records` };
}

async function wiktionaryAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    const term = job.definitionTerm || job.searchText;
    const url = new URL("https://en.wiktionary.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("srlimit", String(MAX_RESULTS_PER_SOURCE));
    url.searchParams.set("srsearch", term);
    const json = await fetchJson(url, context);
    records.push(...cleanList(json.query?.search).map((item) => normalizeWiktionaryPage(item, job, source)));
  }
  return {
    records,
    state: records.length ? "online" : "partial",
    message: records.length ? `${records.length} definition records` : "No Wiktionary definition records"
  };
}

async function wikisourceAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    const url = new URL("https://en.wikisource.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("srlimit", String(MAX_RESULTS_PER_SOURCE));
    url.searchParams.set("srsearch", job.searchText);
    const json = await fetchJson(url, context);
    records.push(...cleanList(json.query?.search).map((item) => normalizeWikisourcePage(item, job, source)));
  }
  return { records, message: `${records.length} public-domain text pages` };
}

async function internetArchiveAdapter(queryPlan, context, source) {
  const results = [];
  for (const job of queryPlan.jobs) {
    const url = new URL("https://archive.org/advancedsearch.php");
    url.searchParams.set("q", buildArchiveQuery(job));
    ["identifier", "title", "creator", "date", "description", "subject", "mediatype", "collection", "downloads", "publicdate"].forEach((field) => {
      url.searchParams.append("fl[]", field);
    });
    url.searchParams.set("rows", String(MAX_RESULTS_PER_SOURCE));
    url.searchParams.set("output", "json");
    const json = await fetchJson(url, context);
    results.push(...cleanList(json.response?.docs).map((doc) => normalizeInternetArchive(doc, job, source)));
  }
  return { records: results, message: `${results.length} text records` };
}

async function gutendexAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    const url = new URL("https://gutendex.com/books/");
    url.searchParams.set("search", job.searchText);
    const json = await fetchJson(url, context);
    records.push(...cleanList(json.results).slice(0, MAX_RESULTS_PER_SOURCE).map((item) => normalizeGutendex(item, job, source)));
  }
  return { records, message: `${records.length} public-domain records` };
}

async function standardEbooksAdapter(queryPlan, _context, source) {
  const links = queryPlan.jobs.map((job) => ({
    sourceId: source.id,
    sourceName: source.name,
    label: `Search Standard Ebooks for ${job.label}`,
    url: `https://standardebooks.org/ebooks?query=${encodeURIComponent(job.searchText)}`,
    metadataOnly: true,
    note: "Curated public-domain ebook catalog search link."
  }));
  return {
    records: [],
    links,
    state: "metadata only",
    message: "Curated public-domain catalog link"
  };
}

async function librivoxAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    const url = new URL("https://librivox.org/api/feed/audiobooks/");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(MAX_RESULTS_PER_SOURCE));
    url.searchParams.set("title", job.title || job.searchText);
    if (job.author) url.searchParams.set("author", job.author);
    try {
      const json = await fetchJson(url, context);
      records.push(...cleanList(json.books).map((item) => normalizeLibriVoxBook(item, job, source)));
    } catch (error) {
      if (!/^404\b/.test(error.message || "")) throw error;
    }
  }
  return {
    records,
    state: records.length ? "online" : "partial",
    message: records.length ? `${records.length} public-domain audiobook records` : "No matching public-domain audiobook records"
  };
}

async function openAlexAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "scholarly", 2)) {
      const url = new URL("https://api.openalex.org/works");
      url.searchParams.set("search", query);
      url.searchParams.set("per-page", String(MAX_RESULTS_PER_SOURCE));
      url.searchParams.set("select", "id,display_name,authorships,publication_year,publication_date,ids,doi,type,primary_location,biblio,concepts,abstract_inverted_index,cited_by_count");
      if (context.contactEmail) url.searchParams.set("mailto", context.contactEmail);
      const json = await fetchJson(url, context);
      records.push(...cleanList(json.results).map((item) => normalizeOpenAlex(item, { ...job, searchText: query }, source)));
    }
  }
  return { records, message: `${records.length} scholarly graph records` };
}

async function crossrefAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "scholarly", 2)) {
      const url = new URL("https://api.crossref.org/works");
      url.searchParams.set("query.bibliographic", query);
      url.searchParams.set("rows", String(MAX_RESULTS_PER_SOURCE));
      url.searchParams.set("select", "DOI,title,author,published-print,published-online,issued,container-title,publisher,type,ISBN,subject,abstract,URL,is-referenced-by-count");
      if (context.contactEmail) url.searchParams.set("mailto", context.contactEmail);
      const json = await fetchJson(url, context);
      records.push(...cleanList(json.message?.items).map((item) => normalizeCrossref(item, { ...job, searchText: query }, source)));
    }
  }
  return { records, message: `${records.length} DOI records` };
}

async function dataCiteAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "scholarly", 2)) {
      const url = new URL("https://api.datacite.org/dois");
      url.searchParams.set("query", query);
      url.searchParams.set("page[size]", String(MAX_RESULTS_PER_SOURCE));
      const json = await fetchJson(url, context);
      records.push(...cleanList(json.data).map((item) => normalizeDataCite(item, { ...job, searchText: query }, source)));
    }
  }
  return { records, message: `${records.length} DataCite records` };
}

async function semanticScholarAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "scholarly", 2)) {
      const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
      url.searchParams.set("query", query);
      url.searchParams.set("limit", String(MAX_RESULTS_PER_SOURCE));
      url.searchParams.set("fields", "title,authors,year,abstract,externalIds,url,venue,publicationTypes,publicationDate,citationCount,isOpenAccess");
      const headers = context.env.SEMANTIC_SCHOLAR_API_KEY
        ? { "x-api-key": context.env.SEMANTIC_SCHOLAR_API_KEY }
        : {};
      const json = await fetchJson(url, context, { headers });
      records.push(...cleanList(json.data).map((item) => normalizeSemanticScholar(item, { ...job, searchText: query }, source)));
    }
  }
  return { records, message: `${records.length} paper/book records` };
}

async function googleScholarAdapter(queryPlan, _context, source) {
  const links = queryPlan.jobs.map((job) => ({
    sourceId: source.id,
    sourceName: source.name,
    label: `Search Google Scholar for ${job.label}`,
    url: `https://scholar.google.com/scholar?q=${encodeURIComponent(job.scholarQuery || job.studyQuery || job.searchText)}`,
    metadataOnly: true,
    note: "Safe link-out only. Atlas does not scrape Google Scholar pages or bypass access controls."
  }));
  return {
    records: [],
    links,
    state: "metadata only",
    message: "Scholar search link only"
  };
}

async function pubMedAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("term", buildPubMedTerm(job));
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retmax", String(MAX_RESULTS_PER_SOURCE));
    if (context.env.NCBI_API_KEY) searchUrl.searchParams.set("api_key", context.env.NCBI_API_KEY);
    const searchJson = await fetchJson(searchUrl, context);
    const ids = cleanList(searchJson.esearchresult?.idlist).slice(0, MAX_RESULTS_PER_SOURCE);
    if (!ids.length) continue;
    const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("id", ids.join(","));
    summaryUrl.searchParams.set("retmode", "json");
    if (context.env.NCBI_API_KEY) summaryUrl.searchParams.set("api_key", context.env.NCBI_API_KEY);
    const summaryJson = await fetchJson(summaryUrl, context);
    records.push(...ids.map((id) => summaryJson.result?.[id]).filter(Boolean).map((item) => normalizePubMed(item, job, source)));
  }
  return {
    records,
    state: records.length ? "online" : "partial",
    message: records.length ? `${records.length} PubMed records` : "No PubMed records"
  };
}

async function europePmcAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "study", 2)) {
      const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
      url.searchParams.set("query", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("pageSize", String(MAX_RESULTS_PER_SOURCE));
      url.searchParams.set("synonym", "true");
      const json = await fetchJson(url, context);
      records.push(...cleanList(json.resultList?.result).map((item) => normalizeEuropePmc(item, { ...job, searchText: query }, source)));
    }
  }
  return {
    records,
    state: records.length ? "online" : "partial",
    message: records.length ? `${records.length} Europe PMC records` : "No Europe PMC records"
  };
}

async function arxivAdapter(queryPlan, context, source) {
  const records = [];
  for (const job of queryPlan.jobs) {
    for (const query of sourceQueryVariants(job, "study", 1)) {
      const url = new URL("https://export.arxiv.org/api/query");
      url.searchParams.set("search_query", buildArxivQuery(query));
      url.searchParams.set("start", "0");
      url.searchParams.set("max_results", String(MAX_RESULTS_PER_SOURCE));
      const xml = await fetchText(url, context, { headers: { Accept: "application/atom+xml, application/xml, text/xml" } });
      records.push(...parseArxivEntries(xml).map((entry) => normalizeArxiv(entry, { ...job, searchText: query }, source)));
    }
  }
  return {
    records,
    state: records.length ? "online" : "partial",
    message: records.length ? `${records.length} arXiv records` : "No arXiv records"
  };
}

async function openCitationsAdapter(queryPlan, context, source) {
  const dois = unique(queryPlan.jobs.flatMap((job) => cleanList(job.identifierHints?.doi)));
  if (!dois.length) {
    return {
      records: [],
      state: "partial",
      message: "OpenCitations needs a DOI to retrieve citation counts"
    };
  }
  const records = [];
  for (const doi of dois.slice(0, 4)) {
    const url = new URL(`https://api.opencitations.net/index/v2/citation-count/doi:${encodeURIComponent(doi)}`);
    const json = await fetchJson(url, context);
    const first = cleanList(json)[0] || {};
    records.push(normalizeOpenCitations(first, doi, queryPlan.jobs[0], source));
  }
  return { records, message: `${records.length} OpenCitations DOI records` };
}

async function hathiTrustAdapter(queryPlan, context, source) {
  const identifiers = unique(queryPlan.jobs.flatMap((job) => [job.isbn, extractIsbn(job.searchText)]).filter(Boolean));
  if (!identifiers.length) {
    return {
      records: [],
      state: "partial",
      message: "HathiTrust needs an ISBN-style identifier for direct lookup"
    };
  }

  const records = [];
  for (const isbn of identifiers.slice(0, 3)) {
    const url = new URL(`https://catalog.hathitrust.org/api/volumes/brief/isbn/${encodeURIComponent(isbn)}.json`);
    const json = await fetchJson(url, context);
    const recs = json.records || {};
    for (const [recordId, record] of Object.entries(recs)) {
      records.push(normalizeHathiTrust(recordId, record, isbn, queryPlan.jobs[0], source));
    }
  }
  return { records, message: `${records.length} HathiTrust records` };
}

async function openTextbookLibraryAdapter(queryPlan, context, source) {
  const url = new URL("https://open.umn.edu/opentextbooks/textbooks.json");
  const json = await fetchJson(url, context);
  const allTextbooks = cleanList(json.data);
  const records = [];
  for (const job of queryPlan.jobs) {
    records.push(
      ...rankOpenTextbooks(allTextbooks, job)
        .slice(0, MAX_RESULTS_PER_SOURCE)
        .map((item) => normalizeOpenTextbook(item, job, source))
    );
  }
  return {
    records,
    state: records.length ? "online" : "partial",
    message: records.length ? `${records.length} open textbook records` : "No matching open textbooks"
  };
}

async function doabAdapter(queryPlan, _context, source) {
  const links = queryPlan.jobs.map((job) => ({
    sourceId: source.id,
    sourceName: source.name,
    label: `Search DOAB for ${job.label}`,
    url: `https://www.doabooks.org/doab?func=search&query=${encodeURIComponent(job.searchText)}&uiLanguage=en`,
    metadataOnly: true,
    note: "Directory of Open Access Books search link."
  }));
  return {
    records: [],
    links,
    state: "metadata only",
    message: "Open-access book directory link"
  };
}

async function bookBrainzAdapter(queryPlan, _context, source) {
  const links = queryPlan.jobs.map((job) => ({
    sourceId: source.id,
    sourceName: source.name,
    label: `Search BookBrainz for ${job.label}`,
    url: `https://bookbrainz.org/search?query=${encodeURIComponent(job.searchText)}&type=work`,
    metadataOnly: true,
    note: "Open bibliographic database search link."
  }));
  return {
    records: [],
    links,
    state: "metadata only",
    message: "Open bibliographic database link"
  };
}

async function annasArchiveAdapter(queryPlan, _context, source) {
  const links = queryPlan.jobs.map((job) => ({
    sourceId: source.id,
    sourceName: source.name,
    label: `Search metadata for ${job.label}`,
    url: `https://annas-archive.org/search?q=${encodeURIComponent(job.searchText)}`,
    metadataOnly: true,
    note: "Metadata/search link only. Atlas does not surface downloads or bypass access controls."
  }));
  return {
    records: [],
    links,
    state: "metadata only",
    message: "Metadata/search link only"
  };
}

async function scribdAdapter(queryPlan, _context, source) {
  const links = queryPlan.jobs.map((job) => ({
    sourceId: source.id,
    sourceName: source.name,
    label: `Search Scribd for ${job.label}`,
    url: `https://www.scribd.com/search?query=${encodeURIComponent(job.searchText)}`,
    metadataOnly: true,
    note: "Metadata/search link only. Atlas does not scrape protected previews or paid content."
  }));
  return {
    records: [],
    links,
    state: "metadata only",
    message: "Metadata/search link only"
  };
}

async function worldCatAdapter(queryPlan, context, source) {
  const records = [];
  const baseUrl = context.env.WORLDCAT_API_URL;
  for (const job of queryPlan.jobs) {
    const url = new URL(baseUrl);
    url.searchParams.set("q", job.searchText);
    url.searchParams.set("limit", String(MAX_RESULTS_PER_SOURCE));
    const json = await fetchJson(url, context, {
      headers: { Authorization: `Bearer ${context.env.WORLDCAT_API_KEY}` }
    });
    const items = json.entries || json.items || json.docs || json.results || [];
    records.push(...cleanList(items).map((item) => normalizeWorldCat(item, job, source)));
  }
  return { records, message: `${records.length} WorldCat records` };
}

async function fetchJson(url, context, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), context.timeoutMs || FETCH_TIMEOUT_MS);
  const headers = {
    Accept: "application/json",
    "User-Agent": `AtlasBibliotheca/2.0${context.contactEmail ? ` (${context.contactEmail})` : ""}`,
    ...(options.headers || {})
  };

  try {
    const response = await context.fetchImpl(url.toString(), {
      signal: controller.signal,
      headers
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timed out after ${context.timeoutMs || FETCH_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, context, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), context.timeoutMs || FETCH_TIMEOUT_MS);
  const headers = {
    Accept: "text/plain, text/xml, application/xml",
    "User-Agent": `AtlasBibliotheca/2.0${context.contactEmail ? ` (${context.contactEmail})` : ""}`,
    ...(options.headers || {})
  };

  try {
    const response = await context.fetchImpl(url.toString(), {
      signal: controller.signal,
      headers
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Timed out after ${context.timeoutMs || FETCH_TIMEOUT_MS} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOpenLibrary(doc, job, source) {
  const isbns = cleanList(doc.isbn).map(normalizeIsbn).filter(Boolean);
  const isbn = pickIsbn(isbns);
  const openKey = doc.key?.startsWith("/") ? doc.key : `/works/${doc.key || ""}`;
  return normalizeRecord({
    source,
    id: `openlibrary:${doc.key || doc.title}`,
    title: joinTitle(doc.title, doc.subtitle),
    authors: cleanList(doc.author_name),
    year: normalizeYear(doc.first_publish_year),
    publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : "",
    publisher: firstValue(doc.publisher),
    identifiers: { isbn: isbns },
    subjects: cleanList(doc.subject).slice(0, 12),
    description: "",
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "",
    sourceUrl: `https://openlibrary.org${openKey}`,
    accessType: doc.has_fulltext ? "catalog with full-text signal" : "catalog",
    job,
    evidenceFields: ["title", "authors", "first publish year", "editions", "subjects"],
    confidenceHints: {
      editionCount: Number(doc.edition_count || 0),
      ratingsCount: Number(doc.ratings_count || 0),
      rating: Number(doc.ratings_average || 0) || null,
      pageCount: Number(doc.number_of_pages_median || 0) || null,
      language: firstValue(doc.language)
    }
  });
}

function normalizeOpenLibraryEdition(edition, job, source) {
  const isbnValues = mergeLists(cleanList(edition.isbn_13), cleanList(edition.isbn_10), [job.isbn]);
  const coverId = firstValue(edition.covers);
  return normalizeRecord({
    source,
    id: `openlibrary-edition:${edition.key || job.isbn}`,
    title: joinTitle(edition.title, edition.subtitle),
    authors: parseByStatementAuthors(edition.by_statement),
    year: normalizeYear(edition.publish_date),
    publishedDate: edition.publish_date || "",
    publisher: firstValue(edition.publishers),
    identifiers: {
      isbn: isbnValues,
      lccn: cleanList(edition.lccn)
    },
    subjects: mergeLists(cleanList(edition.subjects), cleanList(edition.series), cleanList(edition.work_titles)).slice(0, 12),
    description: typeof edition.notes === "string" ? edition.notes : edition.notes?.value || "",
    coverUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : `https://covers.openlibrary.org/b/isbn/${job.isbn}-L.jpg`,
    sourceUrl: `https://openlibrary.org${edition.key || `/isbn/${job.isbn}`}`,
    accessType: "exact ISBN edition metadata",
    job,
    evidenceFields: ["exact ISBN", "edition title", "publisher", "publish date", "page count"],
    confidenceHints: {
      exactEdition: true,
      pageCount: Number(edition.number_of_pages || 0) || null,
      editionName: edition.edition_name || "",
      language: firstValue(cleanList(edition.languages).map((language) => language.key?.replace("/languages/", "")))
    }
  });
}

function normalizeGoogleBook(item, job, source) {
  const info = item.volumeInfo || {};
  const identifiers = cleanList(info.industryIdentifiers).map((entry) => entry.identifier);
  const isbns = identifiers.map(normalizeIsbn).filter(Boolean);
  const image = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
  return normalizeRecord({
    source,
    id: `google:${item.id}`,
    title: joinTitle(info.title, info.subtitle),
    authors: cleanList(info.authors),
    year: normalizeYear(info.publishedDate),
    publishedDate: info.publishedDate || "",
    publisher: info.publisher || "",
    identifiers: { isbn: isbns },
    subjects: cleanList(info.categories).slice(0, 10),
    description: stripHtml(info.description || ""),
    coverUrl: image ? image.replace(/^http:/, "https:") : "",
    sourceUrl: info.infoLink || info.previewLink || `https://books.google.com/books?id=${item.id}`,
    accessType: "catalog/preview metadata",
    job,
    evidenceFields: ["title", "authors", "publisher", "edition date", "description"],
    confidenceHints: {
      pageCount: Number(info.pageCount || 0) || null,
      rating: Number(info.averageRating || 0) || null,
      ratingsCount: Number(info.ratingsCount || 0) || null,
      language: info.language || ""
    }
  });
}

function normalizeLibraryOfCongress(item, job, source) {
  const detail = item.item || {};
  const description = firstValue(item.description) || firstValue(detail.summary) || firstValue(detail.notes);
  const contributors = cleanList(item.creator).length ? cleanList(item.creator) : cleanList(detail.contributors);
  const isbns = cleanList(detail.isbn).map(normalizeIsbn).filter(Boolean);
  return normalizeRecord({
    source,
    id: `loc:${firstValue(item.number_lccn) || item.url || item.title}`,
    title: item.title || detail.title || "",
    authors: contributors.map(cleanContributorName).filter(Boolean),
    year: normalizeYear(item.date || detail.date),
    publishedDate: String(item.date || detail.date || ""),
    publisher: firstValue(detail.created_published),
    identifiers: {
      isbn: isbns,
      lccn: cleanList(item.number_lccn).map(String)
    },
    subjects: mergeLists(cleanList(item.subject), cleanList(detail.subjects)).slice(0, 12),
    description: stripHtml(description || ""),
    coverUrl: normalizeUrl(firstValue(item.image_url)),
    sourceUrl: normalizeUrl(item.url || `https://www.loc.gov/books/?q=${encodeURIComponent(job.searchText)}`),
    accessType: "library catalog",
    job,
    evidenceFields: ["title", "contributors", "date", "subjects", "description"]
  });
}

function normalizeWikidataEntity(entity, labels, job, source) {
  if (!entity || entity.missing) return null;
  const claims = entity.claims || {};
  const publication = firstClaimTime(claims, "P577") || firstClaimTime(claims, "P571");
  const title = entity.labels?.en?.value || "";
  const description = entity.descriptions?.en?.value || "";
  return normalizeRecord({
    source,
    id: `wikidata:${entity.id}`,
    title,
    authors: labelsForClaim(claims, "P50", labels),
    year: publication.year,
    publishedDate: publication.display,
    publisher: labelsForClaim(claims, "P123", labels)[0] || "",
    identifiers: {
      isbn: mergeLists(getClaimStrings(claims, "P212"), getClaimStrings(claims, "P957")).map(normalizeIsbn).filter(Boolean),
      oclc: getClaimStrings(claims, "P243"),
      lccn: getClaimStrings(claims, "P1144")
    },
    subjects: mergeLists(
      labelsForClaim(claims, "P921", labels),
      labelsForClaim(claims, "P136", labels),
      labelsForClaim(claims, "P31", labels)
    ).slice(0, 12),
    description,
    coverUrl: "",
    sourceUrl: entity.sitelinks?.enwiki?.title
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(entity.sitelinks.enwiki.title.replace(/ /g, "_"))}`
      : `https://www.wikidata.org/wiki/${entity.id}`,
    accessType: "knowledge graph",
    job,
    evidenceFields: ["entity label", "description", "claims", "identifiers"],
    confidenceHints: {
      language: labelsForClaim(claims, "P407", labels)[0] || "",
      pageCount: firstClaimQuantity(claims, "P1104")
    }
  });
}

function normalizeWikipediaSummary(summary, job, source) {
  return normalizeRecord({
    source,
    id: `wikipedia:${summary.pageid || summary.title}`,
    title: summary.title || job.searchText,
    authors: [],
    year: null,
    publishedDate: "",
    publisher: "",
    identifiers: {},
    subjects: cleanList(summary.description),
    description: collapseWhitespace(summary.extract || ""),
    coverUrl: summary.thumbnail?.source || "",
    sourceUrl: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(String(summary.title || job.searchText).replace(/ /g, "_"))}`,
    accessType: "encyclopedia summary",
    job,
    evidenceFields: ["summary", "description", "article link"]
  });
}

function normalizeWikipediaSearchPage(page, job, source) {
  return normalizeRecord({
    source,
    id: `wikipedia:${page.id || page.key || page.title}`,
    title: page.title || page.key || job.searchText,
    authors: [],
    year: null,
    identifiers: {},
    subjects: cleanList(page.description),
    description: collapseWhitespace(page.excerpt || ""),
    sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.key || page.title || job.searchText).replace(/ /g, "_"))}`,
    accessType: "encyclopedia search result",
    job,
    evidenceFields: ["search result", "article link"]
  });
}

function normalizeDbpediaDoc(doc, job, source) {
  const title = stripHtml(firstValue(doc.label)).replace(/\s*\([^)]*\)\s*$/g, "").trim();
  const resource = firstValue(doc.resource);
  const categories = cleanList(doc.category).map((category) => {
    const raw = String(category).split("/").pop() || "";
    return raw.replace(/^Category:/i, "").replace(/_/g, " ");
  });
  return normalizeRecord({
    source,
    id: `dbpedia:${resource || title || job.searchText}`,
    title: title || job.searchText,
    authors: [],
    year: normalizeYear(`${firstValue(doc.comment)} ${categories.join(" ")}`),
    publishedDate: "",
    publisher: "",
    identifiers: {},
    subjects: categories.slice(0, 12),
    description: stripHtml(firstValue(doc.comment) || ""),
    coverUrl: "",
    sourceUrl: resource ? resource.replace(/^http:/, "https:") : `https://dbpedia.org/page/${encodeURIComponent(job.searchText.replace(/ /g, "_"))}`,
    accessType: "linked data knowledge graph",
    job,
    evidenceFields: ["entity label", "abstract", "categories", "resource link"],
    confidenceHints: {
      refCount: Number(firstValue(doc.refCount) || 0) || null,
      score: Number(firstValue(doc.score) || 0) || null
    }
  });
}

function normalizeWiktionaryPage(item, job, source) {
  const title = item.title || job.definitionTerm || job.searchText;
  return normalizeRecord({
    source,
    id: `wiktionary:${item.pageid || title}`,
    title,
    authors: [],
    year: null,
    publishedDate: "",
    publisher: "Wiktionary",
    identifiers: {},
    subjects: ["Definition", "Lexical reference"],
    description: stripHtml(item.snippet || ""),
    coverUrl: "",
    sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(String(title).replace(/ /g, "_"))}`,
    accessType: "definition/reference entry",
    job,
    evidenceFields: ["term", "definition snippet", "reference page"],
    confidenceHints: { format: "definition" }
  });
}

function normalizeWikisourcePage(item, job, source) {
  const title = item.title || job.searchText;
  return normalizeRecord({
    source,
    id: `wikisource:${item.pageid || title}`,
    title,
    authors: [],
    year: null,
    publishedDate: "",
    publisher: "Wikisource",
    identifiers: {},
    subjects: ["Public domain", "Primary text"],
    description: stripHtml(item.snippet || ""),
    coverUrl: "",
    sourceUrl: `https://en.wikisource.org/wiki/${encodeURIComponent(String(title).replace(/ /g, "_"))}`,
    accessType: "public-domain text index",
    job,
    evidenceFields: ["page title", "search snippet", "public-domain index"]
  });
}

function normalizeInternetArchive(doc, job, source) {
  return normalizeRecord({
    source,
    id: `ia:${doc.identifier}`,
    title: firstValue(doc.title) || job.searchText,
    authors: cleanList(doc.creator).map(cleanContributorName),
    year: normalizeYear(doc.date || doc.publicdate),
    publishedDate: String(firstValue(doc.date) || doc.publicdate || ""),
    publisher: "",
    identifiers: {},
    subjects: cleanList(doc.subject).slice(0, 12),
    description: stripHtml(firstValue(doc.description) || ""),
    coverUrl: doc.identifier ? `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}` : "",
    sourceUrl: doc.identifier ? `https://archive.org/details/${encodeURIComponent(doc.identifier)}` : "https://archive.org/details/texts",
    accessType: "digital library metadata",
    job,
    evidenceFields: ["title", "creator", "date", "collection", "text availability"],
    confidenceHints: { downloads: Number(doc.downloads || 0) || null }
  });
}

function normalizeGutendex(item, job, source) {
  const formats = item.formats || {};
  return normalizeRecord({
    source,
    id: `gutendex:${item.id}`,
    title: item.title || job.searchText,
    authors: cleanList(item.authors).map((author) => author.name).filter(Boolean),
    year: normalizeYear(firstValue(cleanList(item.authors).map((author) => author.birth_year)) || ""),
    publishedDate: "",
    publisher: "Project Gutenberg",
    identifiers: {},
    subjects: mergeLists(cleanList(item.subjects), cleanList(item.bookshelves)).slice(0, 12),
    description: cleanList(item.summaries)[0] || "",
    coverUrl: formats["image/jpeg"] || "",
    sourceUrl: formats["text/html"] || `https://www.gutenberg.org/ebooks/${item.id}`,
    accessType: "public-domain catalog",
    job,
    evidenceFields: ["title", "authors", "subjects", "download count"],
    confidenceHints: { downloads: Number(item.download_count || 0) || null }
  });
}

function normalizeLibriVoxBook(item, job, source) {
  const authors = cleanList(item.authors).map((author) => collapseWhitespace(`${author.first_name || ""} ${author.last_name || ""}`)).filter(Boolean);
  return normalizeRecord({
    source,
    id: `librivox:${item.id || item.url_librivox || item.title}`,
    title: item.title || job.searchText,
    authors,
    year: normalizeYear(item.copyright_year),
    publishedDate: item.copyright_year || "",
    publisher: "LibriVox",
    identifiers: {},
    subjects: ["Audiobook", "Public domain"],
    description: stripHtml(item.description || ""),
    coverUrl: "",
    sourceUrl: item.url_librivox || item.url_project || "https://librivox.org/",
    accessType: "public-domain audiobook catalog",
    job,
    evidenceFields: ["title", "authors", "description", "runtime", "language"],
    confidenceHints: {
      durationSeconds: Number(item.totaltimesecs || 0) || null,
      language: item.language || "",
      format: "audiobook"
    }
  });
}

function normalizeOpenAlex(item, job, source) {
  const authors = cleanList(item.authorships).map((entry) => entry.author?.display_name).filter(Boolean);
  return normalizeRecord({
    source,
    id: `openalex:${item.id}`,
    title: item.display_name || job.searchText,
    authors,
    year: normalizeYear(item.publication_year),
    publishedDate: item.publication_date || "",
    publisher: item.primary_location?.source?.display_name || "",
    identifiers: {
      doi: cleanList(item.doi || item.ids?.doi).map(normalizeDoi),
      isbn: cleanList(item.biblio?.isbn).map(normalizeIsbn).filter(Boolean)
    },
    subjects: cleanList(item.concepts).map((concept) => concept.display_name).filter(Boolean).slice(0, 12),
    description: abstractFromInvertedIndex(item.abstract_inverted_index),
    coverUrl: "",
    sourceUrl: item.id || item.primary_location?.landing_page_url || "",
    accessType: item.type || "scholarly metadata",
    job,
    evidenceFields: ["title", "authors", "publication year", "concepts", "doi"],
    confidenceHints: { citations: Number(item.cited_by_count || 0) || null }
  });
}

function normalizeCrossref(item, job, source) {
  return normalizeRecord({
    source,
    id: `crossref:${item.DOI || firstValue(item.title)}`,
    title: firstValue(item.title) || job.searchText,
    authors: cleanList(item.author).map(formatCrossrefAuthor).filter(Boolean),
    year: normalizeYear(datePartsToString(item["published-print"] || item["published-online"] || item.issued)),
    publishedDate: datePartsToString(item["published-print"] || item["published-online"] || item.issued),
    publisher: item.publisher || "",
    identifiers: {
      doi: cleanList(item.DOI).map(normalizeDoi),
      isbn: cleanList(item.ISBN).map(normalizeIsbn).filter(Boolean)
    },
    subjects: mergeLists(cleanList(item.subject), cleanList(item["container-title"])).slice(0, 12),
    description: stripHtml(item.abstract || ""),
    coverUrl: "",
    sourceUrl: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
    accessType: item.type || "doi metadata",
    job,
    evidenceFields: ["title", "authors", "publisher", "doi", "issued date"],
    confidenceHints: { citations: Number(item["is-referenced-by-count"] || 0) || null }
  });
}

function normalizeDataCite(item, job, source) {
  const attrs = item.attributes || {};
  return normalizeRecord({
    source,
    id: `datacite:${item.id || attrs.doi}`,
    title: firstValue(cleanList(attrs.titles).map((title) => title.title)) || job.searchText,
    authors: cleanList(attrs.creators).map((creator) => creator.name).filter(Boolean),
    year: normalizeYear(attrs.publicationYear),
    publishedDate: String(attrs.publicationYear || ""),
    publisher: attrs.publisher || "",
    identifiers: {
      doi: cleanList(attrs.doi).map(normalizeDoi),
      isbn: cleanList(attrs.relatedIdentifiers).filter((entry) => /isbn/i.test(entry.relatedIdentifierType || "")).map((entry) => normalizeIsbn(entry.relatedIdentifier)).filter(Boolean)
    },
    subjects: cleanList(attrs.subjects).map((subject) => subject.subject).filter(Boolean).slice(0, 12),
    description: firstValue(cleanList(attrs.descriptions).map((description) => description.description)) || "",
    coverUrl: "",
    sourceUrl: attrs.url || (attrs.doi ? `https://doi.org/${attrs.doi}` : ""),
    accessType: attrs.types?.resourceTypeGeneral || "research metadata",
    job,
    evidenceFields: ["title", "creators", "doi", "publication year", "subjects"]
  });
}

function normalizeSemanticScholar(item, job, source) {
  return normalizeRecord({
    source,
    id: `semantic:${item.paperId || item.url || item.title}`,
    title: item.title || job.searchText,
    authors: cleanList(item.authors).map((author) => author.name).filter(Boolean),
    year: normalizeYear(item.year || item.publicationDate),
    publishedDate: item.publicationDate || String(item.year || ""),
    publisher: item.venue || "",
    identifiers: {
      doi: cleanList(item.externalIds?.DOI).map(normalizeDoi),
      isbn: cleanList(item.externalIds?.ISBN).map(normalizeIsbn).filter(Boolean)
    },
    subjects: cleanList(item.publicationTypes).slice(0, 12),
    description: item.abstract || "",
    coverUrl: "",
    sourceUrl: item.url || "",
    accessType: item.isOpenAccess ? "open scholarly metadata" : "scholarly metadata",
    job,
    evidenceFields: ["title", "authors", "abstract", "year", "external ids"],
    confidenceHints: { citations: Number(item.citationCount || 0) || null }
  });
}

function normalizePubMed(item, job, source) {
  const articleIds = cleanList(item.articleids);
  const doi = articleIds.find((entry) => /doi/i.test(entry.idtype || ""))?.value || "";
  return normalizeRecord({
    source,
    id: `pubmed:${item.uid || item.articleids?.[0]?.value || item.title}`,
    title: item.title || job.searchText,
    authors: cleanList(item.authors).map((author) => author.name).filter(Boolean),
    year: normalizeYear(item.pubdate || item.epubdate),
    publishedDate: item.pubdate || item.epubdate || "",
    publisher: item.fulljournalname || item.source || "",
    identifiers: {
      doi: cleanList(doi).map(normalizeDoi)
    },
    subjects: mergeLists(cleanList(item.pubtype), cleanList(item.attributes), [item.source]).slice(0, 12),
    description: item.sorttitle || "",
    coverUrl: "",
    sourceUrl: item.uid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(item.uid)}/` : "https://pubmed.ncbi.nlm.nih.gov/",
    accessType: "biomedical literature metadata",
    job,
    evidenceFields: ["title", "authors", "journal", "publication date", "publication type"],
    confidenceHints: {
      format: "study",
      studyType: firstValue(item.pubtype),
      source: item.source || ""
    }
  });
}

function normalizeEuropePmc(item, job, source) {
  const url = item.doi
    ? `https://doi.org/${normalizeDoi(item.doi)}`
    : item.pmid ? `https://europepmc.org/article/MED/${encodeURIComponent(item.pmid)}` : item.pmcid ? `https://europepmc.org/article/PMC/${encodeURIComponent(item.pmcid)}` : "";
  return normalizeRecord({
    source,
    id: `europepmc:${item.id || item.pmid || item.doi || item.title}`,
    title: item.title || job.searchText,
    authors: splitAuthorString(item.authorString),
    year: normalizeYear(item.firstPublicationDate || item.pubYear),
    publishedDate: item.firstPublicationDate || item.pubYear || "",
    publisher: item.journalTitle || item.source || "",
    identifiers: {
      doi: cleanList(item.doi).map(normalizeDoi)
    },
    subjects: mergeLists(cleanList(item.pubTypeList?.pubType), cleanList(item.meshHeadingList?.meshHeading).map((entry) => entry.descriptorName), [item.source]).slice(0, 12),
    description: item.abstractText || "",
    coverUrl: "",
    sourceUrl: url || "https://europepmc.org/",
    accessType: item.isOpenAccess === "Y" ? "open literature metadata" : "literature metadata",
    job,
    evidenceFields: ["title", "authors", "journal", "abstract", "doi", "publication type"],
    confidenceHints: {
      format: "study",
      citations: Number(item.citedByCount || 0) || null,
      isOpenAccess: item.isOpenAccess === "Y"
    }
  });
}

function normalizeArxiv(entry, job, source) {
  return normalizeRecord({
    source,
    id: `arxiv:${entry.id || entry.title}`,
    title: entry.title || job.searchText,
    authors: entry.authors,
    year: normalizeYear(entry.published),
    publishedDate: entry.published || "",
    publisher: "arXiv",
    identifiers: {
      doi: cleanList(entry.doi).map(normalizeDoi)
    },
    subjects: entry.categories,
    description: entry.summary || "",
    coverUrl: "",
    sourceUrl: entry.id || "",
    accessType: "preprint metadata",
    job,
    evidenceFields: ["title", "authors", "abstract", "published date", "categories"],
    confidenceHints: {
      format: "preprint",
      primaryCategory: entry.categories?.[0] || ""
    }
  });
}

function normalizeOpenCitations(item, doi, job, source) {
  const count = Number(item.count || item["citation-count"] || 0) || 0;
  return normalizeRecord({
    source,
    id: `opencitations:${doi}`,
    title: job.title || job.subject || job.searchText || `DOI ${doi}`,
    authors: [],
    year: null,
    publishedDate: "",
    publisher: "OpenCitations",
    identifiers: { doi: [doi] },
    subjects: ["Open citations", "DOI citation count"],
    description: `OpenCitations reports ${count} open citation${count === 1 ? "" : "s"} for DOI ${doi}.`,
    coverUrl: "",
    sourceUrl: `https://opencitations.net/index/coci/browser/doi:${encodeURIComponent(doi)}`,
    accessType: "open DOI citation index",
    job,
    evidenceFields: ["doi", "open citation count"],
    confidenceHints: {
      citations: count,
      format: "citation index"
    }
  });
}

function normalizeHathiTrust(recordId, record, isbn, job, source) {
  return normalizeRecord({
    source,
    id: `hathi:${recordId}`,
    title: firstValue(record.titles) || job.searchText,
    authors: cleanList(record.authors).map(cleanContributorName),
    year: normalizeYear(firstValue(record.publishDates)),
    publishedDate: firstValue(record.publishDates) || "",
    publisher: firstValue(record.publishers),
    identifiers: {
      isbn: mergeLists(cleanList(record.isbns), [isbn]).map(normalizeIsbn).filter(Boolean),
      oclc: cleanList(record.oclcs),
      lccn: cleanList(record.lccns)
    },
    subjects: cleanList(record.subjects).slice(0, 12),
    description: "",
    coverUrl: "",
    sourceUrl: `https://catalog.hathitrust.org/Record/${encodeURIComponent(recordId)}`,
    accessType: "bibliographic catalog",
    job,
    evidenceFields: ["title", "authors", "publisher", "identifiers", "holdings"]
  });
}

function normalizeOpenTextbook(item, job, source) {
  const authors = cleanList(item.contributors)
    .filter((contributor) => !contributor.contribution || /author/i.test(contributor.contribution))
    .map(formatOpenTextbookContributor)
    .filter(Boolean);
  const subjects = cleanList(item.subjects).map((subject) => subject.name).filter(Boolean);
  const publishers = cleanList(item.publishers).map((publisher) => publisher.name).filter(Boolean);
  const formats = cleanList(item.formats).map((format) => format.type).filter(Boolean);
  return normalizeRecord({
    source,
    id: `otl:${item.id || item.url || item.title}`,
    title: item.title || job.searchText,
    authors,
    year: normalizeYear(item.copyright_year),
    publishedDate: String(item.copyright_year || ""),
    publisher: firstValue(publishers),
    identifiers: {
      isbn: mergeLists([item.ISBN13, item.ISBN10], cleanList(item.formats).map((format) => format.isbn)).map(normalizeIsbn).filter(Boolean)
    },
    subjects,
    description: item.description || "",
    coverUrl: "",
    sourceUrl: item.url || "https://open.umn.edu/opentextbooks",
    accessType: `open textbook${formats.length ? ` (${formats.slice(0, 3).join(", ")})` : ""}`,
    job,
    evidenceFields: ["title", "authors", "subjects", "license", "formats", "reviews"],
    confidenceHints: {
      rating: Number(item.rating || 0) || null,
      ratingsCount: Number(item.textbook_reviews_count || 0) || null,
      language: item.language || "",
      format: "textbook",
      license: item.license || ""
    }
  });
}

function normalizeWorldCat(item, job, source) {
  return normalizeRecord({
    source,
    id: `worldcat:${item.oclcNumber || item.oclc || item.id || item.title || job.searchText}`,
    title: item.title || item.name || job.searchText,
    authors: cleanList(item.author || item.authors || item.creator).map(cleanContributorName),
    year: normalizeYear(item.date || item.publicationDate || item.year),
    publishedDate: String(item.date || item.publicationDate || item.year || ""),
    publisher: item.publisher || firstValue(item.publishers),
    identifiers: {
      isbn: cleanList(item.isbn || item.isbns).map(normalizeIsbn).filter(Boolean),
      oclc: cleanList(item.oclcNumber || item.oclc)
    },
    subjects: cleanList(item.subjects || item.subject).slice(0, 12),
    description: stripHtml(item.description || item.summary || ""),
    coverUrl: "",
    sourceUrl: item.url || item.link || `https://search.worldcat.org/search?q=${encodeURIComponent(job.searchText)}`,
    accessType: "credentialed library catalog",
    job,
    evidenceFields: ["title", "authors", "identifiers", "holdings metadata"]
  });
}

function normalizeRecord(input) {
  const identifiers = normalizeIdentifiers(input.identifiers || {});
  const isbn = pickIsbn(identifiers.isbn);
  const sourceUrl = sanitizeExternalUrl(input.sourceUrl);
  return {
    id: input.id || `${input.source.id}:${hashString(`${input.title}:${sourceUrl}`)}`,
    sourceId: input.source.id,
    sourceName: input.source.name,
    sourceKind: input.source.kind,
    title: collapseWhitespace(input.title || ""),
    authors: cleanList(input.authors).map(cleanContributorName).filter(Boolean).slice(0, 8),
    year: normalizeYear(input.year),
    publishedDate: collapseWhitespace(input.publishedDate || ""),
    publisher: collapseWhitespace(input.publisher || ""),
    identifiers,
    isbn,
    subjects: cleanList(input.subjects).map(stripHtml).map(collapseWhitespace).filter(Boolean).slice(0, 14),
    description: collapseWhitespace(stripHtml(input.description || "")).slice(0, 1200),
    coverUrl: sanitizeExternalUrl(input.coverUrl),
    sourceUrl,
    accessType: collapseWhitespace(input.accessType || input.source.kind || "metadata"),
    jobLabel: input.job?.label || "",
    evidenceFields: cleanList(input.evidenceFields).slice(0, 8),
    confidenceHints: input.confidenceHints || {},
    metadataOnly: Boolean(input.metadataOnly || input.source.metadataOnly)
  };
}

function normalizeIdentifiers(identifiers) {
  return {
    isbn: unique(cleanList(identifiers.isbn).map(normalizeIsbn).filter((value) => value.length === 10 || value.length === 13)),
    doi: unique(cleanList(identifiers.doi).map(normalizeDoi).filter(Boolean)),
    oclc: unique(cleanList(identifiers.oclc).map((value) => String(value).replace(/^ocn|^ocm/i, "").trim()).filter(Boolean)),
    lccn: unique(cleanList(identifiers.lccn).map((value) => String(value).trim()).filter(Boolean))
  };
}

function assignCitations(records) {
  return records.map((record, index) => ({
    ...record,
    citationId: `S${index + 1}`
  }));
}

function toCitation(record) {
  return {
    id: record.citationId,
    sourceId: record.sourceId,
    sourceName: record.sourceName,
    title: record.title,
    authors: record.authors,
    year: record.year,
    url: record.sourceUrl,
    evidenceFields: record.evidenceFields,
    metadataOnly: record.metadataOnly
  };
}

function collectReferencedCitationIds(answer, works) {
  const ids = new Set();
  const add = (values) => {
    cleanList(values).forEach((value) => {
      const id = String(value || "").trim();
      if (/^S\d+$/i.test(id)) ids.add(id);
    });
  };

  cleanList(answer?.sections).forEach((section) => add(section.citations));
  add(answer?.citations);
  cleanList(answer?.researchBrief?.rankingTable).forEach((row) => add(row.citations));
  cleanList(works).slice(0, 14).forEach((work) => add(work.citations));
  return ids;
}

function limitRecordsForResponse(records, works, referencedIds = new Set(), limit = MAX_RESPONSE_RECORDS) {
  if (!records.length) return [];

  const workPriority = new Map();
  cleanList(works).forEach((work, workIndex) => {
    cleanList(work.citations).forEach((citationId, citationIndex) => {
      const score = 1000 - workIndex * 18 - citationIndex;
      workPriority.set(citationId, Math.max(workPriority.get(citationId) || 0, score));
    });
  });

  return [...records]
    .sort((a, b) => {
      const referenceDelta = Number(referencedIds.has(b.citationId)) - Number(referencedIds.has(a.citationId));
      if (referenceDelta) return referenceDelta;
      const workDelta = (workPriority.get(b.citationId) || 0) - (workPriority.get(a.citationId) || 0);
      if (workDelta) return workDelta;
      return recordResponseWeight(b) - recordResponseWeight(a);
    })
    .slice(0, limit)
    .map(compactRecordForResponse);
}

function recordResponseWeight(record) {
  let score = 0;
  if (record.title) score += 8;
  if (record.authors?.length) score += 8;
  if (record.year) score += 5;
  if (record.publisher) score += 3;
  if (record.description) score += 7;
  if (record.coverUrl) score += 3;
  if (record.identifiers?.isbn?.length) score += 8;
  if (record.identifiers?.doi?.length) score += 6;
  if (record.identifiers?.oclc?.length || record.identifiers?.lccn?.length) score += 5;
  score += cleanList(record.subjects).length;
  score += cleanList(record.evidenceFields).length * 2;
  score += Math.min(18, Number(record.confidenceHints?.citations || record.confidenceHints?.refCount || 0) / 10 || 0);
  score += Math.min(10, Number(record.confidenceHints?.editionCount || 0) || 0);
  if (/catalog|knowledge graph|scholarly|archive|public-domain/i.test(record.sourceKind || record.accessType || "")) score += 4;
  if (record.metadataOnly) score -= 12;
  return score;
}

function compactRecordForResponse(record) {
  return {
    ...record,
    authors: cleanList(record.authors).slice(0, 6),
    subjects: cleanList(record.subjects).slice(0, 10),
    description: collapseWhitespace(record.description || "").slice(0, 620),
    evidenceFields: cleanList(record.evidenceFields).slice(0, 6),
    confidenceHints: compactConfidenceHints(record.confidenceHints || {})
  };
}

function compactConfidenceHints(hints) {
  const allowed = [
    "exactEdition",
    "editionCount",
    "ratingsCount",
    "rating",
    "pageCount",
    "language",
    "citations",
    "refCount",
    "downloads",
    "repository"
  ];
  return allowed.reduce((accumulator, key) => {
    if (hints[key] !== undefined && hints[key] !== null && hints[key] !== "") accumulator[key] = hints[key];
    return accumulator;
  }, {});
}

function fuseRecords(records, parsed) {
  const groups = [];
  for (const record of records) {
    const keys = fusionKeys(record);
    let group = groups.find((candidate) => keys.some((key) => candidate.keys.has(key)));
    if (!group) {
      group = groups.find((candidate) => candidate.records.some((existing) => canMergeRecords(existing, record)));
    }
    if (!group) {
      group = { keys: new Set(), records: [] };
      groups.push(group);
    }
    keys.forEach((key) => group.keys.add(key));
    group.records.push(record);
  }

  const rankedWorks = groups
    .map((group, index) => buildWork(group.records, parsed, index))
    .sort((a, b) => b.confidence - a.confidence);

  const works = filterWorksForIntent(rankedWorks, parsed).slice(0, 36);

  const conflicts = works.flatMap((work) => work.conflicts.map((conflict) => ({
    workId: work.id,
    title: work.title,
    ...conflict
  })));

  return { works, conflicts };
}

function filterWorksForIntent(works, parsed) {
  if (!(parsed.domain === "literary" && parsed.intent === "compare")) return works;
  const filtered = works.filter((work) => work.confidence >= 70);
  return filtered.length >= Math.min(6, works.length) ? filtered : works;
}

function constrainRecordsForIntent(records, parsed) {
  if (parsed.isbn) {
    const exact = records.filter((record) => record.identifiers.isbn.includes(parsed.isbn));
    if (exact.length) return exact;
  }
  if (parsed.domain === "literary") {
    const filtered = records.filter((record) => recordMatchesLiteraryDomain(record));
    if (filtered.length) return filtered;
  }
  return records;
}

function buildWork(group, parsed, index) {
  const sorted = [...group].sort((a, b) => recordQuality(b, parsed) - recordQuality(a, parsed));
  const primary = sorted[0];
  const allSubjects = mergeLists(...group.map((record) => record.subjects)).slice(0, 18);
  const identifiers = normalizeIdentifiers({
    isbn: group.flatMap((record) => record.identifiers.isbn),
    doi: group.flatMap((record) => record.identifiers.doi),
    oclc: group.flatMap((record) => record.identifiers.oclc),
    lccn: group.flatMap((record) => record.identifiers.lccn)
  });
  const sources = group.map((record) => ({
    id: record.sourceId,
    name: record.sourceName,
    kind: record.sourceKind,
    url: record.sourceUrl,
    citationId: record.citationId,
    accessType: record.accessType,
    metadataOnly: record.metadataOnly,
    evidenceFields: record.evidenceFields
  }));
  const conflicts = detectWorkConflicts(group);
  const year = pickBestYear(group);
  const confidence = clamp(Math.round(recordQuality(primary, parsed) + sourceAgreementBonus(group) - conflicts.length * 6 - authorFragmentationPenalty(group, parsed)), 8, 99);
  const displayIsbn = parsed.isbn && identifiers.isbn.includes(parsed.isbn) ? parsed.isbn : pickIsbn(identifiers.isbn);
  const analytics = buildWorkAnalytics(group, parsed, conflicts);
  return {
    id: `work:${hashString(`${fusionKey(primary)}:${index}`)}`,
    title: primary.title || "Untitled record",
    authors: mergeLists(...group.map((record) => record.authors)).slice(0, 8),
    year,
    firstPublishYear: year,
    publishedDate: primary.publishedDate || "",
    publisher: firstValue(group.map((record) => record.publisher).filter(Boolean)),
    identifiers,
    isbn: displayIsbn,
    isbns: identifiers.isbn,
    subjects: allSubjects,
    description: chooseBestDescription(group),
    coverUrl: firstValue(group.map((record) => record.coverUrl).filter(Boolean)),
    cover: firstValue(group.map((record) => record.coverUrl).filter(Boolean)),
    sourceCount: unique(group.map((record) => record.sourceId)).length,
    sources: dedupeSources(sources),
    citations: group.map((record) => record.citationId),
    confidence,
    conflicts,
    accessTypes: unique(group.map((record) => record.accessType).filter(Boolean)),
    jobLabels: unique(group.map((record) => record.jobLabel).filter(Boolean)),
    evidenceDensity: group.reduce((sum, record) => sum + record.evidenceFields.length, 0),
    analytics,
    constraintFit: analytics.constraintFit,
    intelligenceSignals: analytics.signals
  };
}

function recordQuality(record, parsed) {
  let score = 22;
  const queryTitle = normalizeKey(parsed.intent === "compare" ? record.jobLabel || parsed.searchText : parsed.title || parsed.searchText);
  const recordTitle = normalizeKey(record.title);
  if (parsed.isbn && record.identifiers.isbn.includes(parsed.isbn)) score += 34;
  else if (parsed.isbn) score -= 45;
  if (record.confidenceHints.exactEdition) score += 18;
  const titleScore = titleMatchScore(queryTitle, recordTitle);
  score += titleScore;
  if (shouldPenalizeTitleMismatch(parsed, queryTitle, recordTitle, titleScore)) score -= 42;
  if (parsed.author && includesNormalized(record.authors, parsed.author)) score += 16;
  if (parsed.subject && includesNormalized(record.subjects, parsed.subject)) score += 10;
  if (record.authors.length) score += 6;
  if (record.year) score += 5;
  if (record.description) score += 7;
  if (record.coverUrl) score += 3;
  if (record.identifiers.isbn.length || record.identifiers.doi.length || record.identifiers.oclc.length) score += 8;
  if (/book|catalog|library|public-domain|volume|text/i.test(record.accessType)) score += 4;
  score += domainQualityDelta(record, parsed);
  score += constraintQualityDelta(record, parsed.constraints || {});
  if (/film|movie|album|song|game/i.test(`${record.accessType} ${record.description}`)) score -= 18;
  if (record.metadataOnly) score -= 20;
  return score;
}

function titleMatchScore(queryTitle, recordTitle) {
  if (!queryTitle || !recordTitle) return 0;
  if (recordTitle === queryTitle) return 28;

  const queryTokens = queryTitle.split(" ").filter(Boolean);
  const recordTokens = recordTitle.split(" ").filter(Boolean);
  if (recordTitle.startsWith(`${queryTitle} `)) {
    if (queryTokens.length > 1) return 22;
    const next = recordTokens[1] || "";
    if (/^(and|messiah|children|chapterhouse|heretics|god|prequel|series|short|stories|empire|earth|edge|trilogy|franchise|novel|house)$/i.test(next)) return 20;
    return 8;
  }
  if (queryTokens.length >= 2 && (recordTitle.includes(queryTitle) || queryTitle.includes(recordTitle))) return 15;
  if (queryTokens.length === 1 && recordTokens.includes(queryTitle)) return 8;
  return 0;
}

function shouldPenalizeTitleMismatch(parsed, queryTitle, recordTitle, titleScore) {
  if (!queryTitle || !recordTitle || titleScore > 0 || parsed.isbn || parsed.subject) return false;
  const titleDriven = parsed.title || parsed.compareTerms?.length || ["author", "publication", "themes", "summary"].includes(parsed.intent);
  return Boolean(titleDriven);
}

function domainQualityDelta(record, parsed) {
  if (parsed.domain !== "literary") return 0;

  let score = 0;
  if (hasLiterarySignal(record)) score += 18;
  if (hasBookIdentity(record)) score += 10;
  if (isProbablyScholarlyNonwork(record) && !hasLiterarySignal(record)) score -= 32;
  if (record.identifiers?.doi?.length && !record.identifiers?.isbn?.length && !hasLiterarySignal(record)) score -= 12;
  if (hasNonLiteraryScienceSignal(record) && !hasLiterarySignal(record)) score -= 18;
  return score;
}

function recordMatchesLiteraryDomain(record) {
  if (hasLiterarySignal(record)) return true;
  if (hasNonLiteraryScienceSignal(record)) return false;
  if (hasBookIdentity(record) && !isProbablyScholarlyNonwork(record)) return true;
  return false;
}

function hasBookIdentity(record) {
  return Boolean(
    record.identifiers?.isbn?.length ||
    record.identifiers?.oclc?.length ||
    record.identifiers?.lccn?.length ||
    /\b(book|catalog|library|public domain|public-domain|ebook|e-book|audiobook|volume|text)\b/i.test(`${record.accessType || ""} ${record.sourceKind || ""}`)
  );
}

function hasLiterarySignal(record) {
  const text = normalizeKey(`${record.title} ${record.authors?.join(" ") || ""} ${record.subjects?.join(" ") || ""} ${record.description || ""} ${record.publisher || ""} ${record.sourceUrl || ""}`);
  return /\b(fiction|novel|literary|american literature|english literature|science fiction|sci fi|fantasy|story|stories|book series|imaginary place|characters|hugo award|nebula award|locus award)\b/.test(text);
}

function isProbablyScholarlyNonwork(record) {
  const text = normalizeKey(`${record.sourceKind || ""} ${record.accessType || ""} ${record.publisher || ""} ${record.subjects?.join(" ") || ""}`);
  return Boolean(record.identifiers?.doi?.length || /\b(scholarly|journal|article|conference|proceedings|research paper|dataset|reference book)\b/.test(text));
}

function hasNonLiteraryScienceSignal(record) {
  const text = normalizeKey(`${record.title} ${record.subjects?.join(" ") || ""} ${record.description || ""}`);
  return /\b(geomorphology|geology|ecology|botany|chemistry|physics|mechanics|engineering|sedimentary|aeolian|vegetation|marsh|fluid|agriculture|medicine|biology|mathematics|geotechnical|soil|soils|structural|construction|hydraulic|brake|automotive)\b/.test(text);
}

function constraintQualityDelta(record, constraints) {
  let score = 0;
  if (!constraints || !Object.keys(constraints).length) return score;
  const fit = evaluateRecordConstraintFit(record, constraints);
  score += fit.score >= 80 ? 10 : fit.score >= 55 ? 3 : fit.score <= 25 ? -14 : -4;
  return score;
}

function buildWorkAnalytics(group, parsed, conflicts) {
  const sourceBreakdown = countBy(group, (record) => record.sourceKind || "metadata");
  const sourceCount = unique(group.map((record) => record.sourceId)).length;
  const pageCounts = unique(group.map((record) => record.confidenceHints.pageCount).filter(Boolean).map(Number)).sort((a, b) => a - b);
  const languages = unique(group.map((record) => record.confidenceHints.language).filter(Boolean));
  const ratings = group.map((record) => Number(record.confidenceHints.rating || 0)).filter(Boolean);
  const citations = group.map((record) => Number(record.confidenceHints.citations || record.confidenceHints.refCount || 0)).filter(Boolean);
  const downloads = group.map((record) => Number(record.confidenceHints.downloads || 0)).filter(Boolean);
  const editions = group.map((record) => Number(record.confidenceHints.editionCount || 0)).filter(Boolean);
  const accessTypes = unique(group.map((record) => record.accessType).filter(Boolean));
  const themes = topTerms(group.flatMap((record) => record.subjects), 10);
  const constraintFit = evaluateWorkConstraintFit(group, parsed.constraints || {});
  const completeness = buildCompletenessProfile(group);
  const consensus = buildConsensusProfile(group);
  const authority = buildAuthorityProfile(group);
  const readerFit = buildReaderFitProfile(group, parsed, constraintFit, conflicts);
  const criteriaFit = buildCriteriaFitProfile(group, parsed, { pageCounts, ratings, citations, downloads, editions, accessTypes, themes, constraintFit, completeness, consensus, authority });
  const verification = buildVerificationProfile(group, conflicts, consensus, completeness);
  const signals = [
    group.length >= 6 && "dense evidence",
    sourceCount >= 4 && "multi-source agreement",
    authority.score >= 70 && "high-authority source mix",
    completeness.score >= 75 && "complete bibliographic profile",
    consensus.score >= 75 && "strong metadata consensus",
    readerFit.score >= 75 && `${readerFit.label.toLowerCase()}`,
    pageCounts.length && `${pageCounts[0]}-${pageCounts[pageCounts.length - 1]} page signal`,
    languages.length && `${languages.slice(0, 2).join("/")} language signal`,
    ratings.length && `${Math.max(...ratings).toFixed(1)} rating signal`,
    citations.length && `${Math.max(...citations)} citation/link signal`,
    downloads.length && `${Math.max(...downloads)} demand signal`,
    editions.length && `${Math.max(...editions)} edition signal`,
    accessTypes.some((type) => /public-domain|open|full-text|audiobook/i.test(type)) && "access signal",
    conflicts.length && "needs verification",
    constraintFit.label
  ].filter(Boolean);

  return {
    sourceBreakdown,
    themes,
    facts: {
      pages: pageCounts,
      languages,
      bestRating: ratings.length ? Number(Math.max(...ratings).toFixed(2)) : null,
      citationSignal: citations.length ? Math.max(...citations) : null,
      downloadSignal: downloads.length ? Math.max(...downloads) : null,
      editionSignal: editions.length ? Math.max(...editions) : null,
      accessTypes
    },
    constraintFit,
    completeness,
    consensus,
    authority,
    readerFit,
    criteriaFit,
    verification,
    signals: unique(signals).slice(0, 10)
  };
}

function buildCompletenessProfile(group) {
  const fields = {
    title: group.some((record) => record.title),
    authors: group.some((record) => record.authors.length),
    year: group.some((record) => record.year),
    publisher: group.some((record) => record.publisher),
    identifiers: group.some((record) => record.identifiers.isbn.length || record.identifiers.doi.length || record.identifiers.oclc.length || record.identifiers.lccn.length),
    subjects: group.some((record) => record.subjects.length),
    description: group.some((record) => record.description),
    cover: group.some((record) => record.coverUrl),
    access: group.some((record) => record.accessType)
  };
  const known = Object.values(fields).filter(Boolean).length;
  const score = Math.round((known / Object.keys(fields).length) * 100);
  return {
    score,
    label: score >= 80 ? "Rich metadata" : score >= 58 ? "Moderate metadata" : "Sparse metadata",
    fields,
    missing: Object.entries(fields).filter(([, value]) => !value).map(([key]) => key)
  };
}

function buildConsensusProfile(group) {
  const titles = topTerms(group.map((record) => record.title), 6);
  const authors = topTerms(group.flatMap((record) => record.authors.slice(0, 2)), 6);
  const years = unique(group.map((record) => record.year).filter(Boolean)).sort((a, b) => a - b);
  const sourceCount = unique(group.map((record) => record.sourceId)).length || 1;
  const titleAgreement = titles[0] ? Math.round((titles[0].count / group.length) * 100) : 0;
  const authorAgreement = authors[0] ? Math.round((authors[0].count / sourceCount) * 100) : 0;
  const yearSpread = years.length > 1 ? years[years.length - 1] - years[0] : 0;
  const score = clamp(Math.round((titleAgreement * 0.42) + (Math.min(authorAgreement, 100) * 0.32) + ((yearSpread <= 2 ? 100 : yearSpread <= 20 ? 65 : 35) * 0.26)), 0, 100);
  return {
    score,
    label: score >= 82 ? "Strong consensus" : score >= 62 ? "Mixed consensus" : "Weak consensus",
    titleAgreement,
    authorAgreement,
    yearSpread,
    titleVariants: titles.map((entry) => entry.term),
    authorVariants: authors.map((entry) => entry.term),
    yearValues: years
  };
}

function buildAuthorityProfile(group) {
  const weights = {
    catalog: 12,
    "bibliographic catalog": 12,
    "credentialed library catalog": 14,
    "digital library": 10,
    "public domain catalog": 9,
    "public-domain text index": 8,
    "open textbook catalog": 9,
    "knowledge graph": 7,
    "linked data graph": 7,
    encyclopedia: 6,
    "scholarly graph": 11,
    "doi metadata": 11
  };
  const sourceKinds = unique(group.map((record) => record.sourceKind || record.accessType || "metadata"));
  const score = clamp(sourceKinds.reduce((sum, kind) => sum + (weights[kind] || 4), 0), 0, 100);
  return {
    score,
    label: score >= 70 ? "High authority mix" : score >= 42 ? "Balanced authority mix" : "Limited authority mix",
    sourceKinds,
    strongestKinds: sourceKinds.slice(0, 6)
  };
}

function buildReaderFitProfile(group, parsed, constraintFit, conflicts) {
  let score = Math.round(constraintFit.score * 0.45);
  const notes = [];
  const text = normalizeKey(group.map((record) => `${record.title} ${record.description} ${record.subjects.join(" ")} ${record.accessType}`).join(" "));
  if (parsed.readerLevel === "beginner") {
    if (/\b(introduction|beginner|guide|handbook|accessible|textbook|overview)\b/.test(text)) {
      score += 18;
      notes.push("beginner-friendly metadata signal");
    } else {
      score += 8;
    }
  }
  if (parsed.readerGoal === "book-club discussion" || parsed.audience === "book club") {
    if (/\b(novel|fiction|memoir|discussion|social|family|political|ethics)\b/.test(text)) score += 14;
    notes.push("book-club prompt detected");
  }
  if (parsed.readerGoal === "research writing" || parsed.audience === "research") {
    if (group.some((record) => record.identifiers.doi.length || /scholarly|doi|openalex|crossref|semantic/i.test(record.sourceName))) score += 18;
    notes.push("research-source weighting applied");
  }
  if (parsed.negativeConstraints?.length) {
    const penalty = negativeConstraintPenalty(text, parsed.negativeConstraints);
    score -= penalty;
    if (penalty) notes.push(`possible mismatch with avoid-list: ${parsed.negativeConstraints.join(", ")}`);
  }
  if (conflicts.length) {
    score -= Math.min(18, conflicts.length * 5);
    notes.push("metadata conflicts reduce fit certainty");
  }
  score = clamp(score, 0, 100);
  return {
    score,
    label: score >= 78 ? "Excellent reader fit" : score >= 58 ? "Good reader fit" : score >= 38 ? "Uncertain reader fit" : "Weak reader fit",
    notes: unique(notes).slice(0, 5)
  };
}

function buildCriteriaFitProfile(group, parsed, context) {
  const criteria = parsed.evaluationCriteria || [];
  if (!criteria.length) return [];
  const text = normalizeKey(group.map((record) => `${record.title} ${record.description} ${record.subjects.join(" ")} ${record.accessType}`).join(" "));
  return criteria.map((criterion) => {
    let score = 50;
    if (criterion === "accuracy") score = Math.max(context.consensus.score, context.authority.score);
    else if (criterion === "beginner friendliness") score = /\b(introduction|guide|accessible|beginner|overview|textbook)\b/.test(text) ? 82 : 55;
    else if (criterion === "depth") score = context.citations.length || context.completeness.score > 70 ? 78 : 52;
    else if (criterion === "brevity") score = context.pageCounts.length ? (Math.min(...context.pageCounts) <= 260 ? 85 : 42) : 50;
    else if (criterion === "recency") {
      const years = group.map((record) => record.year).filter(Boolean);
      score = years.length && Math.max(...years) >= new Date().getFullYear() - 8 ? 84 : 45;
    } else if (criterion === "literary quality") score = context.ratings.length || /classic|award|literary|prize/.test(text) ? 74 : 50;
    else if (criterion === "popularity") score = context.downloads.length || context.ratings.length || context.editions.length ? 78 : 48;
    else if (criterion === "scholarly impact") score = context.citations.length ? 86 : 44;
    else if (criterion === "availability") score = context.accessTypes.some((type) => /public-domain|open|full-text|audiobook|ebook/i.test(type)) ? 84 : 48;
    else if (criterion === "discussion value") score = /\b(theme|politic|ethic|family|society|identity|war|climate|gender|race)\b/.test(text) ? 78 : 50;
    else if (criterion === "data quality") score = /\b(data|statistics|evidence|study|empirical|science|policy)\b/.test(text) || context.citations.length ? 76 : 46;
    else if (criterion === "policy relevance") score = /\b(policy|law|government|public|climate|economics|regulation)\b/.test(text) ? 78 : 45;
    else if (criterion === "regional fit") score = /\b(united states|american|u s|us |north america)\b/.test(text) ? 78 : 48;
    else if (criterion === "source transparency") score = Math.max(context.completeness.score, context.consensus.score, context.authority.score);
    return {
      criterion,
      score: clamp(Math.round(score), 0, 100),
      label: score >= 75 ? "strong" : score >= 55 ? "mixed" : "weak"
    };
  });
}

function buildVerificationProfile(group, conflicts, consensus, completeness) {
  const warnings = [];
  if (conflicts.length) warnings.push(...conflicts.slice(0, 3).map((conflict) => conflict.message));
  if (consensus.score < 62) warnings.push("Title/author/year consensus is weak across returned metadata.");
  if (completeness.score < 58) warnings.push(`Sparse metadata; missing ${completeness.missing.slice(0, 4).join(", ")}.`);
  if (!group.some((record) => record.identifiers.isbn.length || record.identifiers.doi.length)) warnings.push("No strong ISBN/DOI identifier agreement.");
  return {
    risk: warnings.length >= 3 ? "high" : warnings.length ? "medium" : "low",
    warnings: unique(warnings).slice(0, 6)
  };
}

function negativeConstraintPenalty(text, constraints) {
  return cleanList(constraints).reduce((penalty, constraint) => {
    if (constraint === "textbooks" && /\btextbook|course|syllabus|chapter\b/.test(text)) return penalty + 18;
    if (constraint === "academic density" && /\bscholarly|technical|research|paper|doi|journal\b/.test(text)) return penalty + 14;
    if (constraint === "academic monographs" && /\bmonograph|scholarly press|academic press|university press\b/.test(text)) return penalty + 14;
    if (constraint === "young adult" && /\byoung adult|teen|ya\b/.test(text)) return penalty + 12;
    if (constraint === "fiction" && /\bfiction|novel|story\b/.test(text)) return penalty + 12;
    if (constraint === "nonfiction" && /\bnonfiction|textbook|manual|study\b/.test(text)) return penalty + 12;
    if (constraint === "graphic novels" && /\bgraphic novel|manga|comic\b/.test(text)) return penalty + 12;
    if (constraint === "spoilers" && /\bending|death|dies|reveal|twist|plot summary\b/.test(text)) return penalty + 10;
    if (constraint === "paywalled access" && /\bsubscription|paywall|licensed|credentialed\b/.test(text)) return penalty + 10;
    return penalty;
  }, 0);
}

function evaluateWorkConstraintFit(group, constraints) {
  if (!constraints || !Object.keys(constraints).length) {
    return { score: 100, label: "No constraints", notes: [] };
  }
  const fits = group.map((record) => evaluateRecordConstraintFit(record, constraints));
  const scored = fits.filter((fit) => fit.known);
  if (!scored.length) {
    return { score: 48, label: "Constraints unverified", notes: ["Returned sources did not include enough year/page/language/format metadata."] };
  }
  const score = Math.round(scored.reduce((sum, fit) => sum + fit.score, 0) / scored.length);
  const notes = unique(fits.flatMap((fit) => fit.notes)).slice(0, 5);
  return {
    score,
    label: score >= 82 ? "Strong constraint fit" : score >= 62 ? "Partial constraint fit" : "Weak constraint fit",
    notes
  };
}

function evaluateRecordConstraintFit(record, constraints) {
  const notes = [];
  let score = 100;
  let known = false;
  const pages = Number(record.confidenceHints.pageCount || 0) || null;
  const language = normalizeLanguage(record.confidenceHints.language || "");
  const formatHaystack = normalizeKey(`${record.accessType} ${record.confidenceHints.format || ""} ${record.subjects.join(" ")}`);

  if (constraints.year?.after && record.year) {
    known = true;
    if (record.year <= constraints.year.after) {
      score -= 30;
      notes.push(`year ${record.year} is not after ${constraints.year.after}`);
    }
  }
  if (constraints.year?.before && record.year) {
    known = true;
    if (record.year >= constraints.year.before) {
      score -= 30;
      notes.push(`year ${record.year} is not before ${constraints.year.before}`);
    }
  }
  if (constraints.year?.between && record.year) {
    known = true;
    const [start, end] = constraints.year.between;
    if (record.year < start || record.year > end) {
      score -= 30;
      notes.push(`year ${record.year} is outside ${start}-${end}`);
    }
  }
  if (constraints.pages?.max && pages) {
    known = true;
    if (pages > constraints.pages.max) {
      score -= 24;
      notes.push(`${pages} pages exceeds ${constraints.pages.max}`);
    }
  }
  if (constraints.pages?.min && pages) {
    known = true;
    if (pages < constraints.pages.min) {
      score -= 24;
      notes.push(`${pages} pages is under ${constraints.pages.min}`);
    }
  }
  if (constraints.language && language) {
    known = true;
    if (!languagesMatch(language, constraints.language)) {
      score -= 18;
      notes.push(`language ${language} differs from ${constraints.language}`);
    }
  }
  if (constraints.format) {
    known = true;
    const wanted = normalizeKey(constraints.format);
    if (wanted === "fiction") {
      if (/nonfiction|textbook|manual|scholarly/.test(formatHaystack)) score -= 14;
    } else if (!formatHaystack.includes(wanted) && !(wanted === "nonfiction" && /textbook|scholarly|study|history|science/.test(formatHaystack))) {
      score -= 12;
      notes.push(`format signal does not clearly show ${constraints.format}`);
    }
  }
  if (constraints.access?.length) {
    known = true;
    const accessText = normalizeKey(`${record.accessType} ${record.sourceKind} ${record.sourceUrl}`);
    const matches = constraints.access.some((access) => accessText.includes(normalizeKey(access)) || (access === "full text" && /\b(full text|read online|borrow|public domain|open access|archive)\b/.test(accessText)));
    if (!matches) {
      score -= 14;
      notes.push(`access signal does not clearly show ${constraints.access.join("/")}`);
    }
  }
  if (constraints.rating === "high" && record.confidenceHints.rating) {
    known = true;
    if (Number(record.confidenceHints.rating) < 4) score -= 16;
  }
  if (constraints.region) {
    const regionText = normalizeKey(`${record.subjects.join(" ")} ${record.description} ${record.publisher}`);
    if (regionText) {
      known = true;
      if (!/\bunited states|american|u s|usa\b/.test(regionText)) score -= 8;
    }
  }
  return { score: clamp(score, 0, 100), known, notes };
}

function sourceAgreementBonus(group) {
  const count = unique(group.map((record) => record.sourceId)).length;
  if (count >= 8) return 24;
  if (count >= 5) return 18;
  if (count >= 3) return 12;
  if (count >= 2) return 7;
  return 0;
}

function authorFragmentationPenalty(group, parsed) {
  if (parsed.author) return 0;
  const variants = topTerms(group.flatMap((record) => record.authors.slice(0, 2)), 12);
  if (variants.length <= 2) return 0;
  const sourceCount = unique(group.map((record) => record.sourceId)).length || 1;
  const dominantShare = variants[0]?.count ? variants[0].count / sourceCount : 0;
  const shortTitle = group.some((record) => isShortAmbiguousTitle(record.title));
  if (parsed.domain === "literary" && shortTitle && variants.length >= 5 && dominantShare < 0.5) return 22;
  if (shortTitle && variants.length >= 4 && dominantShare < 0.45) return 14;
  return variants.length >= 5 ? 8 : 0;
}

function detectWorkConflicts(group) {
  const conflicts = [];
  const years = unique(group.map((record) => record.year).filter(Boolean)).sort((a, b) => a - b);
  if (years.length > 1 && years[years.length - 1] - years[0] > 2) {
    conflicts.push({
      type: "date",
      message: `Publication dates disagree across sources: ${years.join(", ")}.`,
      values: years
    });
  }

  const authorSets = unique(group.map((record) => normalizeKey(record.authors.slice(0, 2).join(" ")))).filter(Boolean);
  if (authorSets.length > 2) {
    conflicts.push({
      type: "author",
      message: "Returned author names differ enough to inspect the citations.",
      values: group.map((record) => ({ source: record.sourceName, authors: record.authors }))
    });
  }

  return conflicts;
}

function synthesizeAnswer(parsed, queryPlan, works, statuses, conflicts, records, relatedLinks) {
  const top = works[0];
  const online = statuses.filter((status) => status.state === "online").length;
  const partial = statuses.filter((status) => status.state === "partial" || status.state === "unavailable" || status.state === "not configured");
  const metadataOnly = statuses.filter((status) => status.state === "metadata only");

  if (!top) {
    return {
      mode: "deterministic",
      headline: "No strong book match came back.",
      summary: `Atlas understood this as ${parsed.intentLabel.toLowerCase()} for "${parsed.searchText}", but no source returned a usable record.`,
      confidence: 0,
      sections: [
        {
          title: "Try next",
          body: "Use an exact title in quotes, add the author, or paste an ISBN. The source grid shows which providers responded.",
          citations: []
        }
      ],
      insights: [],
      caveats: partial.map((status) => `${status.sourceName}: ${status.message}`),
      relatedLinks,
      reasoning: buildReasoning(parsed, queryPlan, works, statuses, conflicts)
    };
  }

  const topCitations = top.citations.slice(0, 6);
  const sourceNames = unique(top.sources.map((source) => source.name)).join(", ");
  const authorText = top.authors.length ? ` by ${top.authors.slice(0, 3).join(", ")}` : "";
  const yearText = top.year ? ` First date signal: ${top.year}.` : "";
  const identifierText = top.isbn ? ` ISBN signal: ${top.isbn}.` : top.identifiers.doi[0] ? ` DOI signal: ${top.identifiers.doi[0]}.` : "";
  const conflictText = conflicts.length ? ` I found ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} worth checking.` : " No major cross-source conflicts appeared on the top match.";
  const intelligenceSections = buildIntelligenceSections(parsed, top, works, conflicts);
  const researchBrief = buildResearchBrief(parsed, queryPlan, works, statuses, records, conflicts, relatedLinks);

  return {
    mode: "deterministic",
    headline: buildHeadline(parsed, top),
    summary: `${top.title}${authorText}.${yearText}${identifierText} Atlas ranked it highest because ${top.sourceCount} source${top.sourceCount === 1 ? "" : "s"} agreed or supplied compatible evidence: ${sourceNames}.${conflictText}`,
    confidence: top.confidence,
    sections: [
      {
        title: "How Atlas read the prompt",
        body: buildPromptReading(parsed, queryPlan),
        citations: []
      },
      {
        title: "Human search strategy",
        body: buildSearchStrategyNarrative(parsed, queryPlan),
        citations: []
      },
      {
        title: "Direct answer",
        body: buildDirectAnswer(parsed, top, works),
        citations: topCitations
      },
      ...intelligenceSections,
      {
        title: "Evidence strength",
        body: buildEvidenceStrength(top),
        citations: topCitations
      },
      {
        title: "Source conflicts and limits",
        body: buildConflictSummary(conflicts, partial, metadataOnly),
        citations: conflicts.slice(0, 3).flatMap((conflict) => works.find((work) => work.id === conflict.workId)?.citations || []).slice(0, 6)
      },
      {
        title: "Reader path",
        body: buildReaderPath(parsed, works),
        citations: works.slice(0, 3).flatMap((work) => work.citations.slice(0, 2))
      }
    ],
    insights: [
      { label: "Best match", value: top.title },
      { label: "Confidence", value: `${top.confidence}%` },
      { label: "Category", value: parsed.searchCategory || "all" },
      { label: "Live sources", value: `${online}/${SOURCE_CATALOG.length}` },
      { label: "Records fused", value: String(records.length) },
      { label: "Search seeds", value: String(parsed.humanSearchPlan?.queryExpansions?.length || 0) },
      { label: "Constraint fit", value: top.constraintFit?.label || "No constraints" },
      { label: "Conflicts", value: String(conflicts.length) },
      { label: "Metadata-only links", value: String(metadataOnly.length) }
    ],
    caveats: partial.map((status) => `${status.sourceName}: ${status.message}`).slice(0, 8),
    relatedLinks,
    researchBrief,
    reasoning: buildReasoning(parsed, queryPlan, works, statuses, conflicts)
  };
}

function buildHeadline(parsed, top) {
  if (parsed.intent === "compare") return `Comparison anchor: ${top.title}`;
  if (parsed.intent === "author") return `Likely answer: ${top.authors[0] || "author not confirmed"}`;
  if (parsed.intent === "publication") return `Publication signal: ${top.year || "date not confirmed"}`;
  if (parsed.intent === "recommendation" || parsed.intent === "subject") return `Strong starting point: ${top.title}`;
  return `Top source-backed match: ${top.title}`;
}

function buildDirectAnswer(parsed, top, works) {
  if (parsed.intent === "author") {
    return top.authors.length
      ? `${top.title} is attributed here to ${top.authors.join(", ")}. Check the source links if you need edition-level certainty.`
      : `The sources did not return a clean author for ${top.title}.`;
  }
  if (parsed.intent === "publication") {
    return top.year
      ? `${top.title} has a strongest publication-year signal of ${top.year}. Edition-level dates may differ.`
      : `${top.title} did not return a clean publication year.`;
  }
  if (parsed.intent === "compare") {
    const intended = parsed.compareTerms.length ? parsed.compareTerms.join(" vs ") : works.slice(0, 3).map((work) => work.title).join(" vs ");
    const found = matchComparisonWorks(parsed, works).map(({ term, work }) => `${term}: ${work ? `${work.title} (${work.confidence}%)` : "no confident match"}`).join("; ");
    const axes = parsed.comparisonAxes?.length ? ` Comparison axes: ${parsed.comparisonAxes.join(", ")}.` : "";
    return `Atlas read this as a comparison request for ${intended}. ${found}.${axes} Use citation links for edition-level certainty.`;
  }
  if (parsed.intent === "recommendation" || parsed.intent === "subject") {
    const next = works.slice(1, 4).map((work) => work.title).join(", ");
    const constraintText = describeConstraints(parsed.constraints || {});
    return next
      ? `Start with ${top.title}. Nearby high-confidence candidates include ${next}.${constraintText ? ` I weighted the ranking against: ${constraintText}.` : ""}`
      : `Start with ${top.title}; source coverage was thin beyond the top record.`;
  }
  return top.description || `${top.title} is the strongest match returned by the source fusion engine.`;
}

function buildIntelligenceSections(parsed, top, works, conflicts) {
  const sections = [
    {
      title: "Book intelligence profile",
      body: buildBookProfile(top),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "Themes and subject signals",
      body: buildThemeProfile(parsed, top, works),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "Edition and access signals",
      body: buildEditionAccessProfile(top),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "AI ranking rationale",
      body: buildRankingRationale(parsed, top, conflicts),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "Reader-fit diagnosis",
      body: buildReaderFitDiagnosis(top),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "Criteria scorecard",
      body: buildCriteriaScorecard(parsed, top),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "Confidence audit",
      body: buildConfidenceAudit(top),
      citations: top.citations.slice(0, 6)
    },
    {
      title: "What to verify next",
      body: buildVerificationNext(top, conflicts),
      citations: top.citations.slice(0, 6)
    }
  ];

  if (parsed.intent === "compare") {
    sections.unshift({
      title: "Comparison map",
      body: buildComparisonMap(parsed, works),
      citations: works.slice(0, 4).flatMap((work) => work.citations.slice(0, 2))
    });
  }

  if (parsed.answerStyle === "timeline" || parsed.questionAspects.includes("publication")) {
    sections.push({
      title: "Publication timeline",
      body: buildTimeline(works),
      citations: works.slice(0, 5).flatMap((work) => work.citations.slice(0, 1))
    });
  }

  return sections;
}

function buildBookProfile(work) {
  const facts = work.analytics?.facts || {};
  const authors = work.authors?.length ? work.authors.slice(0, 5).join(", ") : "author not returned";
  const pages = facts.pages?.length ? `${facts.pages[0]}${facts.pages.length > 1 ? `-${facts.pages[facts.pages.length - 1]}` : ""} pages` : "page count not returned";
  const language = facts.languages?.length ? `language signal: ${facts.languages.slice(0, 3).join(", ")}` : "language not returned";
  const rating = facts.bestRating ? `best rating signal ${facts.bestRating}` : "no rating signal";
  const scholarly = facts.citationSignal ? `citation/link signal ${facts.citationSignal}` : "no citation count signal";
  return `${work.title} is represented as ${authors}, with a strongest date signal of ${work.year || "unknown"} and publisher signal ${work.publisher || "unknown"}. Identifiers: ${work.isbn || work.identifiers?.doi?.[0] || "none returned"}. Metadata depth: ${pages}; ${language}; ${rating}; ${scholarly}.`;
}

function buildThemeProfile(parsed, top, works) {
  const themes = (top.analytics?.themes || []).map((entry) => entry.term).filter(Boolean).slice(0, 8);
  const axisText = parsed.comparisonAxes?.length ? ` The prompt asked about ${parsed.comparisonAxes.join(", ")}.` : "";
  const nearby = works.slice(1, 4).map((work) => work.title).join(", ");
  return themes.length
    ? `Source subject tags cluster around ${themes.join(", ")}.${axisText}${nearby ? ` Nearby candidates to compare: ${nearby}.` : ""}`
    : `The sources did not return strong subject tags.${axisText}${top.description ? " Use the description and citation links for thematic interpretation." : ""}`;
}

function buildEditionAccessProfile(work) {
  const facts = work.analytics?.facts || {};
  const access = facts.accessTypes?.length ? facts.accessTypes.slice(0, 6).join("; ") : "metadata only";
  const edition = facts.editionSignal ? `${facts.editionSignal} editions signaled` : "edition count not returned";
  const downloads = facts.downloadSignal ? `${facts.downloadSignal} download/activity signal` : "no demand/download signal";
  const fit = work.constraintFit ? `${work.constraintFit.label}${work.constraintFit.notes?.length ? ` (${work.constraintFit.notes.join("; ")})` : ""}` : "No constraints";
  return `Access signals: ${access}. Edition signal: ${edition}. Demand signal: ${downloads}. Constraint check: ${fit}.`;
}

function buildRankingRationale(parsed, work, conflicts) {
  const breakdown = Object.entries(work.analytics?.sourceBreakdown || {})
    .map(([kind, count]) => `${kind}: ${count}`)
    .join("; ");
  const signals = work.intelligenceSignals?.length ? work.intelligenceSignals.join(", ") : "basic source metadata";
  const aspects = parsed.questionAspects?.length ? parsed.questionAspects.join(", ") : parsed.intentLabel.toLowerCase();
  return `Atlas ranked this work using ${aspects}, title/identifier agreement, source family diversity, evidence density, and conflict penalties. Source mix: ${breakdown || "unknown"}. Signals: ${signals}. ${conflicts.length ? "Conflicts lowered confidence." : "No major conflicts lowered confidence."}`;
}

function buildReaderFitDiagnosis(work) {
  const fit = work.analytics?.readerFit;
  if (!fit) return "No reader-fit profile was computed for this work.";
  const notes = fit.notes?.length ? ` Notes: ${fit.notes.join("; ")}.` : "";
  return `${fit.label} (${fit.score}/100). This combines explicit constraints, audience/goal signals, avoid-list penalties, and metadata conflicts.${notes}`;
}

function buildCriteriaScorecard(parsed, work) {
  const criteria = work.analytics?.criteriaFit || [];
  if (!criteria.length) {
    return parsed.evaluationCriteria?.length
      ? "Atlas detected criteria, but this work did not return enough metadata to score them confidently."
      : "No explicit evaluation criteria were detected beyond the main search intent.";
  }
  return criteria.map((entry) => `${entry.criterion}: ${entry.label} (${entry.score}/100)`).join("; ");
}

function buildConfidenceAudit(work) {
  const consensus = work.analytics?.consensus;
  const completeness = work.analytics?.completeness;
  const authority = work.analytics?.authority;
  const verification = work.analytics?.verification;
  return [
    consensus ? `Consensus: ${consensus.label} (${consensus.score}/100; title ${consensus.titleAgreement}%, author ${consensus.authorAgreement}%, year spread ${consensus.yearSpread}).` : "",
    completeness ? `Completeness: ${completeness.label} (${completeness.score}/100${completeness.missing.length ? `; missing ${completeness.missing.slice(0, 4).join(", ")}` : ""}).` : "",
    authority ? `Authority: ${authority.label} (${authority.score}/100; ${authority.strongestKinds.slice(0, 4).join(", ")}).` : "",
    verification ? `Verification risk: ${verification.risk}${verification.warnings.length ? `; ${verification.warnings.slice(0, 3).join(" ")}` : ""}.` : ""
  ].filter(Boolean).join(" ");
}

function buildVerificationNext(work, conflicts) {
  const warnings = work.analytics?.verification?.warnings || [];
  const steps = [];
  if (conflicts.length || warnings.length) steps.push("Open the top citation links and confirm title, author, date, and identifiers against the source records.");
  if (!work.isbn && !work.identifiers?.doi?.length) steps.push("Add an ISBN, DOI, or author to narrow ambiguous catalog matches.");
  if (work.analytics?.completeness?.missing?.length) steps.push(`Look for missing fields: ${work.analytics.completeness.missing.slice(0, 4).join(", ")}.`);
  if (!steps.length) steps.push("The result is comparatively strong; use citations for edition-level certainty before quoting exact publication details.");
  return steps.join(" ");
}

function buildResearchBrief(parsed, queryPlan, works, statuses, records, conflicts, relatedLinks) {
  const top = works[0];
  const online = statuses.filter((status) => status.state === "online").length;
  const metadataOnly = statuses.filter((status) => status.state === "metadata only").length;
  const unavailable = statuses.filter((status) => ["partial", "unavailable", "not configured"].includes(status.state)).length;
  return {
    promptRead: parsed.promptProfile,
    sourceCoverage: {
      online,
      metadataOnly,
      unavailable,
      total: statuses.length,
      records: records.length,
      citations: records.length,
      conflicts: conflicts.length
    },
    interpretation: [
      `Intent: ${parsed.intentLabel}`,
      `Category: ${parsed.searchCategory || "all"}`,
      parsed.focus?.summary && `Focus: ${parsed.focus.summary}`,
      parsed.humanSearchPlan?.strategy && `Search plan: ${parsed.humanSearchPlan.strategy}`,
      parsed.evaluationCriteria?.length && `Criteria: ${parsed.evaluationCriteria.join(", ")}`,
      parsed.negativeConstraints?.length && `Avoid: ${parsed.negativeConstraints.join(", ")}`,
      parsed.audience && `Audience: ${parsed.audience}`,
      parsed.requestedOutput && `Output: ${parsed.requestedOutput}`,
      parsed.tasks?.length && `Tasks: ${parsed.tasks.join(", ")}`,
      parsed.sourcePreferences?.length && `Source policy: ${parsed.sourcePreferences.join(", ")}`,
      parsed.editionPreferences?.length && `Edition: ${parsed.editionPreferences.join(", ")}`,
      parsed.spoilerPolicy && `Spoilers: ${parsed.spoilerPolicy}`,
      parsed.strictness && parsed.strictness !== "balanced" && `Matching: ${parsed.strictness}`
    ].filter(Boolean),
    topTakeaways: buildTopTakeaways(parsed, works, conflicts),
    searchStrategy: parsed.humanSearchPlan,
    rankingTable: works.slice(0, 6).map((work, index) => ({
      rank: index + 1,
      title: work.title,
      confidence: work.confidence,
      sourceCount: work.sourceCount,
      fit: work.analytics?.readerFit?.label || work.constraintFit?.label || "Fit unknown",
      consensus: work.analytics?.consensus?.label || "Consensus unknown",
      authority: work.analytics?.authority?.label || "Authority unknown",
      caveat: work.analytics?.verification?.warnings?.[0] || ""
    })),
    sourceBalance: Object.entries(countBy(records, (record) => record.sourceKind || "metadata"))
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
    evidenceWarnings: unique([
      ...conflicts.slice(0, 5).map((conflict) => conflict.message),
      ...(top?.analytics?.verification?.warnings || [])
    ]).slice(0, 8),
    nextQuestions: buildNextQuestions(parsed, works, relatedLinks)
  };
}

function buildTopTakeaways(parsed, works, conflicts) {
  const top = works[0];
  if (!top) return ["No ranked work was returned."];
  const next = works[1];
  return [
    `${top.title} is the leading source-backed match at ${top.confidence}% confidence.`,
    top.analytics?.readerFit ? `${top.analytics.readerFit.label} with ${top.analytics.readerFit.score}/100 reader-fit score.` : "",
    top.analytics?.consensus ? `${top.analytics.consensus.label}; metadata agreement is part of the confidence score.` : "",
    parsed.intent === "compare" && next ? `Comparison runner-up/peer: ${next.title} (${next.confidence}%).` : "",
    conflicts.length ? `${conflicts.length} conflict signal${conflicts.length === 1 ? "" : "s"} need verification.` : "No major date/author conflict hit the top result."
  ].filter(Boolean);
}

function buildNextQuestions(parsed, works, relatedLinks) {
  const questions = [];
  if (!parsed.author && parsed.title) questions.push(`Should Atlas narrow "${parsed.title}" by author or edition?`);
  if (parsed.intent === "compare" && parsed.compareTerms.length) questions.push(`Should Atlas build a stricter side-by-side table for ${parsed.compareTerms.join(" vs ")}?`);
  if (parsed.subject && !parsed.constraints.format) questions.push(`Should results focus on fiction, nonfiction, textbooks, or scholarship about ${parsed.subject}?`);
  if (relatedLinks?.length) questions.push("Should metadata-only link-outs be opened for additional catalog context?");
  if (works[0]?.analytics?.verification?.risk !== "low") questions.push("Should Atlas rerun with an ISBN/author to reduce ambiguity?");
  return questions.slice(0, 5);
}

function buildComparisonMap(parsed, works) {
  const matches = matchComparisonWorks(parsed, works);
  const lines = matches.map(({ term, work }) => {
    if (!work) return `${term}: no confident source-backed match.`;
    const themes = (work.analytics?.themes || []).map((entry) => entry.term).slice(0, 4).join(", ") || "limited subject metadata";
    return `${term}: matched ${work.title} at ${work.confidence}% confidence, date ${work.year || "unknown"}, sources ${work.sourceCount}, themes ${themes}.`;
  });
  return `${lines.join(" ")} ${parsed.comparisonAxes?.length ? `Axes requested: ${parsed.comparisonAxes.join(", ")}.` : ""}`;
}

function buildTimeline(works) {
  const entries = works
    .filter((work) => work.year)
    .slice(0, 8)
    .sort((a, b) => a.year - b.year)
    .map((work) => `${work.year}: ${work.title}`)
    .join("; ");
  return entries || "The returned records did not include enough publication dates to build a useful timeline.";
}

function buildEvidenceStrength(top) {
  const fit = top.constraintFit?.label || "No constraints";
  const notes = top.constraintFit?.notes?.length ? ` Notes: ${top.constraintFit.notes.join("; ")}.` : "";
  return `The top record has ${top.evidenceDensity} evidence fields, ${top.sourceCount} source families, ${top.subjects.length || "no"} subject tags, and ${fit.toLowerCase()}.${notes} ${top.description ? "A source summary is available." : "No substantial source summary came back."}`;
}

function matchComparisonWorks(parsed, works) {
  return (parsed.compareTerms || []).map((term) => ({
    term,
    work: works.find((work) => includesNormalized([work.title, ...(work.jobLabels || [])], term)) || null
  }));
}

function buildPromptReading(parsed, queryPlan) {
  const parts = [
    `Intent: ${parsed.intentLabel.toLowerCase()}.`,
    `Search category: ${parsed.searchCategory || "all"}.`,
    `Search focus: ${parsed.focus?.summary || parsed.searchText}.`
  ];
  if (parsed.definitionTerm) {
    parts.push(`Definition target: ${parsed.definitionTerm}.`);
  }
  if (parsed.studyFrame?.studyTypes?.length || parsed.studyFrame?.population || parsed.studyFrame?.outcome) {
    parts.push(`Study frame: ${[
      parsed.studyFrame.studyTypes?.length && `types ${parsed.studyFrame.studyTypes.join(", ")}`,
      parsed.studyFrame.population && `population ${parsed.studyFrame.population}`,
      parsed.studyFrame.intervention && `intervention/exposure ${parsed.studyFrame.intervention}`,
      parsed.studyFrame.outcome && `outcome ${parsed.studyFrame.outcome}`
    ].filter(Boolean).join("; ")}.`);
  }
  if (parsed.questionAspects.length) {
    parts.push(`Question aspects: ${parsed.questionAspects.join(", ")}.`);
  }
  if (parsed.comparisonAxes?.length) {
    parts.push(`Comparison/read axes: ${parsed.comparisonAxes.join(", ")}.`);
  }
  if (parsed.readerGoal) {
    parts.push(`Reader goal: ${parsed.readerGoal}.`);
  }
  if (parsed.domain && parsed.domain !== "general") {
    parts.push(`Domain reading: ${parsed.domain}.`);
  }
  if (parsed.tasks?.length) {
    parts.push(`Task stack: ${parsed.tasks.join(", ")}.`);
  }
  if (parsed.audience) {
    parts.push(`Audience: ${parsed.audience}.`);
  }
  if (parsed.answerStyle) {
    parts.push(`Preferred answer shape: ${parsed.answerStyle}.`);
  }
  if (parsed.requestedOutput) {
    parts.push(`Requested output: ${parsed.requestedOutput}.`);
  }
  if (parsed.evaluationCriteria?.length) {
    parts.push(`Evaluation criteria: ${parsed.evaluationCriteria.join(", ")}.`);
  }
  if (parsed.negativeConstraints?.length) {
    parts.push(`Avoid-list: ${parsed.negativeConstraints.join(", ")}.`);
  }
  if (parsed.editionPreferences?.length) {
    parts.push(`Edition/format preferences: ${parsed.editionPreferences.join(", ")}.`);
  }
  if (parsed.sourcePreferences?.length) {
    parts.push(`Source preferences: ${parsed.sourcePreferences.join(", ")}.`);
  }
  if (parsed.spoilerPolicy) {
    parts.push(`Spoiler policy: ${parsed.spoilerPolicy}.`);
  }
  if (parsed.strictness && parsed.strictness !== "balanced") {
    parts.push(`Matching strictness: ${parsed.strictness}.`);
  }
  if (parsed.identifierHints && Object.values(parsed.identifierHints).some((values) => cleanList(values).length)) {
    parts.push(`Identifier hints: ${Object.entries(parsed.identifierHints).filter(([, values]) => cleanList(values).length).map(([key, values]) => `${key} ${cleanList(values).join("/")}`).join("; ")}.`);
  }
  if (parsed.promptProfile?.complexity?.length) {
    parts.push(`Prompt profile: ${parsed.promptProfile.complexity.join(", ")}.`);
  }
  if (parsed.humanSearchPlan?.strategy) {
    parts.push(`Human-style search plan: ${parsed.humanSearchPlan.strategy}`);
  }
  if (parsed.humanSearchPlan?.queryExpansions?.length) {
    parts.push(`Query seeds: ${parsed.humanSearchPlan.queryExpansions.slice(0, 6).join("; ")}.`);
  }
  const constraints = describeConstraints(parsed.constraints || {});
  if (constraints) {
    parts.push(`Constraints detected: ${constraints}.`);
  }
  if (queryPlan.jobs.length > 1) {
    parts.push(`Atlas split the prompt into ${queryPlan.jobs.length} source lookups: ${queryPlan.jobs.map((job) => job.label).join("; ")}.`);
  }
  return parts.join(" ");
}

function buildSearchStrategyNarrative(parsed, queryPlan) {
  const plan = parsed.humanSearchPlan || {};
  const tiers = cleanList(plan.sourceTiers)
    .slice(0, 4)
    .map((tier) => `${tier.label}: ${cleanList(tier.sources).slice(0, 5).join(", ")}`)
    .join(" | ");
  const must = cleanList(plan.mustHave).slice(0, 6).join("; ") || "relevant title/subject evidence";
  const avoid = cleanList(plan.avoid).slice(0, 5).join("; ") || "obvious mismatches";
  const seeds = queryPlan.jobs
    .flatMap((job) => cleanList(job.queryVariants).slice(0, 4))
    .slice(0, 10)
    .join("; ");
  return [
    `Category route: ${parsed.searchCategory || "all"}.`,
    plan.goal || `Search for ${parsed.searchText}.`,
    plan.strategy || "Use catalogs first, then widen into context and scholarly sources.",
    `Must-have signals: ${must}.`,
    `Avoid rules: ${avoid}.`,
    tiers && `Source lanes: ${tiers}.`,
    seeds && `Query seeds: ${seeds}.`
  ].filter(Boolean).join(" ");
}

function buildConflictSummary(conflicts, partial, metadataOnly) {
  const parts = [];
  if (conflicts.length) {
    parts.push(conflicts.slice(0, 3).map((conflict) => conflict.message).join(" "));
  } else {
    parts.push("No major date or author conflicts were detected in the merged top records.");
  }
  if (partial.length) {
    parts.push(`${partial.length} source${partial.length === 1 ? "" : "s"} were partial, unavailable, or not configured.`);
  }
  if (metadataOnly.length) {
    parts.push("Anna's Archive and Scribd are displayed as safe metadata/search links only.");
  }
  return parts.join(" ");
}

function buildReaderPath(parsed, works) {
  if (parsed.readerLevel === "beginner") {
    return "For a beginner path, favor high-confidence records with clear descriptions, current publisher metadata, and multiple source links before moving into scholarly records.";
  }
  if (parsed.requestedDepth === "deep") {
    return "For a deep read, inspect the source links, compare dates and identifiers, then use the scholarly/DOI sources to branch into criticism or related editions.";
  }
  const next = works[1]?.title;
  return next ? `Read or inspect the top match first, then compare it against ${next} for nearby context.` : "Inspect the citation links for edition certainty before relying on the answer.";
}

function buildReasoning(parsed, queryPlan, works, statuses, conflicts) {
  return {
    parsedIntent: parsed.intent,
    extractedSignals: parsed.signals,
    questionAspects: parsed.questionAspects,
    comparisonAxes: parsed.comparisonAxes,
    constraints: parsed.constraints,
    tasks: parsed.tasks,
    intentFrame: parsed.intentFrame,
    identifierHints: parsed.identifierHints,
    titleAuthorPairs: parsed.titleAuthorPairs,
    contributorHints: parsed.contributorHints,
    editionPreferences: parsed.editionPreferences,
    sourcePreferences: parsed.sourcePreferences,
    spoilerPolicy: parsed.spoilerPolicy,
    strictness: parsed.strictness,
    audience: parsed.audience,
    evaluationCriteria: parsed.evaluationCriteria,
    negativeConstraints: parsed.negativeConstraints,
    requestedOutput: parsed.requestedOutput,
    promptProfile: parsed.promptProfile,
    humanSearchPlan: parsed.humanSearchPlan,
    focus: parsed.focus,
    readerGoal: parsed.readerGoal,
    answerStyle: parsed.answerStyle,
    jobs: queryPlan.jobs.map((job) => job.label),
    queryVariants: Object.fromEntries(queryPlan.jobs.map((job) => [job.label, job.queryVariants || []])),
    rankingSignals: [
      "exact ISBN/title/author match",
      "identifier agreement",
      "source count",
      "description and subject density",
      "date/author conflict penalties"
    ],
    sourceStates: Object.fromEntries(statuses.map((status) => [status.sourceName, status.state])),
    topWorkIds: works.slice(0, 5).map((work) => work.id),
    topWorkAnalytics: works[0]?.analytics || null,
    conflictCount: conflicts.length
  };
}

async function maybeEnhanceWithOpenAI(deterministic, parsed, works, records, statuses, context) {
  const enabled = String(context.env.ENABLE_OPENAI_SYNTHESIS || "").toLowerCase() === "true";
  if (!enabled || !context.env.OPENAI_API_KEY) {
    return {
      answer: deterministic,
      aiStatus: {
        state: "deterministic",
        message: "Rule-based synthesis active. Set ENABLE_OPENAI_SYNTHESIS=true and OPENAI_API_KEY for hybrid LLM synthesis."
      }
    };
  }

  try {
    const body = {
      model: context.env.OPENAI_MODEL || "gpt-5.1-mini",
      instructions: [
        "You are Atlas Bibliotheca, a careful book research assistant.",
        "Use only the supplied normalized source facts and citation ids.",
        "Do not invent facts. Preserve uncertainty and mention conflicts.",
        "Return concise JSON matching the requested schema."
      ].join(" "),
      input: JSON.stringify({
        prompt: parsed.raw,
        parsed,
        works: works.slice(0, 8),
        citations: records.slice(0, 40).map(toCitation),
        sourceStatuses: statuses,
        deterministic
      }),
      text: {
        format: {
          type: "json_schema",
          name: "atlas_book_answer",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              headline: { type: "string" },
              summary: { type: "string" },
              confidence: { type: "number" },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    body: { type: "string" },
                    citations: { type: "array", items: { type: "string" } }
                  },
                  required: ["title", "body", "citations"]
                }
              },
              caveats: { type: "array", items: { type: "string" } }
            },
            required: ["headline", "summary", "confidence", "sections", "caveats"]
          }
        }
      },
      max_output_tokens: 1400
    };

    const response = await context.fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }

    const json = await response.json();
    const text = json.output_text || findOutputText(json);
    const enhanced = JSON.parse(text);
    return {
      answer: {
        ...deterministic,
        ...enhanced,
        mode: "hybrid-llm",
        insights: deterministic.insights,
        relatedLinks: deterministic.relatedLinks,
        reasoning: deterministic.reasoning
      },
      aiStatus: {
        state: "hybrid",
        message: `LLM synthesis applied with ${body.model}.`
      }
    };
  } catch (error) {
    return {
      answer: deterministic,
      aiStatus: {
        state: "fallback",
        message: `LLM synthesis failed; deterministic answer used. ${error.message}`
      }
    };
  }
}

function findOutputText(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.content)) {
    return value.content.map(findOutputText).filter(Boolean).join("\n");
  }
  if (Array.isArray(value.output)) {
    return value.output.map(findOutputText).filter(Boolean).join("\n");
  }
  return "";
}

function fusionKey(record) {
  return fusionKeys(record)[0] || `record:${record.id}`;
}

function fusionKeys(record) {
  const keys = [];
  record.identifiers.isbn.forEach((isbn) => keys.push(`isbn:${isbn}`));
  record.identifiers.doi.forEach((doi) => keys.push(`doi:${doi}`));
  record.identifiers.oclc.forEach((oclc) => keys.push(`oclc:${oclc}`));
  const title = normalizeKey(record.title);
  const author = normalizeKey(firstValue(record.authors));
  if (title && author) keys.push(`title-author:${title}:${author}`);
  if (title && !author) keys.push(`title:${title}`);
  return unique(keys);
}

function canMergeRecords(a, b) {
  if (intersects(a.identifiers.isbn, b.identifiers.isbn)) return true;
  if (intersects(a.identifiers.doi, b.identifiers.doi)) return true;
  if (intersects(a.identifiers.oclc, b.identifiers.oclc)) return true;
  const titleA = normalizeKey(a.title);
  const titleB = normalizeKey(b.title);
  if (!titleA || !titleB) return false;
  const titlesMatch = titleA === titleB || (titleA.length > 5 && titleB.length > 5 && (titleA.includes(titleB) || titleB.includes(titleA)));
  if (!titlesMatch) return false;
  const authorsA = a.authors.map(normalizeKey).filter(Boolean);
  const authorsB = b.authors.map(normalizeKey).filter(Boolean);
  if (!authorsA.length || !authorsB.length) {
    if (isShortAmbiguousTitle(a.title) || isShortAmbiguousTitle(b.title)) {
      return hasStrongSharedBibliographicSignal(a, b);
    }
    return true;
  }
  return authorsA.some((authorA) => authorsB.some((authorB) => authorA.includes(authorB) || authorB.includes(authorA)));
}

function isShortAmbiguousTitle(title) {
  const key = normalizeKey(title);
  if (!key) return false;
  const tokens = key.split(" ").filter(Boolean);
  return tokens.length <= 2 && key.length <= 18;
}

function hasStrongSharedBibliographicSignal(a, b) {
  if (intersects(a.identifiers.isbn, b.identifiers.isbn)) return true;
  if (intersects(a.identifiers.doi, b.identifiers.doi)) return true;
  if (intersects(a.identifiers.oclc, b.identifiers.oclc)) return true;
  if (intersects(a.identifiers.lccn, b.identifiers.lccn)) return true;
  const yearA = normalizeYear(a.year || a.publishedDate);
  const yearB = normalizeYear(b.year || b.publishedDate);
  if (yearA && yearB && Math.abs(yearA - yearB) <= 1 && subjectOverlap(a, b) >= 2) return true;
  return false;
}

function subjectOverlap(a, b) {
  const aTerms = new Set(cleanList(a.subjects).flatMap((subject) => tokenize(subject)));
  return cleanList(b.subjects).flatMap((subject) => tokenize(subject)).filter((term) => aTerms.has(term)).length;
}

function intersects(a, b) {
  const normalized = new Set(cleanList(a).map((value) => String(value).toLowerCase()));
  return cleanList(b).some((value) => normalized.has(String(value).toLowerCase()));
}

function pickBestYear(records) {
  const years = records.map((record) => record.year).filter(Boolean);
  if (!years.length) return null;
  return Math.min(...years);
}

function chooseBestDescription(records) {
  return records
    .map((record) => record.description)
    .filter(Boolean)
    .sort((a, b) => scoreDescription(b) - scoreDescription(a))[0] || "";
}

function scoreDescription(value) {
  const text = String(value || "");
  let score = Math.min(text.length, 600);
  if (/\b(novel|book|written work|publication|study|story)\b/i.test(text)) score += 100;
  if (/\b(disambiguation|may refer to)\b/i.test(text)) score -= 200;
  return score;
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.name}:${source.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankWikidataCandidates(candidates, job) {
  const query = normalizeKey(job.wikiQuery || job.searchText);
  const bookish = /\b(novel|book|literary|written work|short story|poem|play|publication|edition|text|manga|comics)\b/i;
  const notBookish = /\b(film|movie|television|video game|album|band|song|software|company|place|city|family name)\b/i;
  return candidates
    .map((candidate) => {
      const label = normalizeKey(candidate.label || "");
      const description = candidate.description || "";
      let score = 0;
      if (label === query) score += 30;
      else if (label.includes(query) || query.includes(label)) score += 12;
      if (bookish.test(description)) score += 34;
      if (notBookish.test(description)) score -= 28;
      if (/edition/i.test(description) && job.intent !== "isbn") score -= 18;
      return { ...candidate, _score: score };
    })
    .filter((candidate) => candidate._score > -20)
    .sort((a, b) => b._score - a._score);
}

function rankOpenTextbooks(items, job) {
  const queryTerms = tokenize(job.subject || job.title || job.searchText);
  if (!queryTerms.length && !job.isbn) return [];
  return items
    .map((item) => {
      const isbns = mergeLists([item.ISBN13, item.ISBN10], cleanList(item.formats).map((format) => format.isbn)).map(normalizeIsbn).filter(Boolean);
      const haystack = normalizeKey([
        item.title,
        item.description,
        cleanList(item.subjects).map((subject) => subject.name).join(" "),
        cleanList(item.contributors).map(formatOpenTextbookContributor).join(" "),
        isbns.join(" ")
      ].join(" "));
      const hits = queryTerms.filter((term) => haystack.includes(term));
      let score = hits.length * 12;
      if (job.isbn && isbns.includes(job.isbn)) score += 80;
      if (normalizeKey(item.title).includes(normalizeKey(job.title || job.searchText))) score += 25;
      if (job.subject && haystack.includes(normalizeKey(job.subject))) score += 18;
      if (Number(item.rating || 0)) score += Number(item.rating) * 2;
      if (Number(item.textbook_reviews_count || 0)) score += Math.min(10, Number(item.textbook_reviews_count));
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

function extractLinkedWikidataIds(entity) {
  const claims = entity.claims || {};
  return ["P50", "P123", "P921", "P136", "P31", "P407"].flatMap((property) => getClaimEntityIds(claims, property));
}

function labelsForClaim(claims, property, labelMap) {
  return getClaimEntityIds(claims, property).map((id) => labelMap[id] || id).filter(Boolean);
}

function getClaimEntityIds(claims, property) {
  return cleanList(claims[property])
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .map((value) => {
      if (!value) return "";
      if (value.id) return value.id;
      if (value["numeric-id"]) return `Q${value["numeric-id"]}`;
      return "";
    })
    .filter(Boolean);
}

function getClaimStrings(claims, property) {
  return cleanList(claims[property])
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value) => typeof value === "string");
}

function firstClaimTime(claims, property) {
  const value = cleanList(claims[property])[0]?.mainsnak?.datavalue?.value;
  const time = value?.time || "";
  const match = time.match(/^\+?(\d{1,4})-(\d{2})-(\d{2})/);
  if (!match) return { year: null, display: "" };
  const year = Number(match[1]);
  const precision = value.precision || 9;
  if (precision >= 11) return { year, display: `${match[1]}-${match[2]}-${match[3]}` };
  if (precision === 10) return { year, display: `${match[1]}-${match[2]}` };
  return { year, display: match[1] };
}

function firstClaimQuantity(claims, property) {
  const amount = cleanList(claims[property])[0]?.mainsnak?.datavalue?.value?.amount;
  return amount ? Number(String(amount).replace("+", "")) : null;
}

function abstractFromInvertedIndex(index) {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    cleanList(positions).forEach((position) => {
      words[position] = word;
    });
  }
  return words.filter(Boolean).join(" ");
}

function buildArchiveQuery(job) {
  const query = job.isbn
    ? `isbn:${job.isbn}`
    : `(${escapeArchiveTerm(job.searchText)}) AND mediatype:texts`;
  return query;
}

function buildPubMedTerm(job) {
  const base = job.studyQuery || job.searchText;
  const types = cleanList(job.studyFrame?.studyTypes);
  const typeFilter = types.includes("systematic review")
    ? "systematic review[Publication Type]"
    : types.includes("meta-analysis")
      ? "meta-analysis[Publication Type]"
      : types.includes("randomized trial")
        ? "randomized controlled trial[Publication Type]"
        : "";
  return [base, typeFilter].filter(Boolean).join(" AND ");
}

function buildArxivQuery(query) {
  const cleaned = escapeArchiveTerm(query);
  return cleaned ? `all:${cleaned}` : "all:book";
}

function escapeArchiveTerm(value) {
  return String(value || "")
    .replace(/[(){}[\]^~?:\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArxivEntries(xml) {
  return [...String(xml || "").matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => {
    const entry = match[1];
    return {
      id: xmlTag(entry, "id"),
      title: collapseWhitespace(xmlDecode(xmlTag(entry, "title"))),
      summary: collapseWhitespace(xmlDecode(xmlTag(entry, "summary"))),
      published: xmlTag(entry, "published"),
      authors: [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>\s*<\/author>/g)].map((author) => xmlDecode(author[1])).filter(Boolean),
      categories: [...entry.matchAll(/<category[^>]+term="([^"]+)"/g)].map((category) => xmlDecode(category[1])),
      doi: xmlTag(entry, "arxiv:doi") || xmlTag(entry, "doi")
    };
  });
}

function xmlTag(xml, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(xml || "").match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? xmlDecode(match[1]) : "";
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'");
}

function splitAuthorString(value) {
  return String(value || "")
    .split(/\s*,\s*(?=[A-Z][^,]+(?:,|$))|;\s*/)
    .map(cleanContributorName)
    .filter(Boolean)
    .slice(0, 8);
}

function buildGoogleQuery(parsed) {
  if (parsed.isbn) return `isbn:${parsed.isbn}`;
  if (parsed.searchCategory === "definitions" && parsed.definitionTerm) return parsed.definitionTerm;
  const parts = [];
  if (parsed.title && parsed.intent !== "subject") parts.push(`intitle:${quoteForProvider(parsed.title)}`);
  if (parsed.author) parts.push(`inauthor:${quoteForProvider(parsed.author)}`);
  if (parsed.subject) parts.push(parsed.subject);
  if (!parts.length) parts.push(parsed.searchText);
  return parts.join(" ");
}

function buildSearchText(parsed) {
  if (parsed.isbn) return parsed.isbn;
  if (parsed.searchCategory === "definitions" && parsed.definitionTerm) return parsed.definitionTerm;
  if (parsed.compareTerms.length >= 2) return parsed.compareTerms.join(" vs ");
  if (parsed.intent === "subject" && parsed.subject) return parsed.subject;
  if (parsed.title && parsed.author) return `${parsed.title} ${parsed.author}`;
  return parsed.title || parsed.subject || parsed.author || cleanPromptForSearch(parsed.raw, parsed.constraints);
}

function normalizeSearchCategory(value) {
  const key = normalizeKey(value || "auto");
  if (key === "papers" || key === "paper" || key === "research" || key === "study" || key === "studies" || key === "articles" || key === "article") return "studies";
  if (key === "definition" || key === "definitions" || key === "terms" || key === "reference") return "definitions";
  if (key === "book" || key === "books" || key === "catalog") return "books";
  if (key === "everything" || key === "broad" || key === "all sources" || key === "all") return "all";
  return SEARCH_CATEGORIES.has(key) ? key : "auto";
}

function inferSearchCategory(lower, context = {}) {
  if (context.definitionTerm || /\b(define|definition|meaning of|what does .+ mean|glossary|term)\b/.test(lower)) return "definitions";
  if (context.isbn || /\b(edition|isbn|publisher|audiobook|ebook)\b/.test(lower)) return "books";
  if (
    context.identifierHints?.doi?.length ||
    /\b(studies?|papers?|articles?|journal|doi|pubmed|clinical trial|randomized|meta[-\s]?analysis|systematic review|cohort|case-control|preprint|arxiv|scholar)\b/.test(lower) ||
    context.sourcePreferences?.includes("peer reviewed") ||
    context.domain === "scholarly"
  ) {
    return "studies";
  }
  if (/\b(books?|novels?|author|read)\b/.test(lower)) return "books";
  return "all";
}

function normalizePromptForReading(text) {
  return collapseWhitespace(String(text || "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\s+([?.!,;:])/g, "$1"));
}

function chooseIntent({ isbn, compareTerms, subject, questionAspects }) {
  if (isbn) return "isbn";
  if (compareTerms.length >= 2) return "compare";
  const scores = {
    author: questionAspects.includes("author") ? 7 : 0,
    publication: questionAspects.includes("publication") ? 7 : 0,
    recommendation: questionAspects.includes("recommendation") ? 6 : 0,
    themes: questionAspects.includes("themes") || questionAspects.includes("analysis") ? 5 : 0,
    summary: questionAspects.includes("summary") || questionAspects.includes("description") ? 4 : 0,
    subject: subject ? 3 : 0,
    search: 1
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function buildFocus(parsed) {
  const terms = [];
  if (parsed.searchCategory && parsed.searchCategory !== "all") terms.push(`${parsed.searchCategory} category`);
  if (parsed.definitionTerm) terms.push(`definition term "${parsed.definitionTerm}"`);
  if (parsed.isbn) terms.push(`ISBN ${parsed.isbn}`);
  if (parsed.compareTerms.length) terms.push(`compare ${parsed.compareTerms.join(" vs ")}`);
  if (parsed.title) terms.push(`title "${parsed.title}"`);
  if (parsed.author) terms.push(`author ${parsed.author}`);
  if (parsed.subject) terms.push(`subject ${parsed.subject}`);
  if (parsed.domain && parsed.domain !== "general") terms.push(`${parsed.domain} domain`);
  if (parsed.tasks?.length) terms.push(`tasks ${parsed.tasks.join(", ")}`);
  if (parsed.readerLevel) terms.push(`${parsed.readerLevel} reader`);
  if (parsed.readerGoal) terms.push(parsed.readerGoal);
  if (parsed.audience) terms.push(`${parsed.audience} audience`);
  if (parsed.requestedDepth) terms.push(`${parsed.requestedDepth} depth`);
  if (parsed.answerStyle) terms.push(`${parsed.answerStyle} answer`);
  if (parsed.requestedOutput) terms.push(`${parsed.requestedOutput} output`);
  if (parsed.editionPreferences?.length) terms.push(`edition ${parsed.editionPreferences.join(", ")}`);
  if (parsed.sourcePreferences?.length) terms.push(`sources ${parsed.sourcePreferences.join(", ")}`);
  if (parsed.spoilerPolicy) terms.push(parsed.spoilerPolicy);
  if (parsed.strictness && parsed.strictness !== "balanced") terms.push(`${parsed.strictness} matching`);
  if (parsed.evaluationCriteria?.length) terms.push(`criteria ${parsed.evaluationCriteria.join(", ")}`);
  if (parsed.negativeConstraints?.length) terms.push(`avoid ${parsed.negativeConstraints.join(", ")}`);
  if (parsed.studyFrame?.studyTypes?.length) terms.push(`study types ${parsed.studyFrame.studyTypes.join(", ")}`);
  if (parsed.studyFrame?.population) terms.push(`population ${parsed.studyFrame.population}`);
  const constraintText = describeConstraints(parsed.constraints);
  if (constraintText) terms.push(constraintText);
  const axes = parsed.comparisonAxes?.length ? `; axes: ${parsed.comparisonAxes.join(", ")}` : "";
  const aspects = parsed.questionAspects.length ? `${parsed.questionAspects.join(", ")}${axes}` : parsed.intent;
  return {
    primary: parsed.compareTerms.length ? parsed.compareTerms[0] : parsed.definitionTerm || parsed.title || parsed.subject || parsed.author || parsed.isbn || parsed.searchText,
    aspects,
    summary: terms.join("; ") || "plain catalog search"
  };
}

function buildHumanSearchPlan(parsed) {
  const targets = searchTargets(parsed);
  const identifierPairs = Object.entries(parsed.identifierHints || {})
    .flatMap(([kind, values]) => cleanList(values).map((value) => `${kind.toUpperCase()} ${value}`));
  const mustHave = unique([
    parsed.searchCategory && parsed.searchCategory !== "all" && `${parsed.searchCategory} category fit`,
    parsed.definitionTerm && `definition for "${parsed.definitionTerm}"`,
    parsed.isbn && `exact ISBN ${parsed.isbn}`,
    parsed.title && `title match for "${parsed.title}"`,
    parsed.author && `author/contributor match for ${parsed.author}`,
    parsed.compareTerms?.length >= 2 && `separate evidence for ${parsed.compareTerms.join(" and ")}`,
    parsed.subject && `subject relevance to ${parsed.subject}`,
    parsed.contributorHints?.translators?.length && `translator evidence: ${parsed.contributorHints.translators.join(", ")}`,
    parsed.constraints?.language && `${parsed.constraints.language} language`,
    parsed.constraints?.format && `${parsed.constraints.format} format`,
    parsed.constraints?.pages?.max && `under ${parsed.constraints.pages.max} pages`,
    parsed.constraints?.year?.after && `published after ${parsed.constraints.year.after}`,
    parsed.constraints?.access?.length && `${parsed.constraints.access.join("/")} access`,
    parsed.studyFrame?.studyTypes?.length && `study type: ${parsed.studyFrame.studyTypes.join(", ")}`,
    parsed.studyFrame?.population && `population: ${parsed.studyFrame.population}`,
    parsed.studyFrame?.outcome && `outcome: ${parsed.studyFrame.outcome}`,
    ...identifierPairs
  ].filter(Boolean));
  const niceToHave = unique([
    "cover image",
    "publisher/date agreement",
    "subject tags",
    "description or abstract",
    "multiple source families",
    parsed.searchCategory === "studies" && "study design metadata",
    parsed.searchCategory === "definitions" && "clear term explanation",
    parsed.readerLevel && `${parsed.readerLevel} reader fit`,
    parsed.audience && `${parsed.audience} fit`,
    ...cleanList(parsed.evaluationCriteria).map((criterion) => `${criterion} signal`),
    ...cleanList(parsed.editionPreferences).map((preference) => `${preference} signal`)
  ].filter(Boolean));
  const avoid = unique([
    ...cleanList(parsed.negativeConstraints),
    parsed.spoilerPolicy === "spoiler-free" && "plot-spoiler evidence",
    parsed.domain === "literary" && "scholarly homonyms that are not book records",
    "download or bypass links",
    "protected-preview scraping"
  ].filter(Boolean));
  const queryExpansions = buildHumanQueryExpansions(parsed, targets);
  const disambiguationPrompts = buildDisambiguationPrompts(parsed, targets);
  const sourceTiers = buildSourceTiers(parsed);
  const goal = buildHumanGoal(parsed, targets);
  const strategy = buildHumanStrategy(parsed, targets, sourceTiers);
  return {
    goal,
    strategy,
    targets,
    mustHave,
    niceToHave,
    avoid,
    queryExpansions,
    disambiguationPrompts,
    sourceTiers,
    verificationFlow: [
      "Lock identity with identifiers, exact title, author, and date clues.",
      "Fan out into catalog, knowledge graph, scholarly, and access-oriented searches.",
      "Collapse duplicate records into works and punish homonyms or constraint misses.",
      "Surface conflicts, citations, and next verification questions instead of hiding uncertainty."
    ],
    confidence: scoreEntityConfidence(parsed)
  };
}

function buildHumanGoal(parsed, targets) {
  if (parsed.searchCategory === "definitions") return `Define and contextualize ${parsed.definitionTerm || targets[0] || parsed.searchText}.`;
  if (parsed.searchCategory === "studies") return `Find evidence-grade studies for ${parsed.subject || parsed.title || parsed.searchText}.`;
  if (parsed.intent === "compare") return `Compare ${targets.join(" vs ")} with separate evidence lanes.`;
  if (parsed.intent === "isbn") return `Verify the exact edition identified by ${parsed.isbn}.`;
  if (parsed.intent === "recommendation" || parsed.intent === "subject") {
    return `Find ranked, source-backed books for ${parsed.subject || parsed.searchText}.`;
  }
  if (parsed.title) return `Identify and explain ${parsed.title} with citation-backed metadata.`;
  return `Turn the prompt into a source-backed book search.`;
}

function buildHumanStrategy(parsed, targets, sourceTiers) {
  const axisText = parsed.comparisonAxes?.length ? ` Then compare on ${parsed.comparisonAxes.join(", ")}.` : "";
  const targetText = targets.length ? targets.join("; ") : parsed.searchText;
  const firstTier = sourceTiers[0]?.label || "identity sources";
  const secondTier = sourceTiers[1]?.label || "context sources";
  return `Start with ${firstTier} to pin down ${targetText}; widen through ${secondTier} for context, then use access/scholarly tiers only when they improve the answer.${axisText}`;
}

function buildHumanQueryExpansions(parsed, targets) {
  const variants = [];
  const add = (value) => {
    if (value) variants.push(collapseWhitespace(value));
  };
  const translators = cleanList(parsed.contributorHints?.translators);
  const identifiers = Object.entries(parsed.identifierHints || {})
    .flatMap(([kind, values]) => cleanList(values).map((value) => `${kind}:${value}`));
  identifiers.forEach(add);
  if (parsed.isbn) add(`isbn:${parsed.isbn}`);
  if (parsed.definitionTerm) {
    add(`${parsed.definitionTerm} definition`);
    add(`${parsed.definitionTerm} meaning`);
    add(`${parsed.definitionTerm} encyclopedia`);
  }

  targets.forEach((target, index) => {
    const translator = translators[index] || translators[0] || "";
    add(target);
    if (parsed.author) add(`${target} ${parsed.author}`);
    if (translator) {
      add(`${target} ${translator} translation`);
      add(`${target} translated by ${translator}`);
    }
    if (parsed.domain === "literary") {
      add(`${target} book`);
      add(`${target} publication history`);
      add(`${target} themes`);
      add(`${target} edition`);
    }
    if (parsed.questionAspects?.includes("impact")) add(`${target} influence legacy`);
    if (parsed.questionAspects?.includes("availability")) add(`${target} public domain audiobook ebook`);
    if (parsed.sourcePreferences?.includes("peer reviewed")) add(`${target} scholarly criticism book`);
    if (parsed.searchCategory === "studies") {
      add(`${target} study`);
      add(`${target} systematic review`);
      add(`${target} meta-analysis`);
      add(`${target} DOI`);
    }
  });

  if (parsed.subject) {
    add(`${parsed.subject} books`);
    if (parsed.readerLevel === "beginner") add(`${parsed.subject} beginner books`);
    if (parsed.constraints?.format) add(`${parsed.subject} ${parsed.constraints.format} books`);
    if (parsed.constraints?.recency || parsed.evaluationCriteria?.includes("recency")) add(`${parsed.subject} recent books`);
    if (parsed.constraints?.access?.includes("open access") || parsed.sourcePreferences?.includes("open access")) add(`${parsed.subject} open access books`);
    if (parsed.constraints?.region) add(`${parsed.subject} books ${parsed.constraints.region}`);
    if (parsed.evaluationCriteria?.includes("data quality")) add(`${parsed.subject} data evidence books`);
    if (parsed.evaluationCriteria?.includes("source transparency")) add(`${parsed.subject} cited sources books`);
    if (parsed.domain === "policy") add(`${parsed.subject} policy books`);
    if (parsed.searchCategory === "studies") {
      add(`${parsed.subject} studies`);
      add(`${parsed.subject} systematic review`);
      add(`${parsed.subject} randomized trial`);
      add(`${parsed.subject} DOI`);
    }
  }

  cleanList(parsed.studyFrame?.studyTypes).forEach((type) => {
    add(`${parsed.subject || parsed.searchText} ${type}`);
  });

  cleanList(parsed.editionPreferences).forEach((preference) => {
    targets.forEach((target) => add(`${target} ${preference}`));
  });

  return unique(variants).slice(0, 14);
}

function buildDisambiguationPrompts(parsed, targets) {
  const prompts = [];
  if (!parsed.isbn && !parsed.author && parsed.title && normalizeKey(parsed.title).split(" ").length <= 2) {
    prompts.push(`Short title "${parsed.title}" may need an author or ISBN.`);
  }
  if (parsed.intent === "compare" && targets.some((target) => normalizeKey(target).split(" ").length <= 1)) {
    prompts.push("One-word comparison titles can collide with subjects, articles, and unrelated editions.");
  }
  if (parsed.editionPreferences?.includes("translation") && !parsed.contributorHints?.translators?.length) {
    prompts.push("Translation was requested but no translator was named.");
  }
  if ((parsed.intent === "recommendation" || parsed.intent === "subject") && !parsed.constraints?.format) {
    prompts.push("Subject searches improve if the user chooses fiction, nonfiction, textbook, or scholarship.");
  }
  if (parsed.strictness === "strict" && !Object.values(parsed.identifierHints || {}).some((values) => cleanList(values).length) && !parsed.author) {
    prompts.push("Strict matching is stronger with an ISBN, DOI, OCLC, LCCN, or author.");
  }
  return prompts;
}

function buildSourceTiers(parsed) {
  const tiers = [
    {
      label: "identity catalogs",
      sources: ["Open Library", "Google Books", "Library of Congress", "WorldCat"],
      reason: "title, author, ISBN, publisher, edition, and holding-style metadata"
    },
    {
      label: "context graphs",
      sources: ["Wikidata", "Wikipedia", "DBpedia", "BookBrainz"],
      reason: "entity disambiguation, summaries, aliases, and linked authority clues"
    },
    {
      label: "access and editions",
      sources: ["Internet Archive", "Gutendex", "Standard Ebooks", "LibriVox", "HathiTrust", "DOAB"],
      reason: "public-domain, open-access, audiobook, and edition availability signals"
    },
    {
      label: "scholarly signal",
      sources: ["OpenAlex", "Crossref", "DataCite", "Semantic Scholar", "OpenCitations"],
      reason: "DOI, citation, publication-type, and research graph evidence"
    },
    {
      label: "study databases",
      sources: ["PubMed", "Europe PMC", "arXiv", "Google Scholar"],
      reason: "paper, preprint, biomedical, life-sciences, and scholar search evidence"
    },
    {
      label: "definition/reference",
      sources: ["Wiktionary", "Wikipedia", "Wikidata", "DBpedia"],
      reason: "term meanings, encyclopedia context, aliases, and linked reference data"
    },
    {
      label: "metadata-only scouts",
      sources: ["Google Scholar", "Anna's Archive", "Scribd"],
      reason: "safe search link-outs only, without protected scraping, downloads, or bypasses"
    }
  ];
  if (parsed.searchCategory === "definitions") {
    return [tiers[5], tiers[1], tiers[0], tiers[3], tiers[6]];
  }
  if (parsed.searchCategory === "studies") {
    return [tiers[4], tiers[3], tiers[1], tiers[0], tiers[6]];
  }
  if (parsed.searchCategory === "books") {
    return [tiers[0], tiers[2], tiers[1], tiers[3], tiers[6]];
  }
  if (parsed.domain === "scholarly" || parsed.sourcePreferences?.includes("peer reviewed")) {
    return [tiers[4], tiers[3], tiers[0], tiers[1], tiers[6]];
  }
  if (parsed.constraints?.access?.length || parsed.questionAspects?.includes("availability")) {
    return [tiers[0], tiers[2], tiers[1], tiers[3], tiers[6]];
  }
  if (parsed.intent === "recommendation" || parsed.intent === "subject") {
    return [tiers[0], tiers[3], tiers[2], tiers[1], tiers[6]];
  }
  return tiers;
}

function searchTargets(parsed) {
  if (parsed.compareTerms?.length) return parsed.compareTerms.slice(0, 4);
  return unique([
    parsed.definitionTerm,
    parsed.title,
    parsed.subject,
    parsed.author && !parsed.title ? parsed.author : "",
    parsed.isbn,
    parsed.searchText
  ].filter(Boolean)).slice(0, 4);
}

function buildSourceQuery(parsed, mode) {
  if (parsed.isbn) return parsed.isbn;
  const base = parsed.definitionTerm || (parsed.title && parsed.author ? `${parsed.title} ${parsed.author}` : parsed.title || parsed.subject || parsed.author || parsed.searchText);
  if (mode === "definition") return parsed.definitionTerm || parsed.subject || parsed.title || parsed.searchText;
  if (mode === "knowledge") return parsed.title || parsed.subject || parsed.author || base;
  if (mode === "study" || mode === "scholar") {
    return unique([
      parsed.identifierHints?.doi?.[0] ? `doi:${parsed.identifierHints.doi[0]}` : "",
      parsed.subject && parsed.studyFrame?.studyTypes?.[0] ? `${parsed.subject} ${parsed.studyFrame.studyTypes[0]}` : "",
      parsed.subject || parsed.title || parsed.searchText,
      parsed.evaluationCriteria?.includes("data quality") ? `${base} data evidence` : ""
    ].filter(Boolean))[0] || base;
  }
  if (mode === "scholarly") {
    const scholarlyHints = [
      base,
      parsed.subject && parsed.domain === "policy" ? `${parsed.subject} policy book` : "",
      parsed.sourcePreferences?.includes("peer reviewed") ? `${base} scholarly book` : "",
      parsed.evaluationCriteria?.includes("data quality") ? `${base} data evidence` : ""
    ];
    return unique(scholarlyHints.filter(Boolean))[0] || base;
  }
  if (mode === "public-domain") {
    return [base, parsed.editionPreferences?.includes("audiobook") && "audiobook", parsed.sourcePreferences?.includes("public domain") && "public domain"].filter(Boolean).join(" ");
  }
  if (mode === "metadata") return parsed.title || parsed.subject || parsed.searchText || base;
  return base;
}

function sourceQueryVariants(job, mode = "catalog", limit = 2) {
  const modeQuery = {
    google: job.googleQuery,
    catalog: job.locQuery,
    knowledge: job.wikiQuery,
    scholarly: job.scholarlyQuery,
    study: job.studyQuery,
    definition: job.definitionQuery,
    scholar: job.scholarQuery,
    "public-domain": job.publicDomainQuery,
    metadata: job.metadataQuery
  }[mode];
  return unique([
    modeQuery,
    job.searchText,
    ...(job.queryVariants || [])
  ].filter(Boolean)).slice(0, limit);
}

function buildQueryVariants(parsed) {
  const variants = [
    parsed.isbn,
    parsed.title,
    parsed.title && parsed.author ? `${parsed.title} ${parsed.author}` : "",
    parsed.subject,
    parsed.author,
    parsed.searchText
  ];
  if (parsed.readerLevel === "beginner" && parsed.subject) variants.push(`introduction ${parsed.subject}`);
  if (parsed.questionAspects?.includes("themes") && parsed.title) variants.push(`${parsed.title} themes`);
  if (parsed.questionAspects?.includes("edition") && parsed.title) variants.push(`${parsed.title} edition`);
  if (parsed.editionPreferences?.length && parsed.title) variants.push(`${parsed.title} ${parsed.editionPreferences.slice(0, 2).join(" ")}`);
  if (parsed.contributorHints?.translators?.length && parsed.title) variants.push(`${parsed.title} ${parsed.contributorHints.translators[0]}`);
  if (parsed.domain === "literary" && parsed.title) {
    variants.push(`${parsed.title} novel`);
    variants.push(`${parsed.title} book`);
  }
  cleanList(parsed.humanSearchPlan?.queryExpansions).forEach((variant) => {
    if (!parsed.title || normalizeKey(variant).includes(normalizeKey(parsed.title)) || parsed.intent !== "compare-item") {
      variants.push(variant);
    }
  });
  Object.entries(parsed.identifierHints || {}).forEach(([kind, values]) => {
    cleanList(values).forEach((value) => variants.push(`${kind}:${value}`));
  });
  return unique(variants.filter(Boolean)).slice(0, 12);
}

function describeConstraints(constraints) {
  const parts = [];
  if (constraints.year?.after) parts.push(`after ${constraints.year.after}`);
  if (constraints.year?.before) parts.push(`before ${constraints.year.before}`);
  if (constraints.year?.between) parts.push(`between ${constraints.year.between[0]} and ${constraints.year.between[1]}`);
  if (constraints.pages?.max) parts.push(`under ${constraints.pages.max} pages`);
  if (constraints.pages?.min) parts.push(`over ${constraints.pages.min} pages`);
  if (constraints.language) parts.push(`${constraints.language} language`);
  if (constraints.format) parts.push(`${constraints.format} format`);
  if (constraints.recency) parts.push(`${constraints.recency} preference`);
  if (constraints.awardSignal) parts.push("award/prize signal");
  if (constraints.access?.length) parts.push(`${constraints.access.join("/")} access`);
  if (constraints.region) parts.push(`${constraints.region} context`);
  if (constraints.rating) parts.push(`${constraints.rating} rating preference`);
  return parts.join(", ");
}

function extractIdentifierHints(text) {
  const raw = String(text || "");
  const explicitIsbns = [...raw.matchAll(/\bisbn(?:-1[03])?\s*[:#]?\s*((?:97[89][-\s]?)?\d[\d-\s]{8,17}[\dXx])\b/gi)]
    .map((match) => normalizeIsbn(match[1]))
    .filter((value) => value.length === 10 || value.length === 13);
  const fallbackIsbn = extractIsbn(raw);
  const doiMatches = [...raw.matchAll(/\b(?:doi\s*[:#]?\s*|https?:\/\/(?:dx\.)?doi\.org\/)(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi)]
    .map((match) => normalizeDoi(match[1]));
  const bareDoiMatches = /\bdoi\b/i.test(raw)
    ? [...raw.matchAll(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/gi)].map((match) => normalizeDoi(match[1]))
    : [];
  const oclcMatches = [...raw.matchAll(/\b(?:oclc|worldcat)\s*[:#]?\s*(oc[nm])?\s*([0-9]{3,})\b/gi)]
    .map((match) => match[2]);
  const lccnMatches = [...raw.matchAll(/\blccn\s*[:#]?\s*([a-z0-9\- ]{4,24})\b/gi)]
    .map((match) => collapseWhitespace(match[1]).replace(/\s+/g, ""));

  return {
    isbn: unique([...explicitIsbns, fallbackIsbn].filter(Boolean)),
    doi: unique([...doiMatches, ...bareDoiMatches].filter(Boolean)),
    oclc: unique(oclcMatches),
    lccn: unique(lccnMatches)
  };
}

function extractTitleAuthorPairs(text, quoted = []) {
  const raw = normalizePromptForReading(text);
  const pairs = [];
  const pushPair = (title, author) => {
    const cleanTitle = cleanTitleFragment(title);
    const cleanAuthor = cleanContributorName(author);
    if (cleanTitle && cleanAuthor && !/^(book|novel|story|work|edition)$/i.test(cleanTitle)) {
      pairs.push({ title: cleanTitle, author: cleanAuthor });
    }
  };

  quoted.forEach((title) => {
    const pattern = new RegExp(`["']${escapeRegExp(title)}["']\\s+(?:by|from)\\s+([^,;?.]+(?:\\s+[A-Z][\\w.'-]+){0,5})`, "i");
    const match = raw.match(pattern);
    if (match) pushPair(title, match[1]);
  });

  [...raw.matchAll(/\b([A-Z][A-Za-z0-9:'’\-]+(?:\s+(?:of|the|and|in|to|a|an|[A-Z][A-Za-z0-9:'’\-]+)){0,8})\s+by\s+([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){0,5})\b/g)]
    .forEach((match) => {
      if (!/\b(books?|novels?|works?|stories?)\s+by\b/i.test(match[0])) pushPair(match[1], match[2]);
    });

  return uniqueBy(pairs, (pair) => `${normalizeKey(pair.title)}:${normalizeKey(pair.author)}`).slice(0, 6);
}

function extractContributorHints(text) {
  const raw = normalizePromptForReading(text);
  const collect = (pattern) => unique([...raw.matchAll(pattern)]
    .flatMap((match) => splitContributorNames(match[1]))
    .map(cleanContributorFragment)
    .filter(Boolean));
  return {
    translators: collect(/\b(?:translated\s+by|translator\s*[:=])\s+(.+?)(?=\s+(?:vs\.?|versus|for|with|focus|give|output|avoid|no|and\s+["'A-Z])\b|[,;?.]|$)/gi),
    editors: collect(/\b(?:edited\s+by|editor\s*[:=])\s+(.+?)(?=\s+(?:vs\.?|versus|for|with|focus|give|output|avoid|no|and\s+["'A-Z])\b|[,;?.]|$)/gi),
    narrators: collect(/\b(?:narrated\s+by|read\s+by|narrator\s*[:=])\s+(.+?)(?=\s+(?:vs\.?|versus|for|with|focus|give|output|avoid|no|and\s+["'A-Z])\b|[,;?.]|$)/gi)
  };
}

function splitContributorNames(value) {
  return String(value || "")
    .split(/\s+(?:and|&)\s+|,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanContributorFragment(value) {
  return cleanContributorName(String(value || "")
    .replace(/\s+(?:vs\.?|versus)\s+.*$/i, "")
    .replace(/\b(translated|edited|narrated|read)\s+by\b.*$/i, "")
    .replace(/\s+\b(?:for|with|focus|give|output|avoid|no)\b.*$/i, ""));
}

function extractEditionPreferences(lower) {
  const checks = [
    ["best edition", /\bbest\s+(?:edition|version|translation)\b/],
    ["translation", /\b(translation|translated|translator)\b/],
    ["annotated edition", /\bannotated\b/],
    ["critical edition", /\bcritical\s+edition|scholarly\s+edition|norton\b/],
    ["first edition", /\bfirst\s+edition|original\s+edition|first\s+published\b/],
    ["latest edition", /\blatest\s+edition|newest\s+edition|updated\s+edition\b/],
    ["unabridged", /\bunabridged\b/],
    ["abridged", /\babridged\b/],
    ["illustrated", /\billustrated\b/],
    ["audiobook", /\baudiobook|audio\s+book|narrated|read\s+by\b/],
    ["ebook", /\bebook|e-book|kindle|epub\b/],
    ["paperback", /\bpaperback\b/],
    ["hardcover", /\bhardcover|hardback\b/],
    ["public domain", /\bpublic\s+domain\b/]
  ];
  return unique(checks.filter(([, pattern]) => pattern.test(lower)).map(([label]) => label));
}

function extractSourcePreferences(lower) {
  const checks = [
    ["citations", /\b(citations?|cite|cited|sources?|source-backed|well[-\s]?sourced)\b/],
    ["identifier evidence", /\b(isbn|doi|oclc|lccn|identifier|edition-level)\b/],
    ["peer reviewed", /\b(peer[-\s]?reviewed|scholarly\s+sources?|academic\s+sources?|journal\s+(?:sources?|articles?))\b/],
    ["library catalogs", /\b(library|catalog|worldcat|holdings)\b/],
    ["open access", /\b(open[-\s]?access|oa)\b/],
    ["public domain", /\bpublic\s+domain\b/],
    ["full text", /\b(full\s+text|read\s+online|borrow|available)\b/],
    ["reviews", /\b(reviews?|ratings?|reader response)\b/],
    ["metadata audit", /\b(verify|verification|conflicts?|cross[-\s]?check|provenance)\b/]
  ];
  return unique(checks.filter(([, pattern]) => pattern.test(lower)).map(([label]) => label));
}

function extractSpoilerPolicy(lower) {
  if (/\b(no|avoid|without|spoiler[-\s]?free)\s+spoilers?\b|\bspoiler[-\s]?free\b/.test(lower)) return "spoiler-free";
  if (/\bspoilers?\s+(?:ok|okay|allowed|fine)\b|\bwith\s+spoilers?\b/.test(lower)) return "spoilers allowed";
  return "";
}

function extractStrictness(lower) {
  if (/\b(exact|only|must|required|strict|no substitutes|do not include)\b/.test(lower)) return "strict";
  if (/\b(prefer|ideally|if possible|roughly|similar|nearby|around)\b/.test(lower)) return "flexible";
  return "balanced";
}

function extractTasks(lower, context = {}) {
  const tasks = [];
  if (context.searchCategory === "definitions" || context.definitionTerm) tasks.push("definition lookup");
  if (context.searchCategory === "studies" || context.studyFrame?.studyTypes?.length) tasks.push("study search");
  if (context.isbn) tasks.push("identifier lookup");
  if (context.compareTerms?.length >= 2) tasks.push("compare works");
  if (!context.isbn && (context.questionAspects?.includes("recommendation") || /\b(recommend|suggest|find|best|starters?|beginners?|read next|reading list)\b/.test(lower))) tasks.push("recommend");
  if (context.questionAspects?.includes("summary")) tasks.push("summarize");
  if (context.questionAspects?.includes("themes") || context.questionAspects?.includes("analysis")) tasks.push("analyze themes");
  if (context.questionAspects?.includes("publication")) tasks.push("publication history");
  if (context.questionAspects?.includes("author")) tasks.push("authorship");
  if (context.editionPreferences?.length || /\b(edition|translation|translator|isbn|format|audiobook|audio book|ebook|e-book|hardcover|paperback)\b/.test(lower)) tasks.push("edition/translation check");
  if (context.questionAspects?.includes("availability") || context.sourcePreferences?.some((preference) => /full text|public domain|open access/.test(preference))) tasks.push("access check");
  if (context.sourcePreferences?.some((preference) => /citations|identifier|metadata audit|peer reviewed/.test(preference))) tasks.push("evidence audit");
  if (context.readerGoal === "reading order") tasks.push("reading order");
  if (context.requestedOutput === "timeline") tasks.push("timeline");
  if (context.subject && !tasks.length) tasks.push("subject research");
  return unique(tasks);
}

function buildIntentFrame(parsed) {
  const targetKind = parsed.isbn
    ? "specific edition"
    : parsed.searchCategory === "definitions"
      ? "definition term"
      : parsed.searchCategory === "studies"
        ? "study question"
        : parsed.compareTerms?.length >= 2
      ? "multiple works"
      : parsed.subject
        ? "subject area"
        : parsed.title
          ? "single work"
          : "open search";
  const entityConfidence = scoreEntityConfidence(parsed);
  const evidenceDemand = parsed.sourcePreferences?.length
    ? parsed.sourcePreferences.includes("peer reviewed") || parsed.sourcePreferences.includes("identifier evidence") ? "high" : "medium"
    : "standard";
  return {
    primaryTask: parsed.tasks?.[0] || parsed.intent,
    tasks: parsed.tasks || [],
    targetKind,
    domain: parsed.domain || "general",
    searchCategory: parsed.searchCategory || "all",
    definitionTerm: parsed.definitionTerm || "",
    studyFrame: parsed.studyFrame || {},
    entityConfidence,
    evidenceDemand,
    strictness: parsed.strictness || "balanced",
    spoilerPolicy: parsed.spoilerPolicy || "",
    editionPreferences: parsed.editionPreferences || [],
    sourcePreferences: parsed.sourcePreferences || [],
    searchStrategy: parsed.humanSearchPlan?.strategy || "",
    searchTargets: parsed.humanSearchPlan?.targets || [],
    contributors: parsed.contributorHints || {},
    identifiers: parsed.identifierHints || {},
    needsDisambiguation: entityConfidence < 70 || (parsed.promptProfile?.ambiguity || []).length > 0 || cleanList(parsed.humanSearchPlan?.disambiguationPrompts).length > 0
  };
}

function scoreEntityConfidence(parsed) {
  let score = 40;
  if (parsed.isbn || parsed.identifierHints?.doi?.length || parsed.identifierHints?.oclc?.length || parsed.identifierHints?.lccn?.length) score += 35;
  if (parsed.title) score += 18;
  if (parsed.author) score += 14;
  if (parsed.compareTerms?.length >= 2) score += 18;
  if (parsed.subject) score += 10;
  if (parsed.titleAuthorPairs?.length) score += 16;
  if (parsed.domain && parsed.domain !== "general") score += 5;
  if (!parsed.title && !parsed.subject && !parsed.compareTerms?.length && !parsed.isbn) score -= 25;
  if (parsed.promptProfile?.ambiguity?.length) score -= parsed.promptProfile.ambiguity.length * 8;
  return clamp(Math.round(score), 0, 100);
}

function extractQuestionAspects(lower) {
  const aspects = [];
  const checks = [
    ["author", /\b(who\s+wrote|author\s+of|written\s+by|writer|attributed\s+to)\b/],
    ["publication", /\b(when|what\s+year|published|publication|release\s+date|first\s+published|edition\s+date)\b/],
    ["summary", /\b(summary|summarize|plot|synopsis|what\s+is|what's|tell\s+me\s+about|about)\b/],
    ["themes", /\b(theme|themes|motif|motifs|symbolism|meaning|message|ideas|important|importance|why\s+it\s+matters)\b/],
    ["analysis", /\b(analy[sz]e|analysis|deep\s+read|critical|scholarly|interpret)\b/],
    ["recommendation", /\b(similar|recommend|recommendation|books\s+like|read\s+next|suggest|starters?|beginners?|what\s+to\s+read|reading list)\b/],
    ["comparison", /\b(compare|versus|vs\.?|difference|similarities|better|which\s+should|what\s+to\s+read\s+first)\b/],
    ["edition", /\b(edition|translation|translator|publisher|pages|isbn|format|audiobook|ebook)\b/],
    ["availability", /\b(full\s+text|borrow|read\s+online|public\s+domain|download|available|audiobook|free)\b/],
    ["difficulty", /\b(difficulty|hard|easy|accessible|dense|beginner[-\s]?friendly)\b/],
    ["impact", /\b(impact|influence|legacy|important|significance|canon|award|reputation)\b/],
    ["style", /\b(style|voice|prose|tone|structure|pacing)\b/]
  ];
  checks.forEach(([aspect, pattern]) => {
    if (pattern.test(lower)) aspects.push(aspect);
  });
  return unique(aspects);
}

function extractComparisonAxes(lower) {
  const axes = [];
  const checks = [
    ["themes", /\b(theme|themes|motif|symbolism|ideas|political|religious|ecological)\b/],
    ["publication history", /\b(publication history|first published|release|editions?|translation)\b/],
    ["reading order", /\b(read first|where to start|start with|reading order)\b/],
    ["difficulty", /\b(difficulty|hard|easy|accessible|dense|beginner)\b/],
    ["style", /\b(style|prose|voice|tone|pacing|structure)\b/],
    ["influence", /\b(impact|influence|legacy|canon|important|significance)\b/],
    ["availability", /\b(audiobook|ebook|public domain|read online|available|free)\b/],
    ["evidence quality", /\b(citations?|sources?|isbn|doi|oclc|lccn|verify|conflicts?)\b/]
  ];
  checks.forEach(([axis, pattern]) => {
    if (pattern.test(lower)) axes.push(axis);
  });
  return unique(axes);
}

function extractReaderGoal(lower) {
  if (/\b(book club|discussion group)\b/.test(lower)) return "book-club discussion";
  if (/\b(class|course|school|assignment|syllabus)\b/.test(lower)) return "class assignment";
  if (/\b(research paper|essay|thesis|scholarly)\b/.test(lower)) return "research writing";
  if (/\b(gift|present)\b/.test(lower)) return "gift choice";
  if (/\b(read first|where to start|starting point|should\s+i\s+read\s+.+?\s+first)\b/.test(lower)) return "reading order";
  return "";
}

function extractAnswerStyle(lower) {
  if (/\b(table|matrix|chart)\b/.test(lower)) return "matrix";
  if (/\b(timeline|chronology)\b/.test(lower)) return "timeline";
  if (/\b(bullets?|checklist)\b/.test(lower)) return "bullets";
  if (/\b(deep|detailed|comprehensive|insanely)\b/.test(lower)) return "deep synthesis";
  return "";
}

function extractAudience(lower) {
  if (/\b(book club|discussion group)\b/.test(lower)) return "book club";
  if (/\b(teacher|classroom|school|students?|college|university|course|syllabus)\b/.test(lower)) return "classroom";
  if (/\b(kids?|children|middle grade|young readers?)\b/.test(lower)) return "young readers";
  if (/\b(teens?|young adult|ya)\b/.test(lower)) return "teens";
  if (/\b(researchers?|scholars?|academic)\b/.test(lower)) return "research";
  if (/\b(gift|present|friend|parent|dad|mom|partner)\b/.test(lower)) return "gift";
  if (/\b(beginner|new reader|starter|intro)\b/.test(lower)) return "beginner";
  return "";
}

function extractEvaluationCriteria(lower) {
  const criteria = [];
  const checks = [
    ["accuracy", /\b(accurate|reliable|source-backed|well[-\s]?sourced|credible)\b/],
    ["beginner friendliness", /\b(beginner|accessible|easy|intro|starter|not too dense)\b/],
    ["depth", /\b(deep|comprehensive|detailed|scholarly|advanced)\b/],
    ["brevity", /\b(short|concise|quick|under\s+\d+\s+pages?)\b/],
    ["recency", /\b(recent|new|current|up[-\s]?to[-\s]?date|modern|contemporary)\b/],
    ["literary quality", /\b(beautiful|prose|style|literary|well[-\s]?written)\b/],
    ["popularity", /\b(popular|widely read|bestseller|ratings?|demand)\b/],
    ["scholarly impact", /\b(citations?|impact|influence|legacy|important|canon)\b/],
    ["availability", /\b(public domain|free|read online|audiobook|ebook|available)\b/],
    ["discussion value", /\b(book club|discussion|debate|questions?)\b/],
    ["data quality", /\b(data|statistics|evidence|empirical|charts?)\b/],
    ["policy relevance", /\b(policy|law|regulation|public sector|government)\b/],
    ["regional fit", /\b(us context|u\.s\. context|american context|uk context|global south|regional)\b/],
    ["source transparency", /\b(provenance|citations?|sources?|cross[-\s]?check|verification)\b/]
  ];
  checks.forEach(([criterion, pattern]) => {
    if (pattern.test(lower)) criteria.push(criterion);
  });
  return unique(criteria);
}

function extractNegativeConstraints(text) {
  const lower = String(text || "").toLowerCase();
  const constraints = [];
  const checks = [
    ["textbooks", /\b(?:avoid|no|not)\s+(?:textbooks?|manuals?)\b|\bnot\s+textbooks?\b/],
    ["academic density", /\b(?:avoid|no|not too|less)\s+(?:academic|dense|scholarly|technical)\b/],
    ["academic monographs", /\b(?:avoid|no|not)\s+(?:academic\s+)?monographs?\b/],
    ["young adult", /\b(?:avoid|no|not)\s+(?:ya|young adult|teen)\b/],
    ["fiction", /\b(?:avoid|no|not)\s+fiction\b/],
    ["nonfiction", /\b(?:avoid|no|not)\s+nonfiction\b/],
    ["long books", /\b(?:avoid|no|not too)\s+(?:long|huge|big)\b/],
    ["old books", /\b(?:avoid|no|not)\s+(?:old|dated|classic)\b/],
    ["graphic novels", /\b(?:avoid|no|not)\s+(?:graphic novels?|manga|comics?)\b/],
    ["spoilers", /\b(?:avoid|no|without)\s+spoilers?\b|\bspoiler[-\s]?free\b/],
    ["paywalled access", /\b(?:avoid|no|not)\s+(?:paywalled|subscription|locked)\b/]
  ];
  checks.forEach(([constraint, pattern]) => {
    if (pattern.test(lower)) constraints.push(constraint);
  });
  return unique(constraints);
}

function extractRequestedOutput(lower) {
  if (/\b(table|matrix|spreadsheet)\b/.test(lower)) return "comparison table";
  if (/\b(timeline|chronology)\b/.test(lower)) return "timeline";
  if (/\b(reading list|list)\b/.test(lower)) return "reading list";
  if (/\b(verdict|which one|pick one|choose)\b/.test(lower)) return "verdict";
  if (/\b(summary|brief)\b/.test(lower)) return "summary";
  if (/\b(deep dive|deep analysis|comprehensive)\b/.test(lower)) return "deep brief";
  return "";
}

function extractDefinitionTerm(raw, lower) {
  const patterns = [
    /\bdefine\s+["']?(.+?)["']?(?:[?.!]|$)/i,
    /\bdefinition\s+of\s+["']?(.+?)["']?(?:[?.!]|$)/i,
    /\bmeaning\s+of\s+["']?(.+?)["']?(?:[?.!]|$)/i,
    /\bwhat\s+does\s+["']?(.+?)["']?\s+mean\b/i,
    /\bwhat\s+is\s+["']?(.+?)["']?\s+(?:in|for|within)\s+.+?(?:[?.!]|$)/i
  ];
  if (!/\b(define|definition|meaning|what\s+does|glossary|term)\b/.test(lower)) return "";
  for (const pattern of patterns) {
    const match = String(raw || "").match(pattern);
    if (!match) continue;
    return cleanDefinitionTerm(match[1]);
  }
  return "";
}

function cleanDefinitionTerm(value) {
  return cleanTitleFragment(value)
    .replace(/\s+\b(?:in|for|within|and|with|from|using)\b.*$/i, "")
    .replace(/\b(?:a|an|the)\s+definition\s+of\b/gi, " ")
    .trim();
}

function extractStudyFrame(raw, lower, context = {}) {
  const hasStudySignal = /\b(studies?|papers?|articles?|journal|doi|pubmed|clinical trial|randomi[sz]ed|rct|meta[-\s]?analysis|systematic review|cohort|case-control|preprint|arxiv|scholar|evidence-grade|peer[-\s]?reviewed)\b/.test(lower);
  if (!hasStudySignal) {
    return {
      studyTypes: [],
      population: "",
      intervention: "",
      outcome: "",
      fields: [],
      evidenceLevel: "unspecified"
    };
  }
  const studyTypes = unique([
    /\b(systematic reviews?)\b/.test(lower) && "systematic review",
    /\b(meta[-\s]?analys(?:is|es))\b/.test(lower) && "meta-analysis",
    /\b(randomi[sz]ed|rct|clinical trial|trial)\b/.test(lower) && "randomized trial",
    /\b(cohort)\b/.test(lower) && "cohort study",
    /\b(case[-\s]?control)\b/.test(lower) && "case-control study",
    /\b(longitudinal)\b/.test(lower) && "longitudinal study",
    /\b(qualitative|interviews?|ethnograph)\b/.test(lower) && "qualitative study",
    /\b(review article|literature review)\b/.test(lower) && "review article",
    /\b(preprint|arxiv)\b/.test(lower) && "preprint"
  ].filter(Boolean));
  const population = extractStudySlot(raw, /\b(?:in|among|for)\s+([a-z][^,.;?]+?)\s+(?:with|who|using|after|before|and|to|$)/i);
  const intervention = extractStudySlot(raw, /\b(?:intervention|treatment|therapy|exposure)\s*[:=]?\s*([^,.;?]+)/i)
    || extractStudySlot(raw, /\b(?:effect of|impact of)\s+([^,.;?]+?)\s+(?:on|for|in)\b/i);
  const outcome = extractStudySlot(raw, /\b(?:outcome|endpoint|effect on|impact on|for)\s+([^,.;?]+)/i);
  const fields = unique([
    context.subject,
    context.title,
    population,
    intervention,
    outcome,
    ...studyTypes
  ].filter(Boolean));
  return {
    studyTypes,
    population,
    intervention,
    outcome,
    fields,
    evidenceLevel: studyTypes.some((type) => /systematic|meta|randomized/i.test(type)) ? "high" : studyTypes.length ? "moderate" : "unspecified"
  };
}

function extractStudySlot(raw, pattern) {
  const match = String(raw || "").match(pattern);
  if (!match) return "";
  return cleanSubjectFragment(match[1]);
}

function extractPromptEntities({ raw, quoted, title, author, subject, compareTerms }) {
  const entities = {
    titles: unique([...cleanList(compareTerms), ...cleanList(title), ...quoted]),
    authors: unique(cleanList(author)),
    subjects: unique(cleanList(subject)),
    dates: [...String(raw || "").matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)].map((match) => Number(match[1]))
  };
  entities.entityCount = entities.titles.length + entities.authors.length + entities.subjects.length + entities.dates.length;
  return entities;
}

function buildPromptProfile(parsed) {
  const complexity = [
    parsed.questionAspects.length > 1 && "multi-question",
    parsed.comparisonAxes.length > 1 && "multi-axis comparison",
    Object.keys(parsed.constraints || {}).length && "constraint-aware",
    parsed.negativeConstraints.length && "exclusion-aware",
    parsed.audience && "audience-aware",
    parsed.domain && parsed.domain !== "general" && `${parsed.domain}-domain`,
    parsed.searchCategory && parsed.searchCategory !== "all" && `${parsed.searchCategory}-category`,
    parsed.definitionTerm && "definition-aware",
    parsed.studyFrame?.studyTypes?.length && "study-design-aware",
    parsed.tasks?.length >= 3 && "multi-task",
    parsed.editionPreferences?.length && "edition-aware",
    parsed.sourcePreferences?.length >= 2 && "source-policy-aware",
    parsed.spoilerPolicy && "spoiler-policy-aware",
    parsed.identifierHints && Object.values(parsed.identifierHints).some((values) => cleanList(values).length) && "identifier-aware",
    parsed.contributorHints && Object.values(parsed.contributorHints).some((values) => cleanList(values).length) && "contributor-aware",
    parsed.evaluationCriteria.length >= 2 && "criteria-rich",
    parsed.entities.entityCount >= 3 && "entity-rich"
  ].filter(Boolean);
  return {
    complexity,
    complexityScore: Math.min(100, 18 + complexity.length * 10 + parsed.questionAspects.length * 5 + parsed.evaluationCriteria.length * 4 + cleanList(parsed.tasks).length * 3),
    domain: parsed.domain || "general",
    searchCategory: parsed.searchCategory || "all",
    definitionTerm: parsed.definitionTerm || "",
    studyFrame: parsed.studyFrame || {},
    tasks: parsed.tasks || [],
    strictness: parsed.strictness || "balanced",
    evidenceDemand: parsed.sourcePreferences?.length ? "elevated" : "standard",
    readingMode: parsed.intent === "compare" ? `${parsed.domain || "general"} comparative research` : parsed.readerGoal || parsed.intent,
    ambiguity: inferPromptAmbiguity(parsed)
  };
}

function inferPromptDomain(lower, context = {}) {
  const scores = {
    literary: 0,
    scholarly: 0,
    nonfiction: 0,
    "reader-advisory": 0,
    policy: 0
  };
  if (/\b(themes?|plot|characters?|world[-\s]?building|publication history|read first|reading order|novels?|fiction|sci[-\s]?fi|science fiction|fantasy|literary|story|series|canon|adaptations?)\b/i.test(lower)) scores.literary += 3;
  if (/\b(citations?|doi|journal|paper|article|scholarly|peer[-\s]?reviewed|research study|impact factor|monograph)\b/i.test(lower)) scores.scholarly += 4;
  if (/\b(nonfiction|history|science|business|policy|data|climate|economics|biography|memoir)\b/i.test(lower)) scores.nonfiction += 2;
  if (/\b(recommend|suggest|read next|book club|beginner|gift|starter)\b/i.test(lower)) scores["reader-advisory"] += 3;
  if (/\b(policy|law|regulation|government|public sector|us context|u\.s\. context)\b/i.test(lower)) scores.policy += 4;
  if (context.compareTerms?.length >= 2 && context.editionPreferences?.includes("translation")) scores.literary += 4;
  if (context.constraints?.format === "nonfiction") scores.nonfiction += 3;
  if (context.intent === "recommendation") scores["reader-advisory"] += 2;
  if (context.intent === "compare" && scores.literary) scores.literary += 1;
  if (scores.policy >= 4) return "policy";
  if (scores.scholarly >= scores.literary + 3) return "scholarly";
  if (scores.literary >= 3) return "literary";
  if (scores["reader-advisory"] >= 3) return "reader-advisory";
  if (scores.nonfiction >= 3) return "nonfiction";
  if (context.constraints?.format === "nonfiction") return "nonfiction";
  if (context.intent === "recommendation") return "reader-advisory";
  return "general";
}

function inferPromptAmbiguity(parsed) {
  const flags = [];
  if (!parsed.isbn && !parsed.author && parsed.title && parsed.title.split(/\s+/).length <= 2) flags.push("short title may collide with other works");
  if (parsed.domain === "literary" && parsed.intent === "compare" && parsed.compareTerms.some((term) => normalizeKey(term).split(" ").length <= 1)) flags.push("short literary titles may collide with subjects, articles, and unrelated editions");
  if (parsed.intent === "subject" && !parsed.constraints.format) flags.push("subject search spans fiction, nonfiction, scholarship, and editions");
  if (parsed.intent === "compare" && parsed.compareTerms.length < 2) flags.push("comparison terms are incomplete");
  if (parsed.editionPreferences?.includes("translation") && !parsed.contributorHints?.translators?.length) flags.push("translation requested without a named translator");
  if (parsed.sourcePreferences?.includes("identifier evidence") && !Object.values(parsed.identifierHints || {}).some((values) => cleanList(values).length)) flags.push("identifier evidence requested but no identifier was supplied");
  if (parsed.strictness === "strict" && !parsed.isbn && !parsed.author && !parsed.titleAuthorPairs?.length) flags.push("strict matching requested without ISBN, DOI, or author");
  if (parsed.tasks?.length >= 4) flags.push("multi-task prompt may need prioritized answer sections");
  if (!parsed.title && !parsed.subject && !parsed.isbn && !parsed.compareTerms.length) flags.push("search target is broad");
  return flags;
}

function extractConstraints(text) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const constraints = { year: {}, pages: {} };
  const after = lower.match(/\b(?:after|since|post[-\s]?)\s*(1[0-9]{3}|20[0-9]{2})\b/);
  const before = lower.match(/\b(?:before|pre[-\s]?|until|older than)\s*(1[0-9]{3}|20[0-9]{2})\b/);
  const between = lower.match(/\bbetween\s+(1[0-9]{3}|20[0-9]{2})\s+(?:and|-|to)\s+(1[0-9]{3}|20[0-9]{2})\b/);
  const maxPages = lower.match(/\b(?:under|less than|fewer than|below)\s+(\d{2,4})\s+pages?\b/);
  const minPages = lower.match(/\b(?:over|more than|above)\s+(\d{2,4})\s+pages?\b/);
  const pageRange = lower.match(/\b(?:between|from)\s+(\d{2,4})\s+(?:and|-|to)\s+(\d{2,4})\s+pages?\b/);
  const language = lower.match(/\b(?:in|language:)\s+(english|spanish|french|german|russian|japanese|chinese|arabic|latin)\b/);
  const format = lower.match(/\b(audiobook|audio book|ebook|e-book|paperback|hardcover|graphic novel|manga|poetry|nonfiction|fiction)\b/);
  const currentYear = new Date().getFullYear();

  if (after) constraints.year.after = Number(after[1]);
  if (before) constraints.year.before = Number(before[1]);
  if (between) constraints.year.between = [Number(between[1]), Number(between[2])].sort((a, b) => a - b);
  if (pageRange) {
    const pages = [Number(pageRange[1]), Number(pageRange[2])].sort((a, b) => a - b);
    constraints.pages.min = pages[0];
    constraints.pages.max = pages[1];
  }
  if (maxPages) constraints.pages.max = Number(maxPages[1]);
  if (minPages) constraints.pages.min = Number(minPages[1]);
  if (!constraints.year.after && /\b(recent|newer|new|contemporary|up[-\s]?to[-\s]?date|current)\b/.test(lower)) {
    constraints.year.after = currentYear - 8;
    constraints.recency = "recent";
  }
  if (!constraints.year.before && /\b(classic|older|pre[-\s]?2000)\b/.test(lower)) {
    constraints.year.before = /pre[-\s]?2000/.test(lower) ? 2000 : 1990;
    constraints.recency = "classic";
  }
  if (!constraints.pages.max && /\b(short|quick read|not too long|concise)\b/.test(lower)) {
    constraints.pages.max = 260;
  }
  if (!constraints.pages.min && /\b(long|big|epic|comprehensive)\b/.test(lower) && !/\bnot too long\b/.test(lower)) {
    constraints.pages.min = 350;
  }
  if (language) constraints.language = language[1];
  if (format) constraints.format = format[1].replace("audio book", "audiobook").replace("e-book", "ebook");
  if (/\baward[-\s]?winning|prize[-\s]?winning|hugos?|nebula|booker|pulitzer|national book award\b/.test(lower)) {
    constraints.awardSignal = true;
  }
  const accessLower = lower.replace(/\bspoiler[-\s]?free\b/g, " ");
  if (/\b(open[-\s]?access|public\s+domain|free|read\s+online|full\s+text)\b/.test(accessLower)) {
    constraints.access = unique([
      /open[-\s]?access/.test(accessLower) && "open access",
      /public\s+domain/.test(accessLower) && "public domain",
      /\bfree\b|read\s+online|full\s+text/.test(accessLower) && "full text"
    ].filter(Boolean));
  }
  if (/\b(us context|u\.s\. context|american context|united states)\b/.test(lower)) constraints.region = "United States";
  if (/\b(highly rated|best rated|top rated|4\+ stars?)\b/.test(lower)) constraints.rating = "high";
  if (!Object.keys(constraints.year).length) delete constraints.year;
  if (!Object.keys(constraints.pages).length) delete constraints.pages;
  return constraints;
}

function extractIsbn(text) {
  const match = String(text || "").match(/\b(?:isbn(?:-1[03])?\s*[:#]?\s*)?((?:97[89][-\s]?)?\d[\d-\s]{8,17}[\dXx])\b/i);
  if (!match) return "";
  const normalized = normalizeIsbn(match[1]);
  return normalized.length === 10 || normalized.length === 13 ? normalized : "";
}

function extractQuoted(text) {
  return [...String(text || "").matchAll(/"([^"]+)"|'([^']+)'/g)]
    .map((match) => cleanTitleFragment(match[1] || match[2] || ""))
    .filter(Boolean);
}

function extractCompareTerms(text, quoted = [], titleAuthorPairs = []) {
  const raw = normalizePromptForReading(text);
  if (quoted.length >= 2 && /\b(compare|versus|vs\.?|difference|similarities|between)\b/i.test(raw)) {
    return quoted.slice(0, 4).map(cleanCompareTerm).filter(Boolean);
  }
  if (titleAuthorPairs.length >= 2 && /\b(compare|versus|vs\.?|difference|similarities|between|which|read first)\b/i.test(raw)) {
    return titleAuthorPairs.map((pair) => pair.title).slice(0, 4);
  }

  const vsTerms = raw.split(/\s+(?:vs\.?|versus)\s+/i);
  if (vsTerms.length >= 3) {
    return vsTerms.flatMap(splitCompareSide).map(cleanCompareTerm).filter(Boolean).slice(0, 4);
  }

  const patterns = [
    /\bcompare\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+?)(?:\s+(?:for|about|on|by|in terms of)\b|[?.!]|$)/i,
    /\b(?:difference|similarities)\s+between\s+(.+?)\s+and\s+(.+?)(?:\s+(?:for|about|on|by|in terms of)\b|[?.!]|$)/i,
    /^(.+?)\s+(?:vs\.?|versus)\s+(.+?)(?:\s+(?:for|about|on|by|in terms of)\b|[?.!]|$)/i,
    /\bshould\s+i\s+read\s+(.+?)\s+(?:or|and|vs\.?)\s+(.+?)\s+first(?:\s+(?:for|about|on|by|in terms of)\b|[?.!]|$)/i,
    /\bwhich\s+(?:should\s+i\s+)?(?:read|pick|choose)\s+first[:,]?\s+(.+?)\s+(?:or|and|vs\.?)\s+(.+?)(?:[?.!]|$)/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    return splitCompareSide(match[1]).concat(splitCompareSide(match[2])).map(cleanCompareTerm).filter(Boolean).slice(0, 4);
  }

  return [];
}

function cleanCompareTerm(text) {
  return cleanTitleFragment(text)
    .replace(/\s+\b(for|about|with|by looking at|in terms of|themes|publication|history|what to read first)\b.*$/i, "")
    .trim();
}

function splitCompareSide(text) {
  return String(text || "")
    .split(/\s*,\s*|\s+;\s+/)
    .map((part) => part.replace(/\b(the\s+book|novel|book)\b/gi, " "))
    .filter((part) => cleanTitleFragment(part));
}

function extractAuthor(text, quoted = []) {
  const explicit = String(text || "").match(/\b(?:author|inauthor)\s*[:=]\s*([^?]+)/i);
  if (explicit) return cleanTitleFragment(explicit[1]);
  const writtenBy = String(text || "").match(/\b(?:written|wrote|authored)\s+by\s+([^?.,;]+(?:\s+[A-Z][\w.'-]+){0,5})/i);
  if (writtenBy) return cleanTitleFragment(writtenBy[1]);
  const byPattern = /\bby\s+([^?]+?)(?:\s+(?:for|about|with|and\s+(?:tell|give|explain|compare)|what|when|why|how)\b|[?.!]|$)/i;
  const by = byPattern.exec(String(text || ""));
  if (!by) return "";
  const prefix = String(text || "").slice(Math.max(0, by.index - 18), by.index).toLowerCase();
  if (/(translated|edited|narrated|read)\s+$/.test(prefix)) return "";
  const candidate = by[1].replace(/\b(and|with)\b.*$/i, "");
  if (quoted.some((title) => normalizeKey(candidate).includes(normalizeKey(title)))) return "";
  return cleanTitleFragment(candidate);
}

function extractSubject(text, constraints = {}) {
  const audienceSubject = String(text || "").match(/\b(?:books|novels|works|stories|recommendations|texts)\s+for\s+(?:beginners?|students?|kids|teens?|adults?|researchers?)\s+(?:about|on|covering)\s+(.+?)(?:\s+(?:for|with|after|before|under|over|that|which)\b|[?.!]|$)/i);
  if (audienceSubject) return cleanSubjectFragment(audienceSubject[1]);
  const frontLoadedSubject = String(text || "").match(/\b(?:find|recommend|suggest|show\s+me|give\s+me)?\s*(?:recent|new|current|open[-\s]?access|public[-\s]?domain|beginner|best|good|reliable|source-backed|nonfiction|fiction|short|introductory|\s)*([a-z][a-z\s-]{2,60}?)\s+(?:books|novels|works|texts)\s+for\s+(?:policy\s+)?(?:beginners?|students?|kids|teens?|adults?|researchers?|book clubs?|classes?)\b/i);
  if (frontLoadedSubject) return cleanSubjectFragment(frontLoadedSubject[1]);
  const match = String(text || "").match(/\b(?:books|novels|works|stories|recommendations|texts)\s+(?:about|on|covering)\s+(.+?)(?:\s+(?:for|with|after|before|under|over|that|which)\b|[?.!]|$)/i);
  if (match) return cleanSubjectFragment(match[1]);
  const directSubject = String(text || "").match(/\b(?:about|on|covering|regarding)\s+(.+?)(?:\s+(?:for|with|after|before|under|over|that|which|and\s+(?:avoid|prioritize|give|output))\b|[?.!]|$)/i);
  if (directSubject && /\b(book|books|recommend|find|source|read|research)\b/i.test(text)) return cleanSubjectFragment(directSubject[1]);
  if (directSubject && /\b(studies?|papers?|articles?|reviews?|doi|pubmed|scholar|clinical|trial|meta[-\s]?analysis|systematic)\b/i.test(text)) return cleanSubjectFragment(directSubject[1]);
  const subject = String(text || "").match(/\bsubject\s*[:=]\s*([^?]+)/i);
  if (subject) return cleanSubjectFragment(subject[1]);
  const topic = String(text || "").match(/\b(?:topic|theme)\s*[:=]\s*([^?]+)/i);
  if (topic) return cleanSubjectFragment(topic[1]);
  if (constraints.format === "nonfiction") {
    const nonfiction = String(text || "").match(/\bnonfiction\s+(?:about|on|for)\s+(.+?)(?:[?.!]|$)/i);
    if (nonfiction) return cleanSubjectFragment(nonfiction[1]);
  }
  return "";
}

function cleanSubjectFragment(text) {
  return cleanTitleFragment(text)
    .replace(/\s+\b(with|using|that|which)\b.*$/i, "")
    .replace(/\b(?:for\s+)?(?:beginners?|students?|kids|teens?|adults?|researchers?)\s+(?:about|on)\b/gi, " ")
    .replace(/\b(reliable|source-backed|source backed|accurate|sharp|good|best|beginner|starter|recent|new|current|open access|open-access|public domain|public-domain|nonfiction|fiction|introductory|short|studies|study|papers|articles|reviews|systematic|doi|pubmed|scholar)\b/gi, " ")
    .replace(/\b(or|and)\b\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferTitle(raw, context) {
  const { quoted, author, subject, compareTerms, intent, constraints, titleAuthorPairs, isbn } = context;
  if (isbn) return "";
  if (intent === "compare" || compareTerms.length) return "";
  if (quoted.length) return quoted[0];
  if (titleAuthorPairs?.length === 1) return titleAuthorPairs[0].title;
  return extractTitle(raw, { author, subject, intent, constraints });
}

function extractTitle(text, context = {}) {
  const patterns = [
    /\bwho\s+wrote\s+(.+?)(?:\?|$)/i,
    /\bauthor\s+of\s+(.+?)(?:\?|$)/i,
    /\bwhen\s+was\s+(.+?)\s+(?:first\s+)?published\b/i,
    /\btell\s+me\s+about\s+(.+?)(?:\?|$)/i,
    /\bexplain\s+(.+?)(?:\s+(?:for|with|and|by)\b|[?.!]|$)/i,
    /\banaly[sz]e\s+(.+?)(?:\s+(?:for|with|and|by)\b|[?.!]|$)/i,
    /\bsummary\s+of\s+(.+?)(?:\?|$)/i,
    /\bthemes?\s+(?:in|of)\s+(.+?)(?:\?|$)/i,
    /\bwhy\s+(?:is|was)\s+(.+?)\s+(?:important|significant|worth\s+reading)\b/i,
    /\bshould\s+i\s+read\s+(.+?)(?:\?|$)/i,
    /\bbest\s+(?:edition|translation)\s+of\s+(.+?)(?:\?|$)/i,
    /\bbooks\s+like\s+(.+?)(?:\?|$)/i,
    /\bsimilar\s+to\s+(.+?)(?:\?|$)/i,
    /\b(?:called|titled|named)\s+["']?(.+?)["']?(?:[?.!]|$)/i,
    /\bwhat\s+is\s+(.+?)\s+about\b/i,
    /\bwhat'?s\s+(.+?)\s+about\b/i
  ];
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return cleanTitleFragment(match[1]);
  }
  const cleaned = cleanPromptForSearch(text, context.constraints);
  if (context.subject && normalizeKey(cleaned) === normalizeKey(context.subject)) return "";
  if (/\b(recommend|beginner|starter|best|books about)\b/i.test(text) && context.subject) return "";
  return cleaned;
}

function cleanPromptForSearch(text, constraints = {}) {
  let cleaned = String(text || "")
    .replace(/\b(please|can you|could you|give me|show me|find me|search for|information on|info on|i need|need)\b/gi, " ")
    .replace(/\b(book|books|novel|novels|data|information|summary|analysis|deep|detailed|accurate|source-backed|reliable)\b/gi, " ")
    .replace(/\b(after|since|before|under|over|between)\s+\d{2,4}(?:\s+(?:and|to|-)\s+\d{2,4})?\b/gi, " ")
    .replace(/\b(?:under|over|less than|more than|fewer than)\s+\d{2,4}\s+pages?\b/gi, " ");

  [constraints.language, constraints.format].filter(Boolean).forEach((value) => {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, "gi"), " ");
  });

  return cleanTitleFragment(cleaned);
}

function cleanTitleFragment(text) {
  return collapseWhitespace(text)
    .replace(/\s+(?:and|,)\s+(?:when|what|who|where|why|how|is|was|does|give|tell)\b.*$/i, "")
    .replace(/\s+\bby\s+[^,?]+$/i, "")
    .replace(/\b(?:for|about|with|including|covering)\s+(?:themes?|publication|history|reader|beginners?|students?|adults?).*$/i, "")
    .replace(/^[\s:,-]+|[\s:,.!?-]+$/g, "")
    .replace(/^the\s+book\s+/i, "")
    .trim();
}

function buildSignals(parsed) {
  const signals = [];
  if (parsed.searchCategory) signals.push(`category: ${parsed.searchCategory}`);
  if (parsed.definitionTerm) signals.push(`definition: ${parsed.definitionTerm}`);
  if (parsed.isbn) signals.push("ISBN");
  if (parsed.title) signals.push("title");
  if (parsed.author) signals.push("author");
  if (parsed.subject) signals.push("subject");
  if (parsed.compareTerms.length) signals.push("comparison");
  if (parsed.domain && parsed.domain !== "general") signals.push(`domain: ${parsed.domain}`);
  cleanList(parsed.tasks).forEach((task) => signals.push(`task: ${task}`));
  cleanList(parsed.questionAspects).forEach((aspect) => signals.push(aspect));
  cleanList(parsed.comparisonAxes).forEach((axis) => signals.push(`axis: ${axis}`));
  const constraintText = describeConstraints(parsed.constraints || {});
  if (constraintText) signals.push(`constraints: ${constraintText}`);
  if (parsed.requestedDepth) signals.push(`${parsed.requestedDepth} depth`);
  if (parsed.readerLevel) signals.push(parsed.readerLevel);
  if (parsed.readerGoal) signals.push(parsed.readerGoal);
  if (parsed.answerStyle) signals.push(parsed.answerStyle);
  if (parsed.spoilerPolicy) signals.push(parsed.spoilerPolicy);
  if (parsed.strictness && parsed.strictness !== "balanced") signals.push(`${parsed.strictness} matching`);
  if (parsed.audience) signals.push(`audience: ${parsed.audience}`);
  if (parsed.requestedOutput) signals.push(`output: ${parsed.requestedOutput}`);
  cleanList(parsed.editionPreferences).forEach((preference) => signals.push(`edition: ${preference}`));
  cleanList(parsed.sourcePreferences).forEach((preference) => signals.push(`source: ${preference}`));
  Object.entries(parsed.identifierHints || {}).forEach(([key, values]) => {
    if (cleanList(values).length) signals.push(`${key}: ${cleanList(values).join("/")}`);
  });
  cleanList(parsed.evaluationCriteria).forEach((criterion) => signals.push(`criterion: ${criterion}`));
  cleanList(parsed.negativeConstraints).forEach((constraint) => signals.push(`avoid: ${constraint}`));
  cleanList(parsed.studyFrame?.studyTypes).forEach((type) => signals.push(`study: ${type}`));
  if (parsed.studyFrame?.evidenceLevel && parsed.studyFrame.evidenceLevel !== "unspecified") signals.push(`evidence: ${parsed.studyFrame.evidenceLevel}`);
  if (parsed.intent !== "search") signals.push(parsed.intent);
  return unique(signals);
}

function labelForIntent(intent) {
  return {
    isbn: "ISBN lookup",
    compare: "Compare",
    author: "Author answer",
    publication: "Publication date",
    recommendation: "Recommend",
    themes: "Theme analysis",
    subject: "Subject search",
    summary: "Summary",
    search: "Catalog search"
  }[intent] || "Catalog search";
}

function extractRequestedDepth(lower) {
  if (/\b(deep|detailed|full|comprehensive|scholarly|advanced|insanely)\b/.test(lower)) return "deep";
  if (/\b(quick|brief|simple|short|fast)\b/.test(lower)) return "quick";
  return "balanced";
}

function extractReaderLevel(lower) {
  if (/\b(beginners?|new readers?|starters?|intro|introduction)\b/.test(lower)) return "beginner";
  if (/\b(expert|scholar|academic|advanced)\b/.test(lower)) return "advanced";
  if (/\b(teen|student|class|school)\b/.test(lower)) return "student";
  return "";
}

function sanitizeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (/(^|\.)annas-archive\.org$/i.test(url.hostname) && /\/(md5|fast_download|slow_download|download)\b/i.test(url.pathname)) return "";
    if (/(^|\.)scribd\.com$/i.test(url.hostname) && /\/(read|document_downloads|download)\b/i.test(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function normalizeUrl(url) {
  const raw = firstValue(url);
  if (!raw) return "";
  if (raw.startsWith("//")) return sanitizeExternalUrl(`https:${raw}`);
  if (raw.startsWith("/")) return sanitizeExternalUrl(`https://www.loc.gov${raw}`);
  return sanitizeExternalUrl(raw);
}

function datePartsToString(value) {
  const parts = cleanList(value?.["date-parts"]?.[0]);
  return parts.length ? parts.join("-") : "";
}

function formatCrossrefAuthor(author) {
  return collapseWhitespace(`${author.given || ""} ${author.family || ""}`) || author.name || "";
}

function formatOpenTextbookContributor(contributor) {
  if (!contributor || typeof contributor !== "object") return "";
  if (contributor.corporate) return contributor.title || contributor.name || "";
  return collapseWhitespace([
    contributor.first_name,
    contributor.middle_name,
    contributor.last_name
  ].filter(Boolean).join(" "));
}

function cleanContributorName(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(author|editor|contributor|creator)\b/gi, "")
    .replace(/,\s*$/g, "")
    .trim();
}

function parseByStatementAuthors(value) {
  const statement = String(value || "").split(";")[0] || "";
  return statement
    .replace(/\btranslated\s+.+$/i, "")
    .replace(/\bwith\s+.+$/i, "")
    .split(/\s+(?:and|&)\s+|,\s+(?=[A-Z])/)
    .map(cleanContributorName)
    .filter(Boolean);
}

function quoteForProvider(value) {
  return /\s/.test(value) ? `"${value}"` : value;
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeIsbn(value) {
  return String(value || "").replace(/[^0-9Xx]/g, "").toUpperCase();
}

function normalizeDoi(value) {
  return String(value || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:/i, "").trim().toLowerCase();
}

function normalizeYear(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value) {
  const stop = new Set(["the", "and", "for", "with", "about", "into", "from", "book", "books", "novel", "novels", "best", "good", "beginner", "starter", "reliable"]);
  return unique(normalizeKey(value).split(/\s+/).filter((term) => term.length > 2 && !stop.has(term)));
}

function includesNormalized(list, needle) {
  const needleKey = normalizeKey(needle);
  if (!needleKey) return false;
  return cleanList(list).some((item) => normalizeKey(item).includes(needleKey) || needleKey.includes(normalizeKey(item)));
}

function joinTitle(title, subtitle) {
  if (!title) return "";
  if (!subtitle || normalizeKey(title).includes(normalizeKey(subtitle))) return title;
  return `${title}: ${subtitle}`;
}

function mergeLists(...lists) {
  const seen = new Set();
  return lists.flat()
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .filter(Boolean)
    .map((item) => String(item))
    .filter((item) => {
      const key = normalizeKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function countBy(values, keyFn) {
  return cleanList(values).reduce((accumulator, value) => {
    const key = keyFn(value) || "unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function topTerms(values, limit = 8) {
  const counts = countBy(values, (value) => cleanTitleFragment(value));
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

function cleanList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== "") : [value];
}

function firstValue(value) {
  return cleanList(value)[0] || "";
}

function pickIsbn(values) {
  const normalized = cleanList(values).map(normalizeIsbn).filter(Boolean);
  return normalized.find((value) => value.length === 13) || normalized[0] || "";
}

function unique(values) {
  const seen = new Set();
  return cleanList(values).filter((value) => {
    const key = typeof value === "string" ? normalizeKey(value) : JSON.stringify(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  return cleanList(values).filter((value) => {
    const key = keyFn(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeLanguage(value) {
  const key = normalizeKey(value);
  return {
    en: "english",
    eng: "english",
    english: "english",
    es: "spanish",
    spa: "spanish",
    spanish: "spanish",
    fr: "french",
    fre: "french",
    fra: "french",
    french: "french",
    de: "german",
    ger: "german",
    deu: "german",
    german: "german"
  }[key] || key;
}

function languagesMatch(actual, expected) {
  return normalizeLanguage(actual) === normalizeLanguage(expected);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function makeCacheKey(value) {
  return `${ANALYSIS_VERSION}:${hashString(JSON.stringify(value))}`;
}

function readCache(key) {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return cached.payload;
}

function writeCache(key, payload) {
  memoryCache.set(key, {
    createdAt: Date.now(),
    payload
  });
  if (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
}

module.exports = {
  ANALYSIS_VERSION,
  SOURCE_CATALOG,
  analyzePrompt,
  buildQueryPlan,
  buildSourceStatusSnapshot,
  fuseRecords,
  getSourceCatalog,
  parsePrompt,
  sanitizeExternalUrl
};
