# Fluent PDF Studio

An AI chatbot that designs and compiles real, vector PDFs while you watch. You chat on the left, and the PDF preview on the right updates live. The UI is built with Microsoft's **Fluent 2** design system (Fluent UI React v9).

## Features

- **Science-grade typesetting.** Display equations are typeset with a TeX engine (MathJax, converted to vector paths) and numbered automatically. Inline `$…$` maths works in any text. There are **function plots** (functions, parametric curves, data, shading and markers), **physics figures** built from primitives (vectors, springs, blocks, inclines, pulleys, charges, field lines, circuit parts, lenses and rays, angles, dimensions), **definition, law, example and solution boxes**, and **step-by-step derivations**. Documents use either an academic or a modern style.
- **The AI is in control.** A connected LLM picks the whole design (style, theme, fonts, cover, kicker) and edits documents with precise operations (replace, insert, delete or move blocks; change meta) instead of rewriting everything. The app repairs common model mistakes such as single-backslash TeX, truncated JSON and invalid escapes before anything is compiled.
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
- **Natural, eye-friendly design.** Every colour on the page is graded so it feels like print: white becomes a soft warm paper tone, cold greys become warm greys, black becomes soft ink, and loud hues are calmed. Six natural themes are included (Ink, Sage, Clay, Stone, Lake and Plum). Each document can set:
  - `paper`: natural, cream or white;
  - `colors`: natural, mono or vivid;
  - `density`: compact, comfortable or airy, which changes margins, type size, line height and spacing.
- **Book-like typography.** Serif documents are set in Literata, a warm reading face with a generous x-height. Lines are kept to a comfortable book measure. Consecutive paragraphs sit close together and later ones get a first-line indent. Headings are semibold, figure strokes are fine, and plot legends sit above the frame so they never cover a curve.
- **Margin figures.** A figure with `side: "left" | "right"` sits beside the next 1 to 3 text blocks, like a textbook margin figure. Electromagnetism drawings include `magnet` (bar magnets and pole pieces with traced field lines), `solenoid` (a 3-D coil) and single `into` / `outof` symbols.
- **Any level of design.** `minimal` is a quiet layout with almost no decoration, `academic` gives a LaTeX look, and `modern` uses cards, KPI tiles and accents. The AI picks the level that fits the request, and you can change it in plain words (*make it minimal with airy spacing*, *cream paper*, *black and white*).
- **Calm UI.** Warm neutral surfaces, one quiet ink accent, outline icons, chat on the left and the live PDF on the right, plus undo/redo, a new-document button, warm dark mode and autosave.

## AI engines

| Engine | Setup |
| --- | --- |
| **Gemini (free key, recommended)** / **Groq (free key)** | Paste a key in **Settings** (via the engine chip in the chat header). The AI can then write about any topic with its own equations, plots and diagrams. |
| **Built-in (offline)** | Default, no key needed. It produces physics notes on projectiles, forces, oscillations, circuits and optics, plus business templates. It also understands document types and edit commands such as `add a pie chart`, `add flowchart: Idea -> Build -> Works? -> [Yes] Launch`, `switch to the royal theme`, `landscape`, `add a cover page`, `remove the last table` and `title: My Report`. |
| OpenAI / Anthropic / OpenRouter | Add your API key in **Settings**. Replies stream directly from your browser. |
| Custom | Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM…). |

The LLM gets a strict schema in its system prompt. It returns a complete document spec for new documents and a list of edit operations for changes. The app checks and repairs that JSON before compiling, so small model mistakes don't break the PDF.

API keys are stored only in your browser's localStorage. Requests go straight from the browser to the provider.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (compiles on the main thread)
npm run start      # production build + preview on :4173 (PDF compiles in a Web Worker)
npm run samples    # render every template and science sample to ./samples/*.pdf with Node
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
    science.ts          offline physics notes (projectile, forces, SHM, circuits, optics)
  pdf/
    PdfDocument.tsx     react-pdf document (cover, TOC, blocks, page chrome)
    diagramLayout.ts    flowchart / mind map / sequence / cycle layout engines
    chartLayout.ts      chart layout
    mathjax.ts, MathSvg.tsx, texInline.ts  TeX → vector equations / inline maths runs
    plotLayout.ts, figureLayout.ts  function plots and physics figures
    scene.ts, SceneView.tsx  vector scene → PDF SVG plus text labels
    compile.tsx         two-pass compile (TOC page numbers)
    pdf.worker.ts, client.ts  off-main-thread compilation
  preview/PdfPreview.tsx  pdf.js renderer
  chat/                 chat panel and markdown
  components/           settings dialog
```
