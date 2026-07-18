# Atlas Bibliotheca

Atlas Research is a local HTML-based research intelligence console. It accepts natural-language prompts, routes them by category (`books`, `studies`, `definitions`, or `all`), queries a 28-source provider mesh, fuses evidence, flags conflicts, and returns a citation-backed answer.

## Run

```powershell
npm install
npm start
```

Open `http://localhost:4173`.

## Keep Localhost Running After Restart

Atlas includes a Windows launcher at `scripts/start-atlas-localhost.ps1`. The launcher checks port `4173`, starts `node server.js` only when needed, writes launcher events to `atlas-launcher.log`, and writes server output to `atlas-server.out.log` and `atlas-server.err.log`.

The current machine is configured with a current-user Startup shortcut named `Atlas Bibliotheca Localhost.lnk`, so the local server starts again after Windows sign-in without admin rights.

## Sources

- Open Library
- Google Books
- Library of Congress
- Wikidata
- Wikipedia
- DBpedia
- Wiktionary
- Wikisource
- Internet Archive
- Gutendex / Project Gutenberg
- Standard Ebooks, metadata/search link-out only
- LibriVox
- OpenAlex
- Crossref
- DataCite
- Semantic Scholar
- Google Scholar, metadata/search link-out only
- PubMed
- Europe PMC
- arXiv
- OpenCitations
- HathiTrust
- Open Textbook Library
- DOAB, metadata/search link-out only
- BookBrainz, metadata/search link-out only
- Anna's Archive, metadata/search link-out only
- Scribd, metadata/search link-out only
- WorldCat, optional credentialed provider

Google Scholar, Anna's Archive, and Scribd are deliberately metadata-only link-outs. Atlas does not fetch copyrighted downloads, scrape protected previews, expose mirror/hash download paths, scrape Google Scholar result pages, or bypass access controls.

## Optional Configuration

Copy `.env.example` to `.env` and set values as needed.

- `ENABLE_OPENAI_SYNTHESIS=true` and `OPENAI_API_KEY=...` enables hybrid LLM synthesis.
- `WORLDCAT_API_URL` and `WORLDCAT_API_KEY` enable the optional WorldCat adapter.
- Without optional keys, Atlas still runs deterministic source-backed synthesis.

## API

- `POST /api/analyze`
  Accepts `{ "prompt": "...", "options": { "searchCategory": "auto|books|studies|definitions|all" } }` and returns parsed intent, source statuses, normalized records, fused works, conflicts, citations, answer sections, and AI status.
- `GET /api/sources/status`
  Returns the configured source list and current availability state.

The app federates live sources rather than shipping a fake local 200M-book database. Large-scale commercial coverage requires licensed catalog access behind the same adapter interface.
