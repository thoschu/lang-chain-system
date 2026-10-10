# LangChain System

A learning and experimentation project around LangChain.js: a RAG agent that answers
questions about the LangChain documentation and cites its sources, plus an
ingestion pipeline, a small web chat UI, a hand-built LangGraph ReAct graph, and the
[Factory](factory/README.md) — a LangGraph graph that sends features through the SDLC
using Claude Code workers.

![LangChain](langchain.png)

## Overview

```
docs.langchain.com ──Firecrawl──▶ ingestion.ts ──Ollama embeddings──▶ Chroma
                                                                        │
Browser ──▶ Angular (4200, iframe) ──▶ Express (8008) ──▶ core.ts (ReAct agent)
                                                            │
                                                     Ollama (qwen3:1.7b)
```

| Part | File | What it does |
|---|---|---|
| Agent | `src/core.ts` | ReAct agent with a retriever tool on Chroma (`k: 6`). Exports `agent` (for LangGraph Studio) and `runLlm()`. |
| Ingestion | `src/ingestion.ts` | Pipeline A: load `src/documents/sample.txt` via Unstructured, split it, connect to Pinecone. Pipeline B: crawl `docs.langchain.com` with Firecrawl, split into 800-character chunks and write them to Chroma (`collection-1`). |
| Playground | `src/index.ts` | Experiments: tool-calling agent with Tavily, manual agent loop with LangSmith tracing, retrieval chain with and without LCEL on Pinecone. |
| LangGraph ReAct graph | `src/react-agent-executor.ts` | Hand-built `StateGraph` (`init → reasoning ⇄ tool → increment → double`) that answers a sample question and writes the rendered graph to `graph.png`. |
| Graph building blocks | `src/react.ts`, `src/nodes.ts`, `src/types.ts` | Tools (`triple_tool`, `to_upper_case_tool`, `firecrawl_search_tool`), the tool-bound models (Ollama `nemotron-3.5-lightning`, Claude `claude-sonnet-5-5`), the reasoning and tool nodes, and the state schema. |
| Server | `src/server.js` | Express + EJS on port 8008. `GET /` serves the chat UI, `POST /api/llm` accepts `{ "question": "..." }` and responds with `{ content, metadata }` (source URLs). |
| Frontend | `frontend/` | Angular 19 app that embeds the server's chat UI via an iframe. |
| Factory | `factory/` | Standalone package, see [factory/README.md](factory/README.md). |
| Logger | `src/logger.ts` | Colored console output (`logInfo`, `logSuccess`, `logHeader`, …). |

## Prerequisites

- Node.js (ESM, TypeScript 5.9)
- [Ollama](https://ollama.com) on `localhost:11434` with these models:
  ```bash
  ollama pull qwen3:1.7b              # RAG agent (core.ts)
  ollama pull mxbai-embed-large       # embeddings
  ollama pull nemotron-3.5-lightning  # LangGraph ReAct graph (react.ts)
  ```
- Docker for Chroma, Unstructured, and optionally Firecrawl/Langfuse
- For Firecrawl and Langfuse, the compose files are expected in the sibling
  folders `../firecrawl` and `../langfuse`.

## Setup

```bash
npm install
npm --prefix ./frontend install
```

Create a `.env` in the project root (not checked in):

| Variable | Purpose |
|---|---|
| `PROD` | `true` turns off the verbose `console.dir` output |
| `ANTHROPIC_API_KEY`, `GROQ_API_KEY` | alternative chat models in `index.ts`; `ANTHROPIC_API_KEY` is also needed by `react.ts` |
| `LANGSMITH_TRACING`, `LANGSMITH_ENDPOINT`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` | tracing with LangSmith |
| `TAVILY_API_KEY` | web search tool |
| `FIRECRAWL_API_KEY` | only for the hosted Firecrawl instance; locally it runs on `localhost:3002` |
| `UNSTRUCTURED_API_KEY`, `UNSTRUCTURED_API_URL` | document loader (locally e.g. `http://localhost:8002`) |
| `PINECONE_API_KEY`, `PINECONE_INDEX`, `PINECONE_ENVIRONMENT` | Pinecone vector store |

## Starting the infrastructure

```bash
npm run docker:up          # both of the following
npm run docker:intern:up   # Chroma (8000), Chroma UI (8001), Unstructured (8002)
npm run docker:extern:up   # Firecrawl (../firecrawl) and Langfuse (../langfuse)
```

Chroma data is stored in `./chroma-data`.

## Usage

```bash
npm run ingestion   # crawl the docs and index them in Chroma — once before the first chat
npm start           # build and start the server on http://localhost:8008
npm run frontend    # Angular app on http://localhost:4200
```

More scripts:

| Script | What it does |
|---|---|
| `npm run core` | Asks the agent "Was ist LangChain?" once and prints the result |
| `npm run index` | Runs the experiments from `src/index.ts` |
| `npm run react-agent-executor` | Runs the LangGraph ReAct graph and writes `graph.png` |
| `npm run nodemon` | `tsc --watch` and restarts `dist/index.js` on changes |
| `npm run langgraph-cli:dev` | Starts LangGraph Studio with the `agent` graph from `langgraph.json` |
| `npm run typecheck:server` | Type check for the server |
| `npm run lint` / `npm run lint:fix` | ESLint (with auto-fix) |
| `npm run docker:firecrawl:down` | Stops the Firecrawl containers |
| `npm run clean` | Removes `dist/` and `node_modules/` |

Calling the API directly:

```bash
curl -X POST http://localhost:8008/api/llm \
  -H 'Content-Type: application/json' \
  -d '{"question": "What is a retriever in LangChain?"}'
```

## Notes

- `mxbai-embed-large` has a context limit of 512 tokens. That's why
  `truncate: true` is set and chunks are limited to 800 characters — otherwise
  Ollama rejects the entire batch.
- In `markdown` format, Firecrawl returns the full text. The `json` format needs
  an LLM key in the self-hosted instance and silently returns empty results
  without one.
- The server imports `dist/core.js`, so you must build before `npm run server`
  (`npm start` takes care of that).
- `firecrawl_search_tool` in `react.ts` uses the local Firecrawl instance on
  `localhost:3002`, so it must be running for the ReAct graph's web search.

## LangGraph ReAct graph

Generated by `npm run react-agent-executor`:

![LangGraph Graph](/graph.png)
