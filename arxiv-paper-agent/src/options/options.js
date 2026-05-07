(function () {
  const constants = window.ARXIV_AGENT_CONSTANTS;
  const defaultAgents = [];

  const elements = {
    endpoint: document.getElementById("api-endpoint"),
    apiKey: document.getElementById("api-key"),
    model: document.getElementById("model"),
    temperature: document.getElementById("temperature"),
    youtubeApiKey: document.getElementById("youtube-api-key"),
    customAgents: document.getElementById("custom-agents"),
    save: document.getElementById("save"),
    reset: document.getElementById("reset"),
    status: document.getElementById("status"),
    addAgent: document.getElementById("add-agent"),
    agentList: document.getElementById("agent-list"),
    applyAgent: document.getElementById("apply-agent"),
    deleteAgent: document.getElementById("delete-agent"),
    loadJson: document.getElementById("load-json"),
    agentId: document.getElementById("agent-id"),
    agentName: document.getElementById("agent-name"),
    agentLabel: document.getElementById("agent-label"),
    agentScope: document.getElementById("agent-scope"),
    agentDescription: document.getElementById("agent-description"),
    agentSystemPrompt: document.getElementById("agent-system-prompt"),
    agentPromptTemplate: document.getElementById("agent-prompt-template")
  };

  let customAgents = [];
  let selectedAgentIndex = -1;

  function normalizeChatCompletionsEndpoint(endpoint) {
    const trimmed = (endpoint || "").trim().replace(/\/+$/, "");
    if (!trimmed) {
      return "";
    }
    if (trimmed.endsWith("/chat/completions")) {
      return trimmed;
    }
    return `${trimmed}/chat/completions`;
  }

  function setStatus(message, type = "info", timeoutMs = 7000) {
    elements.status.dataset.type = type;
    elements.status.textContent = message;
    window.setTimeout(() => {
      if (elements.status.textContent === message) {
        elements.status.textContent = "";
        delete elements.status.dataset.type;
      }
    }, timeoutMs);
  }

  function makeEmptyAgent() {
    return {
      id: "",
      name: "",
      label: "",
      scope: "selection",
      description: "",
      systemPrompt: "",
      promptTemplate: ""
    };
  }

  function syncJsonFromAgents() {
    elements.customAgents.value = JSON.stringify(customAgents, null, 2);
  }

  function renderAgentList() {
    elements.agentList.innerHTML = "";

    if (!customAgents.length) {
      const empty = document.createElement("div");
      empty.className = "agent-empty";
      empty.textContent = "暂无自定义 Agent。点击“新增 Agent”开始。";
      elements.agentList.appendChild(empty);
      return;
    }

    customAgents.forEach((agent, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `agent-list-item${index === selectedAgentIndex ? " is-active" : ""}`;
      button.innerHTML = `
        <span>${agent.label || agent.name || agent.id || `Agent ${index + 1}`}</span>
        <small>${agent.scope === "paper" ? "右下角固定栏" : "划词浮层"}</small>
      `;
      button.addEventListener("click", () => selectAgent(index));
      elements.agentList.appendChild(button);
    });
  }

  function fillForm(agent) {
    const value = agent || makeEmptyAgent();
    elements.agentId.value = value.id || "";
    elements.agentName.value = value.name || "";
    elements.agentLabel.value = value.label || "";
    elements.agentScope.value = value.scope === "paper" ? "paper" : "selection";
    elements.agentDescription.value = value.description || "";
    elements.agentSystemPrompt.value = value.systemPrompt || "";
    elements.agentPromptTemplate.value = value.promptTemplate || "";
  }

  function readForm() {
    return {
      id: elements.agentId.value.trim(),
      name: elements.agentName.value.trim(),
      label: elements.agentLabel.value.trim(),
      scope: elements.agentScope.value === "paper" ? "paper" : "selection",
      description: elements.agentDescription.value.trim(),
      systemPrompt: elements.agentSystemPrompt.value.trim(),
      promptTemplate: elements.agentPromptTemplate.value.trim()
    };
  }

  function selectAgent(index) {
    selectedAgentIndex = index;
    fillForm(customAgents[index]);
    renderAgentList();
  }

  function validateAgent(agent, index) {
    if (!agent.id) {
      throw new Error("Agent ID 不能为空。");
    }
    if (!/^[a-zA-Z][\w-]*$/.test(agent.id)) {
      throw new Error("Agent ID 必须以字母开头，只能包含字母、数字、下划线或短横线。");
    }
    if (!agent.name) {
      throw new Error("Agent 名称不能为空。");
    }
    if (!agent.promptTemplate) {
      throw new Error("Prompt Template 不能为空。");
    }
    const duplicateIndex = customAgents.findIndex((item, itemIndex) => item.id === agent.id && itemIndex !== index);
    if (duplicateIndex !== -1) {
      throw new Error(`Agent ID 与第 ${duplicateIndex + 1} 个 Agent 重复。`);
    }
  }

  function applyCurrentAgent() {
    const agent = readForm();
    const targetIndex = selectedAgentIndex === -1 ? customAgents.length : selectedAgentIndex;
    validateAgent(agent, targetIndex);

    if (selectedAgentIndex === -1) {
      customAgents.push(agent);
      selectedAgentIndex = customAgents.length - 1;
    } else {
      customAgents[selectedAgentIndex] = agent;
    }

    syncJsonFromAgents();
    renderAgentList();
    setStatus("已应用到 Agent 列表，记得点击保存配置。", "success");
  }

  function addAgent() {
    selectedAgentIndex = -1;
    fillForm(makeEmptyAgent());
    renderAgentList();
    elements.agentId.focus();
  }

  function deleteCurrentAgent() {
    if (selectedAgentIndex < 0 || !customAgents[selectedAgentIndex]) {
      setStatus("当前没有选中的 Agent。", "error");
      return;
    }

    customAgents.splice(selectedAgentIndex, 1);
    selectedAgentIndex = customAgents.length ? Math.min(selectedAgentIndex, customAgents.length - 1) : -1;
    fillForm(selectedAgentIndex === -1 ? makeEmptyAgent() : customAgents[selectedAgentIndex]);
    syncJsonFromAgents();
    renderAgentList();
    setStatus("已删除 Agent，记得点击保存配置。", "success");
  }

  function loadAgentsFromJson() {
    const parsed = JSON.parse(elements.customAgents.value || "[]");
    if (!Array.isArray(parsed)) {
      throw new Error("自定义 Agent 必须是 JSON 数组。");
    }

    customAgents = parsed.map((agent) => ({
      id: String(agent.id || "").trim(),
      name: String(agent.name || "").trim(),
      label: String(agent.label || agent.name || "").trim(),
      scope: agent.scope === "paper" ? "paper" : "selection",
      description: String(agent.description || "").trim(),
      systemPrompt: String(agent.systemPrompt || "").trim(),
      promptTemplate: String(agent.promptTemplate || "").trim()
    }));

    customAgents.forEach((agent, index) => validateAgent(agent, index));
    selectedAgentIndex = customAgents.length ? 0 : -1;
    fillForm(selectedAgentIndex === -1 ? makeEmptyAgent() : customAgents[selectedAgentIndex]);
    syncJsonFromAgents();
    renderAgentList();
  }

  function loadSettings() {
    if (typeof chrome === "undefined" || !chrome.storage?.sync) {
      setStatus("当前页面不在扩展环境中，无法读取配置。请从扩展的选项页打开。", "error");
      return;
    }

    chrome.storage.sync.get(
      [constants.storageKey, constants.customAgentsKey],
      (result) => {
        if (chrome.runtime.lastError) {
          setStatus(`读取配置失败：${chrome.runtime.lastError.message}`, "error");
          return;
        }

        const settings = {
          ...constants.defaultSettings,
          ...(result[constants.storageKey] || {})
        };
        elements.endpoint.value = settings.apiEndpoint || "";
        elements.apiKey.value = settings.apiKey || "";
        elements.model.value = settings.model || "";
        elements.temperature.value = settings.temperature ?? 0.2;
        elements.youtubeApiKey.value = settings.youtubeApiKey || "";
        customAgents = Array.isArray(result[constants.customAgentsKey])
          ? result[constants.customAgentsKey]
          : defaultAgents;
        selectedAgentIndex = customAgents.length ? 0 : -1;
        fillForm(selectedAgentIndex === -1 ? makeEmptyAgent() : customAgents[selectedAgentIndex]);
        syncJsonFromAgents();
        renderAgentList();
      }
    );
  }

  function saveSettings() {
    if (typeof chrome === "undefined" || !chrome.storage?.sync) {
      setStatus("保存失败：当前页面不在扩展环境中。", "error");
      return;
    }

    elements.save.disabled = true;
    setStatus("正在保存配置...", "info");

    let apiEndpoint = "";
    try {
      apiEndpoint = normalizeChatCompletionsEndpoint(elements.endpoint.value);
      if (apiEndpoint) {
        new URL(apiEndpoint);
      }
      loadAgentsFromJson();
    } catch (error) {
      elements.save.disabled = false;
      setStatus(`保存失败：${error.message}`, "error");
      return;
    }

    chrome.storage.sync.set(
      {
        [constants.storageKey]: {
          apiEndpoint,
          apiKey: elements.apiKey.value.trim(),
          model: elements.model.value.trim(),
          temperature: Number(elements.temperature.value || 0.2),
          youtubeApiKey: elements.youtubeApiKey.value.trim(),
          uiLanguage: "zh-CN"
        },
        [constants.customAgentsKey]: customAgents
      },
      () => {
        elements.save.disabled = false;
        if (chrome.runtime.lastError) {
          setStatus(`保存失败：${chrome.runtime.lastError.message}`, "error");
          return;
        }

        elements.endpoint.value = apiEndpoint;
        setStatus(`配置已保存。实际请求地址：${apiEndpoint || "未填写"}`, "success");
      }
    );
  }

  function resetSettings() {
    elements.endpoint.value = constants.defaultSettings.apiEndpoint;
    elements.apiKey.value = "";
    elements.model.value = "";
    elements.temperature.value = constants.defaultSettings.temperature;
    elements.youtubeApiKey.value = "";
    customAgents = [];
    selectedAgentIndex = -1;
    fillForm(makeEmptyAgent());
    syncJsonFromAgents();
    renderAgentList();
    setStatus("已恢复默认值，记得点击保存。", "success");
  }

  elements.save.addEventListener("click", saveSettings);
  elements.reset.addEventListener("click", resetSettings);
  elements.addAgent.addEventListener("click", addAgent);
  elements.applyAgent.addEventListener("click", () => {
    try {
      applyCurrentAgent();
    } catch (error) {
      setStatus(`应用失败：${error.message}`, "error");
    }
  });
  elements.deleteAgent.addEventListener("click", deleteCurrentAgent);
  elements.loadJson.addEventListener("click", () => {
    try {
      loadAgentsFromJson();
      setStatus("已从 JSON 载入 Agent。", "success");
    } catch (error) {
      setStatus(`载入失败：${error.message}`, "error");
    }
  });

  loadSettings();
})();
