(function () {
  const constants = window.ARXIV_AGENT_CONSTANTS;
  const ui = window.ArxivAgentUI;

  let selectionState = null;
  let agentCatalog = constants.builtInAgents || [];
  let selectionTimer = null;
  let lastPointer = { x: 24, y: 96 };
  const apiStatusAgent = {
    id: "api_status",
    label: "状态",
    scope: "utility",
    description: "查看最近一次 API 调用状态"
  };

  function clampText(text, limit) {
    const trimmed = (text || "").trim();
    return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
  }

  function getTextFromNode(node) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    return node.innerText || node.textContent || "";
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

    const paragraphSource =
      range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer?.parentElement;
    const paragraphText = clampText(getTextFromNode(paragraphSource), 1200);

    return {
      text,
      rect,
      sentence: clampText(text, 1200),
      paragraph: paragraphText
    };
  }

  function extractSectionHeadings() {
    return Array.from(document.querySelectorAll("h2, h3"))
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  function findText(selectors, fallback = "") {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }
      if (typeof node.getAttribute === "function") {
        const contentAttr = node.getAttribute("content");
        if (contentAttr && contentAttr.trim()) {
          return contentAttr.replace(/\s+/g, " ").trim();
        }
      }
      if (node?.textContent?.trim()) {
        return node.textContent.replace(/\s+/g, " ").trim();
      }
    }
    return fallback;
  }

  function detectPageType() {
    const path = window.location.pathname;
    if (path.startsWith("/abs/")) {
      return "abstract";
    }
    if (path.startsWith("/html/")) {
      return "html";
    }
    if (path.startsWith("/pdf/") || path.endsWith(".pdf")) {
      return "pdf";
    }
    return "unknown";
  }

  function getBodyText() {
    const root =
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector(".ltx_document") ||
      document.body;

    return clampText(root?.innerText || "", constants.maxContextChars);
  }

  function getArxivIdFromPath() {
    const match = window.location.pathname.match(/\/(?:abs|html|pdf)\/([^/?#]+)/);
    return match ? match[1].replace(/\.pdf$/i, "") : "";
  }

  async function fetchAbstractContext(arxivId) {
    if (!arxivId) {
      return {};
    }

    try {
      const response = await fetch(`${constants.arxivOrigin}/abs/${arxivId}`);
      if (!response.ok) {
        return {};
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
      return {
        title: readFrom(["h1.title", ".title"], `arXiv:${arxivId}`),
        abstract: readFrom(["blockquote.abstract", ".abstract"]),
        authors: readFrom([".authors"]),
        url: `${constants.arxivOrigin}/abs/${arxivId}`
      };
    } catch (_) {
      return {};
    }
  }

  async function getPageContext() {
    const pageType = detectPageType();
    const arxivId = getArxivIdFromPath();
    const baseContext = {
      title: findText(
        ["h1.title", ".title", 'meta[property="og:title"]'],
        document.title || (arxivId ? `arXiv:${arxivId}` : "")
      ),
      abstract: findText(
        ["blockquote.abstract", ".abstract", '[data-testid="abstract"]']
      ),
      authors: findText([".authors", ".ltx_authors"]),
      url: window.location.href,
      pageType,
      arxivId,
      sectionHeadings: extractSectionHeadings(),
      bodyText: getBodyText()
    };

    if (pageType !== "pdf" || baseContext.abstract || baseContext.bodyText.length > 200) {
      return baseContext;
    }

    return {
      ...baseContext,
      ...(await fetchAbstractContext(arxivId)),
      pageType
    };
  }

  async function loadAgentCatalog() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_AGENT_CATALOG" }, (response) => {
        if (chrome.runtime.lastError) {
          agentCatalog = constants.builtInAgents || [];
          renderDockAgents();
          resolve(agentCatalog);
          return;
        }
        agentCatalog = response?.ok ? response.catalog : constants.builtInAgents;
        renderDockAgents();
        resolve(agentCatalog);
      });
    });
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
      if (!response?.ok) {
        ui.renderError(response?.error || "读取 API 状态失败。");
        return;
      }
      ui.renderResult(formatApiStatus(response.lastApiCall));
    });
  }

  async function runAgent(agent) {
    if (agent.id === "api_status") {
      renderApiStatus();
      return;
    }

    const pageContext = await getPageContext();
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
    const visibleAgents = getVisibleAgents(payload.text);
    ui.renderToolbar(visibleAgents, runAgent, payload.rect);
  }

  function scheduleSelectionCheck() {
    window.clearTimeout(selectionTimer);
    selectionTimer = window.setTimeout(
      handleSelection,
      constants.selectionThrottleMs
    );
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

  function boot() {
    ui.ensureShell();
    renderDockAgents();
    loadAgentCatalog();

    document.addEventListener("mouseup", rememberPointer, true);
    document.addEventListener("pointerup", rememberPointer, true);
    document.addEventListener("dblclick", rememberPointer, true);
    document.addEventListener("keyup", scheduleSelectionCheck, true);
    document.addEventListener("selectionchange", scheduleSelectionCheck, true);
    document.addEventListener("scroll", () => ui.hideToolbar(), true);
    document.addEventListener("mousedown", (event) => {
      const shell = document.getElementById("arxiv-agent-shell");
      if (shell && shell.contains(event.target)) {
        return;
      }
      if (!window.getSelection()?.toString()) {
        ui.hideToolbar();
      }
    });
  }

  boot();
})();
