import * as pdfjsLib from "./vendor/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "src/pdf-viewer/vendor/pdf.worker.mjs"
);

const constants = window.ARXIV_AGENT_CONSTANTS;
const ui = window.ArxivAgentUI;

const pagesRoot = document.getElementById("pdf-pages");
const statusNode = document.getElementById("pdf-status");
const titleNode = document.getElementById("pdf-title");
const openOriginal = document.getElementById("open-original");
const zoomIn = document.getElementById("zoom-in");
const zoomOut = document.getElementById("zoom-out");
const zoomLabel = document.getElementById("zoom-label");

const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get("pdf") || "";
const arxivId = params.get("id") || getArxivId(pdfUrl);

let pdfDocument = null;
let pageTexts = [];
let pageContext = {
  title: arxivId ? `arXiv:${arxivId}` : "PDF 论文",
  abstract: "",
  authors: "",
  url: pdfUrl,
  pageType: "pdf-viewer",
  arxivId,
  sectionHeadings: [],
  bodyText: ""
};
let scale = Number(params.get("scale") || 1.25);
let selectionState = null;
let selectionTimer = null;
let lastPointer = { x: 24, y: 96 };
let agentCatalog = constants.builtInAgents || [];

const apiStatusAgent = {
  id: "api_status",
  label: "状态",
  scope: "utility",
  description: "查看最近一次 API 调用状态"
};

function setStatus(message, hidden = false) {
  statusNode.textContent = message;
  statusNode.hidden = hidden;
}

function getArxivId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/pdf\/([^/?#]+)/);
    return match ? match[1].replace(/\.pdf$/i, "") : "";
  } catch (_) {
    return "";
  }
}

function clampText(text, limit) {
  const trimmed = (text || "").replace(/\s+/g, " ").trim();
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

async function fetchAbstractContext() {
  if (!arxivId) {
    return;
  }

  try {
    const response = await fetch(`${constants.arxivOrigin}/abs/${arxivId}`);
    if (!response.ok) {
      return;
    }
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const readFrom = (selectors, fallback = "") => {
      for (const selector of selectors) {
        const node = doc.querySelector(selector);
        const text = node?.textContent?.replace(/\s+/g, " ").trim();
        if (text) {
          return text;
        }
      }
      return fallback;
    };

    pageContext = {
      ...pageContext,
      title: readFrom(["h1.title", ".title"], pageContext.title),
      abstract: readFrom(["blockquote.abstract", ".abstract"]),
      authors: readFrom([".authors"]),
      url: `${constants.arxivOrigin}/pdf/${arxivId}`
    };
    titleNode.textContent = pageContext.title;
  } catch (_) {
    // PDF text remains usable even when abstract metadata is unavailable.
  }
}

function renderTextLayer(textContent, viewport, container) {
  const textLayer = document.createElement("div");
  textLayer.className = "pdf-text-layer";
  container.appendChild(textLayer);

  for (const item of textContent.items) {
    if (!item.str) {
      continue;
    }

    const span = document.createElement("span");
    span.textContent = item.str;
    span.dataset.pdfText = "true";
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const angle = Math.atan2(tx[1], tx[0]);
    const itemWidth = item.width * viewport.scale;
    const textWidth = Math.max(item.str.length * fontHeight * 0.5, 1);
    const scaleX = itemWidth > 0 ? itemWidth / textWidth : 1;

    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.fontFamily = "sans-serif";
    span.style.transform = `rotate(${angle}rad) scaleX(${scaleX})`;
    textLayer.appendChild(span);
  }
}

async function renderPage(pageNumber) {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const pageWrap = document.createElement("article");
  pageWrap.className = "pdf-page";
  pageWrap.dataset.pageNumber = String(pageNumber);
  pageWrap.style.width = `${viewport.width}px`;
  pageWrap.style.height = `${viewport.height}px`;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  pageWrap.appendChild(canvas);
  pagesRoot.appendChild(pageWrap);

  await page.render({
    canvasContext: context,
    viewport,
    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
  }).promise;

  const textContent = await page.getTextContent();
  pageTexts[pageNumber - 1] = textContent.items.map((item) => item.str).join(" ");
  renderTextLayer(textContent, viewport, pageWrap);
}

async function renderDocument() {
  pagesRoot.innerHTML = "";
  pageTexts = [];
  zoomLabel.textContent = `${Math.round(scale * 80)}%`;

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    setStatus(`正在渲染 PDF：${pageNumber} / ${pdfDocument.numPages}`);
    await renderPage(pageNumber);
  }

  pageContext.bodyText = clampText(pageTexts.join("\n\n"), constants.maxContextChars);
  setStatus("PDF 已加载。现在可以在本文本层中划词、划句并调用 Agent。", false);
}

function getSelectionPayload() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = clampText(selection.toString(), constants.maxSelectionChars);
  if (!text) {
    return null;
  }

  const range = selection.getRangeAt(0);
  let rect =
    Array.from(range.getClientRects()).find((item) => item.width || item.height) ||
    range.getBoundingClientRect();

  if (!rect || (!rect.width && !rect.height)) {
    rect = {
      top: lastPointer.y,
      left: lastPointer.x,
      width: 1,
      height: 1
    };
  }

  const pageNode = range.commonAncestorContainer.parentElement?.closest?.(".pdf-page");
  const pageNumber = Number(pageNode?.dataset.pageNumber || 0);
  const paragraph = pageNumber ? pageTexts[pageNumber - 1] || pageContext.bodyText : pageContext.bodyText;

  return {
    text,
    rect,
    sentence: text,
    paragraph: clampText(paragraph, 1600)
  };
}

function getVisibleAgents(selectionText) {
  const normalized = (selectionText || "").trim();
  const isSingleWord = normalized && !/\s/.test(normalized);
  const isShortSelection = normalized.length <= 280;
  const agents = agentCatalog.filter((agent) => {
    if (agent.scope !== "selection") {
      return false;
    }
    if (agent.id === "word_translate") {
      return isSingleWord;
    }
    if (agent.id === "sentence_explain") {
      return !isSingleWord && isShortSelection;
    }
    return true;
  });
  return [...agents, apiStatusAgent];
}

function renderDockAgents() {
  ui.renderDock(
    [
      ...agentCatalog.filter((agent) => agent.scope === "paper"),
      apiStatusAgent
    ],
    runAgent
  );
}

function formatApiStatus(lastApiCall) {
  if (!lastApiCall) {
    return {
      title: "API 调用状态",
      summary: "暂无调用记录。",
      sections: [
        {
          heading: "如何产生记录",
          body: "点击词译、句译、句解、术语、大纲、溯源或复现后，如果真正请求了模型，这里会显示 started / completed / failed。"
        }
      ]
    };
  }

  const resultText =
    lastApiCall.ok === true ? "成功" : lastApiCall.ok === false ? "失败" : "请求中";
  const usage = lastApiCall.usage
    ? [
        `prompt_tokens: ${lastApiCall.usage.prompt_tokens ?? "-"}`,
        `completion_tokens: ${lastApiCall.usage.completion_tokens ?? "-"}`,
        `total_tokens: ${lastApiCall.usage.total_tokens ?? "-"}`
      ].join("\n")
    : "接口未返回 usage。";

  return {
    title: "API 调用状态",
    summary: `${resultText} · ${lastApiCall.phase || "unknown"}`,
    meta: [
      { label: "时间", value: new Date(lastApiCall.at).toLocaleString() },
      { label: "模型", value: lastApiCall.model || "-" },
      { label: "HTTP", value: lastApiCall.status ? String(lastApiCall.status) : "-" }
    ],
    sections: [
      { heading: "请求地址", body: lastApiCall.endpoint || "-" },
      { heading: "Token 用量", body: usage },
      { heading: "错误信息", body: lastApiCall.error || "无" }
    ]
  };
}

function renderApiStatus() {
  ui.setPanelLoading("API 调用状态");
  chrome.runtime.sendMessage({ type: "GET_API_STATUS" }, (response) => {
    if (chrome.runtime.lastError) {
      ui.renderError(chrome.runtime.lastError.message);
      return;
    }
    ui.renderResult(formatApiStatus(response?.lastApiCall));
  });
}

async function runAgent(agent) {
  if (agent.id === "api_status") {
    renderApiStatus();
    return;
  }

  const selection = selectionState || {
    text: "",
    sentence: "",
    paragraph: ""
  };

  ui.setPanelLoading(agent.description || agent.label);
  chrome.runtime.sendMessage(
    {
      type: "RUN_AGENT",
      agentId: agent.id,
      selection,
      pageContext
    },
    (response) => {
      if (chrome.runtime.lastError) {
        ui.renderError(chrome.runtime.lastError.message);
        return;
      }
      if (!response?.ok) {
        ui.renderError(response?.error || "Agent 执行失败。");
        return;
      }
      ui.renderResult(response.result);
    }
  );
}

function handleSelection() {
  const payload = getSelectionPayload();
  if (!payload) {
    ui.hideToolbar();
    return;
  }

  selectionState = payload;
  ui.renderToolbar(getVisibleAgents(payload.text), runAgent, payload.rect);
}

function scheduleSelectionCheck() {
  window.clearTimeout(selectionTimer);
  selectionTimer = window.setTimeout(handleSelection, constants.selectionThrottleMs);
}

function rememberPointer(event) {
  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    lastPointer = {
      x: event.clientX,
      y: event.clientY
    };
  }
  scheduleSelectionCheck();
}

function loadAgentCatalog() {
  chrome.runtime.sendMessage({ type: "GET_AGENT_CATALOG" }, (response) => {
    if (!chrome.runtime.lastError && response?.ok) {
      agentCatalog = response.catalog;
    }
    renderDockAgents();
  });
}

async function boot() {
  if (!pdfUrl) {
    setStatus("缺少 PDF 地址。请从 arXiv PDF 页面点击“用 Agent 阅读 PDF”进入。");
    return;
  }

  ui.ensureShell();
  renderDockAgents();
  loadAgentCatalog();

  openOriginal.href = pdfUrl;
  titleNode.textContent = pageContext.title;
  await fetchAbstractContext();

  document.addEventListener("mouseup", rememberPointer, true);
  document.addEventListener("pointerup", rememberPointer, true);
  document.addEventListener("dblclick", rememberPointer, true);
  document.addEventListener("keyup", scheduleSelectionCheck, true);
  document.addEventListener("selectionchange", scheduleSelectionCheck, true);
  document.addEventListener("mousedown", (event) => {
    const shell = document.getElementById("arxiv-agent-shell");
    if (shell && shell.contains(event.target)) {
      return;
    }
    if (!window.getSelection()?.toString()) {
      ui.hideToolbar();
    }
  });

  zoomIn.addEventListener("click", async () => {
    scale = Math.min(2.4, scale + 0.15);
    await renderDocument();
  });

  zoomOut.addEventListener("click", async () => {
    scale = Math.max(0.7, scale - 0.15);
    await renderDocument();
  });

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      withCredentials: false
    });
    pdfDocument = await loadingTask.promise;
    await renderDocument();
  } catch (error) {
    setStatus(`PDF 加载失败：${error.message}`);
  }
}

boot();
