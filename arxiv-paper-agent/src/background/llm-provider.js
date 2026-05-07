(function () {
  const root = typeof self !== "undefined" ? self : window;
  const constants = root.ARXIV_AGENT_CONSTANTS;

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        [constants.storageKey],
        (result) => {
          resolve({
            ...constants.defaultSettings,
            ...(result[constants.storageKey] || {})
          });
        }
      );
    });
  }

  function hasLlmConfig(settings) {
    return Boolean(settings.apiEndpoint && settings.apiKey && settings.model);
  }

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

  function extractTextContent(content) {
    if (!content) {
      return "";
    }

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item.text === "string") {
            return item.text;
          }
          return "";
        })
        .join("\n");
    }

    return "";
  }

  function recordApiCall(entry) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return;
    }

    chrome.storage.local.set({
      arxivAgentLastApiCall: {
        at: new Date().toISOString(),
        ...entry
      }
    });
  }

  async function chatJson(prompt) {
    const settings = await getSettings();
    if (!hasLlmConfig(settings)) {
      throw new Error("尚未配置 LLM API Endpoint、API Key 或 Model。");
    }

    const apiEndpoint = normalizeChatCompletionsEndpoint(settings.apiEndpoint);
    recordApiCall({
      ok: null,
      phase: "started",
      endpoint: apiEndpoint,
      model: settings.model
    });

    let response;
    let payload;
    try {
      response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: Number(settings.temperature || 0.2),
          messages: [
            {
              role: "system",
              content: prompt.system
            },
            {
              role: "user",
              content: prompt.user
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        recordApiCall({
          ok: false,
          phase: "failed",
          endpoint: apiEndpoint,
          model: settings.model,
          status: response.status,
          error: errorText.slice(0, 600)
        });
        throw new Error(`LLM 请求失败: ${response.status} ${errorText}`);
      }

      payload = await response.json();
    } catch (error) {
      if (!response) {
        recordApiCall({
          ok: false,
          phase: "failed",
          endpoint: apiEndpoint,
          model: settings.model,
          error: error.message
        });
      }
      throw error;
    }

    const rawContent =
      payload?.choices?.[0]?.message?.content ??
      payload?.output_text ??
      extractTextContent(payload?.output?.[0]?.content);

    if (!rawContent) {
      recordApiCall({
        ok: false,
        phase: "failed",
        endpoint: apiEndpoint,
        model: settings.model,
        status: response.status,
        usage: payload?.usage || null,
        error: "LLM 未返回可解析内容。"
      });
      throw new Error("LLM 未返回可解析内容。");
    }

    recordApiCall({
      ok: true,
      phase: "completed",
      endpoint: apiEndpoint,
      model: settings.model,
      status: response.status,
      usage: payload?.usage || null
    });

    return rawContent;
  }

  function extractJsonBlock(text) {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("模型返回内容不是 JSON。");
      }
      return JSON.parse(match[0]);
    }
  }

  root.ARXIV_LLM_PROVIDER = {
    getSettings,
    hasLlmConfig,
    normalizeChatCompletionsEndpoint,
    chatJson,
    extractJsonBlock
  };
})();
