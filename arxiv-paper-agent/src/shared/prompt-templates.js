(function () {
  const root = typeof window !== "undefined" ? window : self;

  function buildSharedContext(pageContext) {
    return [
      `论文标题: ${pageContext.title || "未知"}`,
      `论文链接: ${pageContext.url || "未知"}`,
      `页面类型: ${pageContext.pageType || "未知"}`,
      `摘要: ${pageContext.abstract || "无"}`,
      `章节标题: ${(pageContext.sectionHeadings || []).join(" | ") || "无"}`
    ].join("\n");
  }

  root.ARXIV_AGENT_PROMPTS = {
    wordTranslate(selection, pageContext) {
      return {
        system:
          "你是严谨的英文学术阅读助手。请面向中文科研读者，输出准确、简洁、结构化的词汇解析。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `选中词汇: ${selection.text}`,
          `所在句子: ${selection.sentence || "无"}`,
          `所在段落: ${selection.paragraph || "无"}`,
          "请返回 JSON，字段必须包含：term, phonetic, generalMeaning, academicMeanings, examples, notes。",
          "academicMeanings 和 notes 为字符串数组，examples 为包含 original 和 translation 的对象数组。"
        ].join("\n\n")
      };
    },
    sentenceTranslate(selection, pageContext) {
      return {
        system:
          "你是专业的论文翻译助手。请将英文论文内容翻译成自然、正式、贴合学术写作习惯的中文。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `待翻译内容: ${selection.text}`,
          `上下文句子: ${selection.sentence || "无"}`,
          `上下文段落: ${selection.paragraph || "无"}`,
          "请返回 JSON，字段必须包含：translation, keyTerms, notes。",
          "keyTerms 为包含 source 和 target 的对象数组，notes 为字符串数组。"
        ].join("\n\n")
      };
    },
    sentenceExplain(selection, pageContext) {
      return {
        system:
          "你是论文精读导师。请面向中文科研读者解释英文论文句子：先翻译，再说明这句话到底在讲什么，最后列出相关学术板块并解释其背景。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `待解释句子: ${selection.text}`,
          `上下文句子: ${selection.sentence || "无"}`,
          `上下文段落: ${selection.paragraph || "无"}`,
          "请返回 JSON，字段必须包含：translation, meaning, academicBlocks, readingTips。",
          "academicBlocks 为对象数组，每个对象包含 name, summary, explanation, keywords。keywords 为字符串数组，readingTips 为字符串数组。"
        ].join("\n\n")
      };
    },
    termExplain(selection, pageContext) {
      return {
        system:
          "你是 AI 与理工科交叉领域术语专家。请解释论文中的专有名词、模型名或技术概念。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `待解析术语: ${selection.text}`,
          `所在句子: ${selection.sentence || "无"}`,
          `所在段落: ${selection.paragraph || "无"}`,
          "请返回 JSON，字段必须包含：term, definition, background, paperUsage, plainExplanation, aliases。",
          "paperUsage 与 aliases 为字符串数组。"
        ].join("\n\n")
      };
    },
    paperOutline(pageContext) {
      return {
        system:
          "你是论文精读与结构提炼助手。请根据给定论文内容生成中文结构化大纲，聚焦研究背景、创新点、方法、实验和结论。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `正文片段:\n${pageContext.bodyText || "无"}`,
          "请返回 JSON，字段必须包含：title, abstractSummary, background, innovations, methodology, results, conclusion, referencesHint。",
          "innovations, methodology, results 为字符串数组。"
        ].join("\n\n")
      };
    },
    citationTrace(pageContext) {
      return {
        system:
          "你是文献溯源助手。请根据论文页面内容识别可能的引用脉络、关键前置工作、方法来源、数据或基准来源，以及读者应该继续追踪的问题。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `正文片段:\n${pageContext.bodyText || "无"}`,
          "请返回 JSON，字段必须包含：coreLineage, keyReferences, missingEvidence, followUpQueries。",
          "keyReferences 为对象数组，每个对象包含 titleOrClue, role, whyItMatters。followUpQueries 为字符串数组。"
        ].join("\n\n")
      };
    },
    codeReproduce(pageContext) {
      return {
        system:
          "你是论文代码复现规划助手。请根据论文页面内容提取可复现路线，包括代码入口、环境依赖、数据、训练或评估步骤、风险点和最小复现实验。只返回 JSON。",
        user: [
          buildSharedContext(pageContext),
          `正文片段:\n${pageContext.bodyText || "无"}`,
          "请返回 JSON，字段必须包含：repoHints, environment, data, steps, metrics, risks, minimalPlan。",
          "repoHints, environment, data, steps, metrics, risks, minimalPlan 均为字符串数组。"
        ].join("\n\n")
      };
    }
  };
})();
