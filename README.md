# arXiv Paper Agent

A Chromium extension for contextual arXiv paper reading. It provides selection tools for translation and explanation, paper-level tools for outlines and reproduction planning, a configurable model endpoint, and a selectable PDF reader.

**Project type:** engineering prototype. This repository does not claim a new model, a paper reproduction, or measured research gains.

## Try it

1. In Chrome or Edge, enable Developer mode on the extensions page.
2. Load the unpacked [`arxiv-paper-agent/`](arxiv-paper-agent/) folder containing `manifest.json`.
3. Configure your own OpenAI-compatible endpoint, model, and API key in the options page.
4. Open an arXiv page and use the selection toolbar or paper-level controls. For PDFs, open the extension's reader from its popup.

See the [full feature guide](arxiv-paper-agent/README.md) and [development notes](arxiv-paper-agent/docs/DEVELOPMENT_PROCESS.md).

## Architecture and evidence

The content script handles in-page UI; the background service worker dispatches tools and API calls; the options page stores settings; bundled PDF.js renders a selectable text layer.

On 2026-09-24, all 10 project JavaScript files passed syntax checks and `manifest.json` parsed successfully. This is **not** an end-to-end browser test or model-quality evaluation. No benchmark or ablation is claimed. Generated outputs require checking against the source paper.

The manifest permits HTTP(S) calls to configurable model providers. A tool call can send selected text and paper context to the provider you choose. API settings are kept in `chrome.storage.sync`; use a limited key. The extension is not affiliated with arXiv.

Bundled PDF.js 4.10.38 is from [Mozilla PDF.js](https://github.com/mozilla/pdf.js), under Apache 2.0; its license headers remain in the bundled files.
