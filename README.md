# Fluent PDF Studio

An AI chatbot that designs and compiles real, vector PDFs while you watch. You chat on the left, and the PDF preview on the right updates live. The UI is built with Microsoft's **Fluent 2** design system (Fluent UI React v9).

## Features

- **Chat to create and edit.** Ask for a report, proposal, résumé, invoice, letter, meeting notes, study guide, project plan or anything else, then keep refining it in the same conversation.
- **Real PDF compiler.** It is built on `@react-pdf/renderer` and outputs vector text, embedded fonts (Inter, Merriweather, JetBrains Mono), a cover page, a table of contents with real page numbers and clickable links, headers and footers, page numbers, numbered headings, and A4/Letter/Legal/A5 page sizes in portrait or landscape.
- **Diagrams drawn with real lines.** A custom layout engine draws:
  - **Flowcharts:** layered auto-layout, orthogonal rounded connectors, arrowheads, edge labels, back-edge routing, and 9 node shapes (decision diamonds, databases, I/O, notes…).
  - **Mind maps**, **sequence diagrams** and **cycle diagrams**.
- **Charts:** bar, horizontal bar, line, area, stacked, pie and donut, all drawn as vector SVG.
- **18 block types:** headings, paragraphs (with inline **bold**, *italic*, `code`, ==highlight== and links), lists and checklists, tables (with total rows and captions), images, KPI cards, columns, timelines, callouts, quotes, syntax-highlighted code, progress bars, signatures, dividers and page breaks.
- **Images:** attach, paste or drag images into the chat to place them in the document.
- **7 document themes:** Ocean, Emerald, Sunset, Royal, Graphite, Rose and Midnight.
- **Preview:** rendered with pdf.js into crisp canvases (no flicker), with zoom, fit-width and fit-page modes, page tracking and open-in-tab.
- **Outline editor:** reorder, duplicate, delete and edit blocks, or add new ones by hand.
- **Source view:** edit the JSON document spec directly.
- Undo/redo history, a template gallery, dark mode, a resizable split view, and autosave to localStorage.

## AI engines

| Engine | Setup |
| --- | --- |
| **Built-in (offline)** | Default, no key needed. It understands document types and edit commands such as `add a pie chart`, `add flowchart: Idea -> Build -> Works? -> [Yes] Launch`, `switch to the royal theme`, `landscape`, `add a cover page`, `remove the last table` and `title: My Report`. |
| OpenAI / Anthropic / Gemini / OpenRouter | Add your API key in **Settings**. Replies stream directly from your browser. |
| Custom | Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM…). |

The LLM gets a strict schema in its system prompt and returns the complete document spec as JSON. The app checks and repairs that JSON before compiling, so small model mistakes don't break the PDF.

API keys are stored only in your browser's localStorage. Requests go straight from the browser to the provider.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (compiles on the main thread)
npm run start      # production build + preview on :4173 (PDF compiles in a Web Worker)
npm run samples    # render every template to ./samples/*.pdf with Node
npm run typecheck
```

## Architecture

```
src/
  types.ts              document model (DocSpec / blocks)
  normalize.ts          checks and repairs AI JSON (aliases, missing ids, bad values)
  ai/
    prompt.ts           system prompt and schema
    providers.ts        streaming clients for OpenAI, Anthropic, Gemini, OpenRouter and custom endpoints
    engine.ts           orchestration and document diffing
    local.ts            offline intent engine
    templates.ts        rich document builders
  pdf/
    PdfDocument.tsx     react-pdf document (cover, TOC, blocks, page chrome)
    diagramLayout.ts    flowchart / mind map / sequence / cycle layout engines
    chartLayout.ts      chart layout
    scene.ts, SceneView.tsx  vector scene → PDF SVG plus text labels
    compile.tsx         two-pass compile (TOC page numbers)
    pdf.worker.ts, client.ts  off-main-thread compilation
  preview/PdfPreview.tsx  pdf.js renderer
  chat/                 chat panel and markdown
  components/           outline, JSON editor, settings, page setup, theme and template menus
```
