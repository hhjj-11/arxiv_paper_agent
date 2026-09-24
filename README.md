# arXiv Paper Agent

A Chromium browser extension for reading arXiv papers in context. It puts focused tools next to selected text and offers paper-level actions for outlining, citation exploration, and reproduction planning.

**Project type:** original engineering prototype. This repository does not claim a new model, a paper reproduction, or measured research gains.

**My contribution:** I independently built the extension and its paper-reading workflows. The bundled PDF.js library is upstream software, credited below.

## What it does

- Selection tools: word translation, sentence translation and explanation, terminology, and learning-resource lookup.
- Paper tools: structured outline, citation trail, and a code-reproduction plan.
- Custom tools: configure additional selection or paper-level prompts in the options page.
- PDF reading: an extension-owned viewer uses a selectable PDF text layer when the browser's built-in PDF viewer cannot expose selections to the extension.
- API status: shows the most recent model request state to help diagnose setup problems.

The extension uses a user-supplied OpenAI-compatible Chat Completions endpoint. The optional YouTube Data API key enables specific video results; without it, the resource tool links to a search page. **These are reading aids, not verified research conclusions.** Check cited papers and generated plans against the original sources.

## Try it locally

1. Open Chrome or Edge's extensions page and enable developer mode.
2. Choose **Load unpacked** and select [`arxiv-paper-agent/`](arxiv-paper-agent/), the folder containing `manifest.json`.
3. Open the extension's options page and enter your endpoint, model, and API key.
4. Open an arXiv abstract or HTML page, select text, and use the floating toolbar. For a PDF, open the extension popup on an arXiv PDF URL and choose its PDF reader.

See the [full feature and configuration guide](arxiv-paper-agent/README.md) and [development notes](arxiv-paper-agent/docs/DEVELOPMENT_PROCESS.md).

## Architecture

| Part | Responsibility |
|---|---|
| Content script | Detect selections and render the in-page controls on arXiv pages |
| Background service worker | Select a tool, call the configured model or resource API, and record request status |
| Options page | Manage provider settings and custom tools |
| PDF reader | Render a selectable text layer with bundled PDF.js |

The repository keeps the extension in a nested folder. Load that folder rather than the repository root.

## Verification and limits

The current source passed `node scripts/verify.mjs` on 2026-09-24: it validates manifest file references and checks syntax for all 10 project `.js` files. The same check runs in GitHub Actions. This is **not** an end-to-end browser or model-quality test. There is no benchmark or ablation result in this repository. Responses depend on the selected provider and prompt; the README should not be read as an accuracy claim.

The manifest permits requests to arbitrary HTTP(S) endpoints so that users can configure different model providers. An action can send selected text and paper context to the configured provider. API settings are stored in the browser profile via `chrome.storage.sync`; use a dedicated key with appropriate limits and do not share a browser profile containing credentials. The extension is not affiliated with arXiv.

Bundled PDF.js 4.10.38 is from [Mozilla PDF.js](https://github.com/mozilla/pdf.js) and retains its Apache 2.0 license header in the distributed files. See [third-party notices](THIRD_PARTY_NOTICES.md).
