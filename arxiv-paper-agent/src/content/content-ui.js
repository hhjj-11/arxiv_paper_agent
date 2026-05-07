(function () {
  const root = window;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (typeof text === "string") {
      element.textContent = text;
    }
    return element;
  }

  function ensureShell() {
    let shell = document.getElementById("arxiv-agent-shell");
    if (shell) {
      return shell;
    }

    shell = createElement("div");
    shell.id = "arxiv-agent-shell";

    const toolbar = createElement("div", "arxiv-agent-toolbar");
    toolbar.id = "arxiv-agent-toolbar";

    const dock = createElement("div", "arxiv-agent-dock");
    dock.id = "arxiv-agent-dock";

    const panel = createElement("aside", "arxiv-agent-panel");
    panel.id = "arxiv-agent-panel";
    panel.innerHTML = `
      <div class="arxiv-agent-panel-header">
        <div>
          <div class="arxiv-agent-kicker">ArXiv Paper Agent</div>
          <h2 id="arxiv-agent-panel-title">等待操作</h2>
        </div>
        <button id="arxiv-agent-close" type="button" aria-label="关闭">×</button>
      </div>
      <div id="arxiv-agent-panel-body" class="arxiv-agent-panel-body">
        <p class="arxiv-agent-empty">选中单词、句子或段落后，点击浮动工具栏中的能力按钮。</p>
      </div>
    `;

    shell.appendChild(toolbar);
    shell.appendChild(dock);
    shell.appendChild(panel);
    document.documentElement.appendChild(shell);

    panel.querySelector("#arxiv-agent-close").addEventListener("click", () => {
      panel.classList.remove("is-visible");
    });

    return shell;
  }

  function setToolbarPosition(toolbar, rect) {
    const viewportWidth = window.innerWidth;
    const estimatedWidth = Math.min(620, viewportWidth - 24);
    const rectTop = rect?.top ?? 80;
    const rectLeft = rect?.left ?? 12;
    const top = Math.max(12, rectTop - 52);
    const left = Math.min(
      viewportWidth - estimatedWidth - 16,
      Math.max(12, rectLeft)
    );

    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.maxWidth = `${estimatedWidth}px`;
  }

  function renderToolbar(agents, onClick, rect) {
    ensureShell();
    const toolbar = document.getElementById("arxiv-agent-toolbar");
    toolbar.innerHTML = "";

    if (!Array.isArray(agents) || !agents.length) {
      toolbar.classList.remove("is-visible");
      return;
    }

    agents.forEach((agent) => {
      const button = createElement("button", "arxiv-agent-toolbar-btn", agent.label);
      button.type = "button";
      button.title = agent.description || agent.label;
      button.dataset.agentId = agent.id;
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => onClick(agent));
      toolbar.appendChild(button);
    });

    setToolbarPosition(toolbar, rect);
    toolbar.classList.add("is-visible");
  }

  function hideToolbar() {
    const toolbar = document.getElementById("arxiv-agent-toolbar");
    if (toolbar) {
      toolbar.classList.remove("is-visible");
    }
  }

  function renderDock(agents, onClick) {
    ensureShell();
    const dock = document.getElementById("arxiv-agent-dock");
    dock.innerHTML = "";

    if (!Array.isArray(agents) || !agents.length) {
      dock.classList.remove("is-visible");
      return;
    }

    const label = createElement("div", "arxiv-agent-dock-label", "Paper Agents");
    dock.appendChild(label);

    agents.forEach((agent) => {
      const button = createElement("button", "arxiv-agent-dock-btn", agent.label);
      button.type = "button";
      button.title = agent.description || agent.label;
      button.addEventListener("click", () => onClick(agent));
      dock.appendChild(button);
    });

    dock.classList.add("is-visible");
  }

  function renderExpandableItems(container, items) {
    if (!Array.isArray(items) || !items.length) {
      return;
    }

    const wrap = createElement("div", "arxiv-agent-expand-list");
    items.forEach((item) => {
      const details = createElement("details", "arxiv-agent-expand-item");
      const summary = createElement("summary", "arxiv-agent-expand-summary");
      const title = createElement("span", "arxiv-agent-expand-title", item.title || "未命名条目");
      const brief = createElement("span", "arxiv-agent-expand-brief", item.summary || "");
      summary.appendChild(title);
      if (item.summary) {
        summary.appendChild(brief);
      }

      const body = createElement("div", "arxiv-agent-expand-body");
      if (item.meta) {
        const meta = createElement("div", "arxiv-agent-expand-meta", `关键词：${item.meta}`);
        body.appendChild(meta);
      }
      const text = createElement("div", "", item.body || "无");
      body.appendChild(text);

      details.appendChild(summary);
      details.appendChild(body);
      wrap.appendChild(details);
    });
    container.appendChild(wrap);
  }

  function renderSection(container, section) {
    const block = createElement("section", "arxiv-agent-section");
    const heading = createElement("h3", "arxiv-agent-section-title", section.heading || "结果");
    const body = createElement("div", "arxiv-agent-section-body");
    body.textContent = section.body || "无";
    block.appendChild(heading);
    block.appendChild(body);
    renderExpandableItems(block, section.items);
    container.appendChild(block);
  }

  function renderMeta(container, meta) {
    if (!Array.isArray(meta) || !meta.length) {
      return;
    }
    const wrap = createElement("div", "arxiv-agent-meta");
    meta.forEach((item) => {
      const row = createElement("div", "arxiv-agent-meta-row");
      const label = createElement("span", "arxiv-agent-meta-label", item.label || "");
      const value = createElement("span", "arxiv-agent-meta-value", item.value || "");
      row.appendChild(label);
      row.appendChild(value);
      wrap.appendChild(row);
    });
    container.appendChild(wrap);
  }

  function renderActions(container, actions) {
    if (!Array.isArray(actions) || !actions.length) {
      return;
    }
    const wrap = createElement("div", "arxiv-agent-actions");
    actions.forEach((item, index) => {
      const fallbackLabel = item.url?.includes("youtube.com/results")
        ? `YouTube 搜索 ${index + 1}`
        : `打开链接 ${index + 1}`;
      const link = createElement("a", "arxiv-agent-action");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.title = item.label || item.description || item.url;

      const label = createElement(
        "span",
        "arxiv-agent-action-label",
        item.displayLabel || fallbackLabel
      );
      link.appendChild(label);

      if (item.label && item.label !== label.textContent) {
        const detail = createElement("span", "arxiv-agent-action-detail", item.label);
        link.appendChild(detail);
      }
      wrap.appendChild(link);
    });
    container.appendChild(wrap);
  }

  function showPanel() {
    ensureShell();
    document.getElementById("arxiv-agent-panel").classList.add("is-visible");
  }

  function setPanelLoading(title) {
    ensureShell();
    document.getElementById("arxiv-agent-panel-title").textContent = title || "处理中";
    document.getElementById("arxiv-agent-panel-body").innerHTML =
      '<div class="arxiv-agent-loading">正在调用 Agent，请稍候...</div>';
    showPanel();
  }

  function renderResult(result) {
    ensureShell();
    document.getElementById("arxiv-agent-panel-title").textContent =
      result.title || "Agent 输出";
    const body = document.getElementById("arxiv-agent-panel-body");
    body.innerHTML = "";

    if (result.summary) {
      const summary = createElement("div", "arxiv-agent-summary", result.summary);
      body.appendChild(summary);
    }

    renderMeta(body, result.meta);
    (result.sections || []).forEach((section) => renderSection(body, section));
    renderActions(body, result.actions);
    showPanel();
  }

  function renderError(message) {
    renderResult({
      title: "操作失败",
      summary: message || "未知错误。"
    });
  }

  root.ArxivAgentUI = {
    ensureShell,
    renderToolbar,
    renderDock,
    hideToolbar,
    setPanelLoading,
    renderResult,
    renderError
  };
})();
