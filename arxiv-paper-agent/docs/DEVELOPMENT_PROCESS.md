# 开发过程记录

本文档记录 ArXiv 论文阅读智能助手的开发过程，包括功能设计、prompt 设计、实际开发中遇到的问题，以及如何逐步调整 prompt、优化流程并解决问题。

## 1. 项目目标

最初目标是做一个面向 arXiv 论文阅读的浏览器扩展，让用户在论文页面中直接选中文本并调用不同能力，而不是把整篇论文复制到聊天窗口中。

核心设想包括：

- 阅读论文时，选中单词即可翻译。
- 选中句子后，不仅能翻译，还能解释句子的学术含义。
- 对论文整体内容生成结构化大纲。
- 能够扩展新的 Agent，即自定义 Agent功能模块。
- 在配置页中接入 OpenAI 兼容的 Chat Completions API。

随着开发推进，功能逐步扩展为：

- 术语解释。
- YouTube 学习资源。
- 文献引用溯源。
- 代码复现路线。
- API 调用状态检测。


## 2. 总体架构设计

扩展采用 Manifest V3 架构，主要分为五层：

1. `content script`：注入 arXiv 页面，负责页面交互，包括划词检测、浮动工具栏、右下角固定栏和结果面板。
2. `background service worker`：负责统一接收消息、查找 Agent、调用模型接口并返回结果。
3. `shared`：存放内置 Agent 列表、共享常量和 prompt 模板。
4. `options page`：保存模型配置、YouTube API Key 和自定义 Agent。
5. `popup`：展示页面状态、PDF 限制说明、跳转入口和最近 API 调用状态。

这个拆分的原因是：页面交互和模型调用职责不同。content script 负责“用户在页面上做了什么”，background 负责“调用哪个 Agent 和哪个 API”。

## 3. Prompt 设计原则

项目中的 prompt 设计遵循以下原则：

- 输出必须结构化，优先使用 JSON。
- 每个 Agent 只解决一个明确任务。
- prompt 中必须包含论文上下文，例如标题、摘要、页面类型和章节标题。
- 划词类 Agent 需要同时获得选中文本、所在句子和所在段落。
- 论文级 Agent 需要获得正文片段和页面摘要。
- 中文输出面向科研读者，强调准确、清晰和学术语境。

选择 JSON 输出的原因是：前端需要把结果拆成标题、摘要、元信息、分区内容和可展开条目。如果模型自由输出 Markdown，前端很难稳定渲染。

## 4. 共享上下文 Prompt

所有内置 Agent 都会先构造共享论文上下文：

```text
论文标题: {{page.title}}
论文链接: {{page.url}}
页面类型: {{page.pageType}}
摘要: {{page.abstract}}
章节标题: {{page.sectionHeadings}}
```

这个共享上下文用于减少模型误解。例如同一个词在不同论文中可能含义不同，加入标题和摘要后，模型更容易给出符合论文语境的解释。

## 5. 内置 Prompt 设计

### 5.1 词译 Prompt

用途：选中单词后返回适合论文阅读的词汇解析。

System prompt：

```text
你是严谨的英文学术阅读助手。请面向中文科研读者，输出准确、简洁、结构化的词汇解析。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

选中词汇: {{selection.text}}
所在句子: {{selection.sentence}}
所在段落: {{selection.paragraph}}

请返回 JSON，字段必须包含：term, phonetic, generalMeaning, academicMeanings, examples, notes。
academicMeanings 和 notes 为字符串数组，examples 为包含 original 和 translation 的对象数组。
```

设计原因：

- `generalMeaning` 用于普通含义。
- `academicMeanings` 用于论文语境中的常见译法。
- `examples` 帮助用户理解词汇在句中的用法。
- `notes` 用于提示近义词、误译风险或领域差异。

### 5.2 句译 Prompt

用途：选中句子或段落后生成自然、正式的中文翻译。

System prompt：

```text
你是专业的论文翻译助手。请将英文论文内容翻译成自然、正式、贴合学术写作习惯的中文。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

待翻译内容: {{selection.text}}
上下文句子: {{selection.sentence}}
上下文段落: {{selection.paragraph}}

请返回 JSON，字段必须包含：translation, keyTerms, notes。
keyTerms 为包含 source 和 target 的对象数组，notes 为字符串数组。
```

设计原因：

最初句子功能只做翻译，但实际阅读中，用户还需要知道关键词如何对应。因此增加了 `keyTerms` 和 `notes`，帮助用户理解翻译选择。

### 5.3 句解 Prompt

用途：解释句子到底在讲什么内容，涉及哪些学术板块，并且板块可点击展开。

System prompt：

```text
你是论文精读导师。请面向中文科研读者解释英文论文句子：先翻译，再说明这句话到底在讲什么，最后列出相关学术板块并解释其背景。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

待解释句子: {{selection.text}}
上下文句子: {{selection.sentence}}
上下文段落: {{selection.paragraph}}

请返回 JSON，字段必须包含：translation, meaning, academicBlocks, readingTips。
academicBlocks 为对象数组，每个对象包含 name, summary, explanation, keywords。keywords 为字符串数组，readingTips 为字符串数组。
```

设计原因：

句解功能和句译不同。句译只解决“怎么翻译”，句解解决“这句话在论文中承担什么作用”。因此设计了：

- `translation`：先给用户一个明确译文。
- `meaning`：解释句子到底讲什么。
- `academicBlocks`：列出相关学术板块。
- `keywords`：帮助用户定位板块关键词。
- `readingTips`：提供阅读建议。

为了支持点击展开，`academicBlocks` 被设计成对象数组，而不是普通字符串数组。

### 5.4 术语解释 Prompt

用途：解释模型名、方法名、技术概念或专业术语。

System prompt：

```text
你是 AI 与理工科交叉领域术语专家。请解释论文中的专有名词、模型名或技术概念。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

待解析术语: {{selection.text}}
所在句子: {{selection.sentence}}
所在段落: {{selection.paragraph}}

请返回 JSON，字段必须包含：term, definition, background, paperUsage, plainExplanation, aliases。
paperUsage 和 aliases 为字符串数组。
```

设计原因：

术语解释不应只给字典定义，还要说明它在当前论文中的作用。因此加入 `paperUsage`。

### 5.5 论文大纲 Prompt

用途：对整篇论文生成结构化理解。

System prompt：

```text
你是论文精读与结构提炼助手。请根据给定论文内容生成中文结构化大纲，聚焦研究背景、创新点、方法、实验和结论。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

正文片段:
{{page.bodyText}}

请返回 JSON，字段必须包含：title, abstractSummary, background, innovations, methodology, results, conclusion, referencesHint。
innovations, methodology, results 为字符串数组。
```

设计原因：

大纲最初只返回普通总结，但不利于阅读论文。因此改成固定栏目：背景、创新点、方法、实验、结论和参考文献提示。

### 5.6 文献引用溯源 Prompt

用途：根据论文内容分析引用脉络和后续追踪方向。

System prompt：

```text
你是文献溯源助手。请根据论文页面内容识别可能的引用脉络、关键前置工作、方法来源、数据或基准来源，以及读者应该继续追踪的问题。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

正文片段:
{{page.bodyText}}

请返回 JSON，字段必须包含：coreLineage, keyReferences, missingEvidence, followUpQueries。
keyReferences 为对象数组，每个对象包含 titleOrClue, role, whyItMatters。followUpQueries 为字符串数组。
```

设计原因：

文献溯源不能保证直接从页面中解析完整参考文献，因此 prompt 使用 `titleOrClue`，允许模型输出“标题或线索”，并用 `missingEvidence` 明确提示证据不足处。

### 5.7 代码复现 Prompt

用途：帮助用户从论文中提炼复现路线。

System prompt：

```text
你是论文代码复现规划助手。请根据论文页面内容提取可复现路线，包括代码入口、环境依赖、数据、训练或评估步骤、风险点和最小复现实验。只返回 JSON。
```

User prompt 结构：

```text
{{sharedContext}}

正文片段:
{{page.bodyText}}

请返回 JSON，字段必须包含：repoHints, environment, data, steps, metrics, risks, minimalPlan。
repoHints, environment, data, steps, metrics, risks, minimalPlan 均为字符串数组。
```

设计原因：

复现任务需要把“能不能复现”拆成多个检查项，因此设计为仓库线索、环境、数据、步骤、指标、风险和最小实验计划。

## 6. 自定义 Agent Prompt

自定义 Agent 是为了让用户在不改代码的情况下新增按钮。配置格式如下：

```json
[
  {
    "id": "core_summary",
    "name": "论文核心观点总结 Agent",
    "label": "总结",
    "scope": "paper",
    "description": "提炼论文想解决的问题、方案与贡献。",
    "systemPrompt": "你是论文综述助手，请用中文输出条理清晰的总结。",
    "promptTemplate": "请总结这篇论文的核心观点。标题：{{page.title}}\n摘要：{{page.abstract}}\n正文片段：{{page.bodyText}}"
  }
]
```

调用规则：

- `scope: "selection"` 时，按钮出现在划词浮层中。
- `scope: "paper"` 时，按钮出现在右下角固定栏中。
- 只有用户点击按钮时才会调用。
- 不填写自定义 Agent 不影响内置功能运行。

## 7. 实际开发中遇到的问题与解决过程

### 7.1 配置页保存没有反应

问题表现：

- 点击“保存配置”没有明显反馈。
- 没有错误提示。
- 用户无法判断是保存成功、JSON 错误还是浏览器存储失败。

原因分析：

- 保存状态显示时间短且位置不明显。
- 没有读取 `chrome.runtime.lastError`。
- 配置页字段名 `API Endpoint` 容易让用户误解，需要填写完整 endpoint。

解决方式：

- 增加保存中、保存成功、保存失败状态。
- 捕获 JSON 解析错误和 `chrome.storage` 错误。
- 将字段改为 `API Base URL / Endpoint`。
- 自动把 `https://api.openai.com/v1` 或 `https://api.minimaxi.com/v1` 补全为 `/chat/completions`。

### 7.2 无法正常调用API

问题表现：

- 用户按照模型平台官网填写 Base URL 后无法正常调用。

原因分析：

- 代码最初直接把用户输入作为完整 Chat Completions URL。
- 用户看到官网环境变量 `OPENAI_BASE_URL=https://api.minimaxi.com/v1`，自然会填写 Base URL。

解决方式：

- 在保存配置时自动补全 `/chat/completions`。
- 在模型调用层也做一次 endpoint 归一化，兼容旧配置。

### 7.3 arXiv URL 有效范围

问题表现：

- 最初 manifest 中包含 `https://*.arxiv.org/*`。
- 用户指出 `https://arxiv.org/` 才是有效阅读页面。

解决方式：

- 将 content script 匹配收敛到 `https://arxiv.org/*`。
- popup 中也只按 `https://arxiv.org/` 判断当前页面。

### 7.4 abs 页面划词没有浮动工具栏

问题表现：

- 右下角固定栏存在。
- 但在 abs 页面选中单词或句子后，没有浮层弹出。

原因分析：

- 浮动工具栏最初使用 `absolute` 定位，容易受 arXiv 页面布局和滚动影响。
- 只监听 `mouseup` 和 `keyup` 不够稳定。
- Agent 目录加载失败或尚未返回时，划词工具栏可能为空。

解决方式：

- 将浮动工具栏改为 `fixed`。
- 使用鼠标位置作为选区矩形失败时的兜底位置。
- 增加 `selectionchange`、`pointerup`、`dblclick` 监听。
- 内置 Agent 在后台目录返回前也立即可用。

### 7.5 PDF 页面划词无法触发

问题表现：

- PDF 页面可以生成大纲、溯源、复现。
- 但 PDF 页面选中文本没有划词浮层。

原因分析：

- Chrome / Edge 内置 PDF Viewer 的文本层不属于普通网页 DOM。
- content script 无法稳定读取 PDF Viewer 中的选区。

解决方式：

- PDF 页面保留右下角论文级功能。
- popup 中提示 PDF Viewer 限制。
- 提供打开 HTML 阅读页和摘要页的入口。
- 基于 `pdf.js` 做自定义 PDF 阅读页。

### 7.6 API Key 没有消耗记录

问题表现：

- 用户发现平台上没有显示 API 消耗。
- 不确定是否真正调用了模型。

原因分析：

- 平台消耗可能有延迟。
- 有些功能在未配置模型时会走降级逻辑。
- 如果划词事件没有触发，也不会发出 API 请求。

解决方式：

- 在 `llm-provider.js` 中记录最近一次 API 调用。
- 记录内容包括 started、completed、failed、endpoint、model、HTTP 状态码、usage 和错误信息。
- 在页面内和 popup 中提供 `状态` 按钮。

### 7.7 YouTube 资源按钮显示异常

问题表现：

- 选中长句后点击资源，YouTube 搜索链接按钮显示成巨大深蓝块。

原因分析：

- 直接把完整查询句子作为按钮文本。
- CSS 采用胶囊按钮，长文本会撑大容器。

解决方式：

- 资源链接改为紧凑卡片。
- 主标题使用 `YouTube 搜索` 或视频标题。
- 长查询文本作为小号说明，并使用省略显示。
- 结果面板增加自适应宽度和长文本换行规则。

### 7.8 结果面板边框和宽度不自适应

问题表现：

- 中文长段落显示拥挤。
- 链接按钮和结果块会撑破边框或显得过大。

解决方式：

- 结果面板使用 `fit-content`、`min-width` 和 `max-width` 控制自适应范围。
- 对内容块设置 `max-width: 64ch`。
- 链接卡片使用 `auto-fit` 网格布局。
- 长文本使用 `overflow-wrap`、省略和容器内换行。

## 8. 搭建agent的Prompt 迭代过程

### 第一阶段：只做翻译

最初 prompt 只要求模型翻译词语或句子。很快发现这无法满足论文阅读需求，因为用户不仅需要知道中文意思，还需要知道概念在论文语境中如何使用。

调整：

- 词译增加学术语境译法。
- 句译增加关键词对应和翻译说明。

### 第二阶段：从翻译扩展到理解

提出需要“解释句子意思”，并且说明句子涉及哪些学术板块。
prompt采用markdown格式输入以增加AI识别准确度：                                   
- 增加划出句子解释该句子意思的功能，解释的时候不仅要翻译成中文，还有解释句子到底在讲什么内容，涉及哪些学术板块，并且列出的学术板块要能够通过点击的方式展开解释

调整：

- 新增句解 Agent。
- 将输出拆成 `translation`、`meaning`、`academicBlocks` 和 `readingTips`。
- `academicBlocks` 设计成对象数组，以支持前端点击展开。

### 第三阶段：从局部理解扩展到整篇论文

阅读论文不仅需要理解句子，还需要理解论文结构、引用来源和复现路径。
prompt：
- 增加文献引用溯源 Agent 与代码复现 Agent  

调整：

- 大纲 prompt 从普通总结改成固定结构栏目。
- 新增文献溯源 prompt。
- 新增代码复现 prompt。

### 第四阶段：从自然语言输出改为结构化输出

自由文本结果不利于前端渲染，也不利于做可展开板块。

调整：

- 所有内置 LLM Agent 都要求只返回 JSON。
- 每个 Agent 明确字段名称和字段类型。
- 后台统一解析 JSON 并归一化为前端结果结构。

### 第五阶段：增加可观测性

prompt：
- 我的api账户界面没有显示调用用量，我无法判断 API 是否被调用，是否输出的是固定内容。

调整：

- 模型请求开始时记录 `started`。
- 请求成功时记录 `completed` 和 usage。
- 请求失败时记录 `failed` 和错误信息。
- 页面内和 popup 都能查看状态。

## 9. 当前流程

划词功能流程：

1. 用户在 arXiv abs/html 页面选中文本。
2. content script 捕获选区。
3. 根据选区长度和是否单词决定显示哪些 Agent。
4. 用户点击 Agent。
5. content script 发送 `RUN_AGENT` 消息到 background。
6. background 找到内置或自定义 Agent。
7. prompt 模板组装上下文。
8. llm-provider 调用 OpenAI 兼容 Chat Completions API。
9. background 解析 JSON 并返回结构化结果。
10. content UI 渲染结果面板。

论文级功能流程：

1. 用户点击右下角固定栏按钮。
2. content script 提取页面标题、摘要、章节标题和正文片段。
3. background 调用对应论文级 Agent。
4. LLM 返回 JSON。
5. 前端按 section 渲染结果。

## 10. 后续优化方向

- 增加 prompt 测试样例，检测模型是否稳定返回合法 JSON。
- 增加导出功能，把论文大纲、溯源和复现计划保存为 Markdown。
- 增加更多页面适配，例如 ar5iv、OpenReview 或 ACL Anthology。
