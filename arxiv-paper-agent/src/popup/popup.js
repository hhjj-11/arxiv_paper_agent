(function () {
  const status = document.getElementById("page-status");
  const apiStatusBody = document.getElementById("api-status-body");
  const optionsButton = document.getElementById("open-options");
  const pdfActions = document.getElementById("pdf-actions");
  const openAgentPdfButton = document.getElementById("open-agent-pdf");
  const openAbsButton = document.getElementById("open-abs");
  const arxivOrigin = "https://arxiv.org";

  let activeTabId = null;
  let currentArxivId = "";
  let currentPdfUrl = "";

  function getArxivId(url) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^\/(?:abs|html|pdf)\/([^/?#]+)/);
      return match ? match[1].replace(/\.pdf$/i, "") : "";
    } catch (_) {
      return "";
    }
  }

  function isArxivPdf(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin === arxivOrigin && parsed.pathname.startsWith("/pdf/");
    } catch (_) {
      return false;
    }
  }

  function navigateToAbs() {
    if (!activeTabId || !currentArxivId) {
      return;
    }
    chrome.tabs.update(activeTabId, {
      url: `${arxivOrigin}/abs/${currentArxivId}`
    });
  }

  function openAgentPdfReader() {
    if (!activeTabId || !currentPdfUrl) {
      return;
    }

    const viewerUrl = chrome.runtime.getURL(
      `src/pdf-viewer/viewer.html?pdf=${encodeURIComponent(currentPdfUrl)}&id=${encodeURIComponent(currentArxivId)}`
    );
    chrome.tabs.update(activeTabId, { url: viewerUrl });
  }

  function renderApiStatus(lastApiCall) {
    if (!lastApiCall) {
      apiStatusBody.textContent =
        "暂无记录。触发一次词译、句解、大纲等模型能力后，这里会显示请求结果。";
      return;
    }

    const usage = lastApiCall.usage
      ? `\nTokens: prompt ${lastApiCall.usage.prompt_tokens ?? "-"} / completion ${lastApiCall.usage.completion_tokens ?? "-"} / total ${lastApiCall.usage.total_tokens ?? "-"}`
      : "";
    const statusText = lastApiCall.status ? `\nHTTP: ${lastApiCall.status}` : "";
    const errorText = lastApiCall.error ? `\n错误: ${lastApiCall.error}` : "";
    apiStatusBody.textContent = [
      `时间: ${new Date(lastApiCall.at).toLocaleString()}`,
      `阶段: ${lastApiCall.phase}`,
      `结果: ${lastApiCall.ok === true ? "成功" : lastApiCall.ok === false ? "失败" : "请求中"}`,
      `模型: ${lastApiCall.model || "-"}`,
      `地址: ${lastApiCall.endpoint || "-"}${statusText}${usage}${errorText}`
    ].join("\n");
  }

  chrome.runtime.sendMessage({ type: "GET_API_STATUS" }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      apiStatusBody.textContent = "读取失败。请重新加载扩展后再试。";
      return;
    }
    renderApiStatus(response.lastApiCall);
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs?.[0];
    const url = tab?.url || "";
    activeTabId = tab?.id || null;
    currentArxivId = getArxivId(url);
    currentPdfUrl = url;

    if (isArxivPdf(url)) {
      status.textContent =
        "当前是 arXiv PDF。浏览器内置 PDF 阅读器不支持扩展稳定读取划词选区。点击“用 Agent 阅读 PDF”会打开扩展内置 pdf.js 阅读页，支持 PDF 划词。";
      pdfActions.hidden = false;
      return;
    }

    if (url === arxivOrigin || url.startsWith(`${arxivOrigin}/`)) {
      status.textContent =
        "当前标签页是 ArXiv 页面。选中文本后会出现浮动工具栏，可直接触发对应 Agent。";
    } else if (url.startsWith(chrome.runtime.getURL("src/pdf-viewer/viewer.html"))) {
      status.textContent =
        "当前是 Agent PDF 阅读页。可直接在 PDF 文本层划词、划句并调用 Agent。";
    } else {
      status.textContent =
        "当前标签页不是 ArXiv。请打开 https://arxiv.org/ 论文页面后使用。";
    }
  });

  openAgentPdfButton.addEventListener("click", openAgentPdfReader);
  openAbsButton.addEventListener("click", navigateToAbs);
  optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
})();
