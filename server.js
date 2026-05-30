"use strict";

require("dotenv").config();

const path = require("node:path");
const express = require("express");
const {
  analyzePrompt,
  getSourceCatalog,
  buildSourceStatusSnapshot
} = require("./src/book-intelligence");

const app = express();
const port = Number(process.env.PORT || 4173);

app.disable("x-powered-by");
app.use(express.json({ limit: "96kb" }));

app.get("/api/sources/status", (_request, response) => {
  response.json({
    generatedAt: new Date().toISOString(),
    sources: buildSourceStatusSnapshot(process.env)
  });
});

app.post("/api/analyze", async (request, response) => {
  const prompt = String(request.body?.prompt || "").trim();
  const options = request.body?.options && typeof request.body.options === "object" ? request.body.options : {};

  if (!prompt) {
    response.status(400).json({ error: "Prompt is required." });
    return;
  }

  if (prompt.length > 2400) {
    response.status(413).json({ error: "Prompt is too long. Keep it under 2400 characters." });
    return;
  }

  try {
    const result = await analyzePrompt(prompt, {
      env: process.env,
      options,
      fetchImpl: global.fetch
    });
    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: "Analysis failed.",
      detail: error?.message || "Unknown backend error"
    });
  }
});

app.get("/api/source-catalog", (_request, response) => {
  response.json({ sources: getSourceCatalog(process.env) });
});

app.use(express.static(__dirname, {
  extensions: ["html"],
  maxAge: "2h",
  setHeaders(response, filePath) {
    if (filePath.endsWith(".html")) {
      response.setHeader("Cache-Control", "no-store");
    }
  }
}));

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Atlas Research running at http://localhost:${port}`);
});
