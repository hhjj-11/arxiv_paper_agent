(function () {
  const root = typeof self !== "undefined" ? self : window;
  const constants = root.ARXIV_AGENT_CONSTANTS;
  const prompts = root.ARXIV_AGENT_PROMPTS;
  const llmProvider = root.ARXIV_LLM_PROVIDER;

  function ensureSelectionText(selection) {
    if (!selection?.text || !selection.text.trim()) {
      throw new Error("请先在 ArXiv 页面选中需要处理的内容。");
    }
  }

  function ensurePageContext(pageContext) {
    if (!pageContext?.title && !pageContext?.bodyText && !pageContext?.abstract) {
      throw new Error("当前页面未提取到论文上下文，请切换到 ArXiv 论文摘要页、HTML 正文页或选中 PDF 文本后再试。");
    }
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function normalizeTermResult(data) {
    return {
      title: `术语解析 · ${data.term || "未命名术语"}`,
      summary: data.definition || "未返回定义。",
      meta: [
        {
          label: "别名 / 通用指代",
          value: normalizeArray(data.aliases).join("；") || "无"
        }
      ],
      sections: [
        { heading: "技术背景", body: data.background || "无" },
        { heading: "论文语境中的含义", body: normalizeArray(data.paperUsage).join("\n") || "无" },
        { heading: "通俗解释", body: data.plainExplanation || "无" }
      ]
    };
  }

  function normalizeWordResult(data) {
    const examples = normalizeArray(data.examples)
      .map((item) => `- ${item.original || ""}\n  ${item.translation || ""}`)
      .join("\n");

    return {
      title: `词汇解析 · ${data.term || ""}`.trim(),
      summary: data.generalMeaning || "未返回释义。",
      meta: [
        {
          label: "音标",
          value: data.phonetic || "未提供"
        }
      ],
      sections: [
        { heading: "学术语境译法", body: normalizeArray(data.academicMeanings).join("\n") || "无" },
        { heading: "例句", body: examples || "无" },
        { heading: "补充说明", body: normalizeArray(data.notes).join("\n") || "无" }
      ]
    };
  }

  function normalizeSentenceResult(data) {
    const termLines = normalizeArray(data.keyTerms)
      .map((item) => `${item.source || ""} -> ${item.target || ""}`)
      .join("\n");

    return {
      title: "学术翻译",
      summary: data.translation || "未返回译文。",
      sections: [
        { heading: "关键词对应", body: termLines || "无" },
        { heading: "翻译说明", body: normalizeArray(data.notes).join("\n") || "无" }
      ]
    };
  }

  function normalizeSentenceExplainResult(data) {
    const blocks = normalizeArray(data.academicBlocks).map((item) => ({
      title: item.name || "未命名学术板块",
      summary: item.summary || "",
      body: item.explanation || "无",
      meta: normalizeArray(item.keywords).join("、")
    }));

    return {
      title: "句子精读",
      summary: data.translation || "未返回译文。",
      sections: [
        { heading: "这句话在讲什么", body: data.meaning || "无" },
        {
          heading: "相关学术板块",
          body: "点击条目可展开解释。",
          items: blocks
        },
        { heading: "阅读提示", body: normalizeArray(data.readingTips).join("\n") || "无" }
      ]
    };
  }

  function normalizePaperOutline(data, pageContext) {
    return {
      title: `论文大纲 · ${data.title || pageContext.title || "未命名论文"}`,
      summary: data.abstractSummary || pageContext.abstract || "未返回摘要提炼。",
      sections: [
        { heading: "研究背景", body: data.background || "无" },
        { heading: "核心创新点", body: normalizeArray(data.innovations).join("\n") || "无" },
        { heading: "方法论", body: normalizeArray(data.methodology).join("\n") || "无" },
        { heading: "实验结果", body: normalizeArray(data.results).join("\n") || "无" },
        { heading: "结论", body: data.conclusion || "无" },
        { heading: "参考文献提示", body: data.referencesHint || "无" }
      ]
    };
  }

  function normalizeCitationTrace(data) {
    const referenceLines = normalizeArray(data.keyReferences)
      .map((item) => {
        const title = item.titleOrClue || "未命名线索";
        const role = item.role ? `角色：${item.role}` : "";
        const why = item.whyItMatters ? `价值：${item.whyItMatters}` : "";
        return [title, role, why].filter(Boolean).join("\n");
      })
      .join("\n\n");

    return {
      title: "文献引用溯源",
      summary: data.coreLineage || "未返回引用脉络。",
      sections: [
        { heading: "关键来源线索", body: referenceLines || "无" },
        { heading: "证据缺口", body: normalizeArray(data.missingEvidence).join("\n") || "无" },
        { heading: "后续检索问题", body: normalizeArray(data.followUpQueries).join("\n") || "无" }
      ]
    };
  }

  function normalizeCodeReproduce(data) {
    return {
      title: "代码复现路线",
      summary: "根据当前论文页面提取的复现计划。",
      sections: [
        { heading: "代码线索", body: normalizeArray(data.repoHints).join("\n") || "无" },
        { heading: "环境依赖", body: normalizeArray(data.environment).join("\n") || "无" },
        { heading: "数据准备", body: normalizeArray(data.data).join("\n") || "无" },
        { heading: "复现步骤", body: normalizeArray(data.steps).join("\n") || "无" },
        { heading: "指标与验收", body: normalizeArray(data.metrics).join("\n") || "无" },
        { heading: "风险点", body: normalizeArray(data.risks).join("\n") || "无" },
        { heading: "最小复现实验", body: normalizeArray(data.minimalPlan).join("\n") || "无" }
      ]
    };
  }

  function buildSetupHint(featureName) {
    return {
      title: `${featureName} · 需要配置模型`,
      summary: "当前未检测到可用的 LLM 配置，无法执行高质量学术理解任务。",
      sections: [
        {
          heading: "需要配置",
          body: "打开扩展 Options，填写 API Base URL / Endpoint、API Key 与 Model。支持 OpenAI 兼容的 Chat Completions 接口。"
        }
      ]
    };
  }

  function buildHeuristicOutline(pageContext) {
    const headings = normalizeArray(pageContext.sectionHeadings);
    const referencesHeading = headings.find((item) =>
      /reference|bibliography|参考文献/i.test(item)
    );

    return {
      title: `论文大纲 · ${pageContext.title || "未命名论文"}`,
      summary:
        pageContext.abstract || "当前页面未提取到摘要，建议打开论文摘要页或 HTML 页面后再执行。",
      sections: [
        { heading: "研究背景", body: "未配置 LLM，暂以页面摘要作为背景线索。" },
        { heading: "页面章节结构", body: headings.join("\n") || "当前页面未识别到章节标题。" },
        {
          heading: "参考文献",
          body: referencesHeading ? `已识别章节：${referencesHeading}` : "未显式识别到参考文献章节。"
        }
      ]
    };
  }

  async function searchYouTubeVideos(query, apiKey) {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "5");
    url.searchParams.set("order", "relevance");
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`YouTube 搜索失败：${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    return normalizeArray(payload.items)
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        displayLabel: item.snippet?.title || "YouTube 视频",
        label: item.snippet?.channelTitle || "YouTube",
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet?.channelTitle || ""
      }));
  }

  async function buildResourceResult(selection, pageContext) {
    const topic = selection.text.trim();
    const paperHint = pageContext.title ? `${topic} ${pageContext.title}` : topic;
    const queries = [
      `${topic} lecture`,
      `${topic} tutorial`,
      `${paperHint} explanation`
    ];

    const settings = await llmProvider.getSettings();
    let actions = queries.map((query) => ({
      displayLabel: "YouTube 搜索",
      label: query,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    }));
    let summary =
      "已按选中内容生成 YouTube 学习入口。配置 YouTube Data API Key 后，会返回排序后的具体视频结果。";

    if (settings.youtubeApiKey) {
      actions = await searchYouTubeVideos(queries[0], settings.youtubeApiKey);
      summary = actions.length
        ? "已通过 YouTube Data API 返回按相关性排序的具体视频结果。"
        : "YouTube Data API 未返回具体视频结果。";
    }

    return {
      title: `学习资源 · ${topic}`,
      summary,
      sections: [
        {
          heading: "建议检索方向",
          body: queries.join("\n")
        }
      ],
      actions
    };
  }

  function applyTemplate(template, context) {
    return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token) => {
      const path = token.split(".");
      let value = context;
      for (const key of path) {
        value = value?.[key];
      }
      return value == null ? "" : String(value);
    });
  }

  async function getCustomAgents() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([constants.customAgentsKey], (result) => {
        const agents = Array.isArray(result[constants.customAgentsKey])
          ? result[constants.customAgentsKey]
          : [];
        resolve(
          agents.filter(
            (agent) =>
              agent &&
              typeof agent.id === "string" &&
              typeof agent.name === "string" &&
              typeof agent.promptTemplate === "string"
          )
        );
      });
    });
  }

  async function getAgentCatalog() {
    const customAgents = await getCustomAgents();
    const builtIns = constants.builtInAgents.map((item) => ({
      ...item,
      builtIn: true
    }));

    const custom = customAgents.map((item) => ({
      id: item.id,
      label: item.label || item.name,
      scope: item.scope === "paper" ? "paper" : "selection",
      description: item.description || item.name,
      builtIn: false
    }));

    return [...builtIns, ...custom];
  }

  async function runJsonPrompt(promptFactory, normalize, selection, pageContext, featureName) {
    const settings = await llmProvider.getSettings();
    if (!llmProvider.hasLlmConfig(settings)) {
      return buildSetupHint(featureName);
    }

    const prompt = promptFactory(selection, pageContext);
    const text = await llmProvider.chatJson(prompt);
    const data = llmProvider.extractJsonBlock(text);
    return normalize(data, pageContext);
  }

  const builtInHandlers = {
    async word_translate({ selection, pageContext }) {
      ensureSelectionText(selection);
      return runJsonPrompt(
        prompts.wordTranslate,
        normalizeWordResult,
        selection,
        pageContext,
        "词汇翻译"
      );
    },
    async sentence_translate({ selection, pageContext }) {
      ensureSelectionText(selection);
      return runJsonPrompt(
        prompts.sentenceTranslate,
        normalizeSentenceResult,
        selection,
        pageContext,
        "整句翻译"
      );
    },
    async sentence_explain({ selection, pageContext }) {
      ensureSelectionText(selection);
      return runJsonPrompt(
        prompts.sentenceExplain,
        normalizeSentenceExplainResult,
        selection,
        pageContext,
        "句子精读"
      );
    },
    async term_explain({ selection, pageContext }) {
      ensureSelectionText(selection);
      return runJsonPrompt(
        prompts.termExplain,
        normalizeTermResult,
        selection,
        pageContext,
        "术语解析"
      );
    },
    async resource_jump({ selection, pageContext }) {
      ensureSelectionText(selection);
      return buildResourceResult(selection, pageContext);
    },
    async paper_outline({ pageContext }) {
      ensurePageContext(pageContext);

      const settings = await llmProvider.getSettings();
      if (!llmProvider.hasLlmConfig(settings)) {
        return buildHeuristicOutline(pageContext);
      }

      const prompt = prompts.paperOutline(pageContext);
      const text = await llmProvider.chatJson(prompt);
      const data = llmProvider.extractJsonBlock(text);
      return normalizePaperOutline(data, pageContext);
    },
    async citation_trace({ pageContext }) {
      ensurePageContext(pageContext);
      const settings = await llmProvider.getSettings();
      if (!llmProvider.hasLlmConfig(settings)) {
        return buildSetupHint("文献引用溯源");
      }

      const prompt = prompts.citationTrace(pageContext);
      const text = await llmProvider.chatJson(prompt);
      const data = llmProvider.extractJsonBlock(text);
      return normalizeCitationTrace(data);
    },
    async code_reproduce({ pageContext }) {
      ensurePageContext(pageContext);
      const settings = await llmProvider.getSettings();
      if (!llmProvider.hasLlmConfig(settings)) {
        return buildSetupHint("代码复现");
      }

      const prompt = prompts.codeReproduce(pageContext);
      const text = await llmProvider.chatJson(prompt);
      const data = llmProvider.extractJsonBlock(text);
      return normalizeCodeReproduce(data);
    }
  };

  async function runCustomAgent(agentConfig, payload) {
    const settings = await llmProvider.getSettings();
    if (!llmProvider.hasLlmConfig(settings)) {
      return buildSetupHint(agentConfig.name || "自定义 Agent");
    }

    const prompt = {
      system:
        agentConfig.systemPrompt ||
        "你是面向 ArXiv 论文阅读的专业智能助手。请用简洁、结构化的中文回答。",
      user: applyTemplate(agentConfig.promptTemplate, {
        selection: payload.selection?.text || "",
        sentence: payload.selection?.sentence || "",
        paragraph: payload.selection?.paragraph || "",
        page: payload.pageContext || {}
      })
    };

    const text = await llmProvider.chatJson(prompt);
    return {
      title: agentConfig.name,
      summary: agentConfig.description || "自定义 Agent 输出",
      sections: [
        {
          heading: "结果",
          body: text
        }
      ]
    };
  }

  async function runAgent(agentId, payload) {
    if (builtInHandlers[agentId]) {
      return builtInHandlers[agentId](payload);
    }

    const customAgents = await getCustomAgents();
    const customAgent = customAgents.find((item) => item.id === agentId);
    if (!customAgent) {
      throw new Error(`未找到 Agent: ${agentId}`);
    }
    return runCustomAgent(customAgent, payload);
  }

  root.ARXIV_AGENT_REGISTRY = {
    getAgentCatalog,
    runAgent
  };
})();
