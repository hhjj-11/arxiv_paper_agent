(function () {
  const root = typeof window !== "undefined" ? window : self;

  root.ARXIV_AGENT_CONSTANTS = {
    extensionName: "ArXiv 论文阅读智能助手",
    arxivBaseUrl: "https://arxiv.org/",
    arxivOrigin: "https://arxiv.org",
    storageKey: "arxivAgentSettings",
    customAgentsKey: "arxivCustomAgents",
    selectionThrottleMs: 180,
    maxContextChars: 18000,
    maxSelectionChars: 4000,
    defaultSettings: {
      apiEndpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: "",
      model: "",
      temperature: 0.2,
      youtubeApiKey: "",
      uiLanguage: "zh-CN"
    },
    builtInAgents: [
      {
        id: "word_translate",
        label: "词译",
        scope: "selection",
        description: "单词释义、音标与学术语境译法"
      },
      {
        id: "sentence_translate",
        label: "句译",
        scope: "selection",
        description: "整句或整段学术中文翻译"
      },
      {
        id: "sentence_explain",
        label: "句解",
        scope: "selection",
        description: "翻译句子，解释句意，并展开相关学术板块"
      },
      {
        id: "term_explain",
        label: "术语",
        scope: "selection",
        description: "专有名词定义、背景与通俗解释"
      },
      {
        id: "resource_jump",
        label: "资源",
        scope: "selection",
        description: "生成 YouTube 学习资源链接"
      },
      {
        id: "paper_outline",
        label: "大纲",
        scope: "paper",
        description: "梳理论文结构、创新点与结论"
      },
      {
        id: "citation_trace",
        label: "溯源",
        scope: "paper",
        description: "梳理文献引用线索、关键来源与可追踪问题"
      },
      {
        id: "code_reproduce",
        label: "复现",
        scope: "paper",
        description: "提取代码复现路线、依赖、数据与实验步骤"
      }
    ]
  };
})();
