# ArXiv 论文阅读智能助手

这是一个基于 Chrome / Edge Manifest V3 的 arXiv 论文阅读扩展。它把常见论文阅读动作拆成多个可点击 Agent，让用户在论文页面、摘要页、HTML 页面和扩展自定义 PDF 阅读页中直接完成划词翻译、句子精读、术语解释、资源检索、论文大纲、文献溯源和代码复现规划。

项目目标不是做一个通用聊天窗口，而是把论文阅读中的高频任务做成页面内工具，让读者不必离开当前论文上下文。

## 已实现功能

### 划词与划句

在 arXiv `abs`、`html` 页面，以及扩展自定义 PDF 阅读页中选中文本后，会出现浮动工具栏：

- `词译`：适合单词，返回音标、通用含义、学术语境译法、例句和补充说明。
- `句译`：适合句子或段落，返回中文翻译、关键词对应和翻译说明。
- `句解`：先翻译句子，再解释句子到底在讲什么，并列出可点击展开的学术板块。
- `术语`：解释论文中的模型名、方法名、专业术语或技术概念。
- `资源`：根据选中文本生成 YouTube 学习资源；配置 YouTube Data API Key 后返回具体视频结果。
- `状态`：查看最近一次 LLM API 调用状态。

### 论文级 Agent

右下角固定栏提供论文级功能：

- `大纲`：生成论文结构化大纲。
- `溯源`：梳理文献引用线索、关键前置工作和后续检索问题。
- `复现`：提取代码复现路线、环境依赖、数据、步骤、指标和风险点。
- `状态`：查看最近一次 API 调用记录。

### PDF 划词支持

浏览器内置 PDF Viewer 的文本层不是普通网页 DOM，扩展无法稳定读取其中的划词选区。为了解决许多 arXiv 论文没有 HTML 页面的问题，本项目提供了扩展自定义 PDF 阅读页。

使用方式：

1. 打开 `https://arxiv.org/pdf/...`。
2. 点击浏览器右上角扩展图标。
3. 点击 `用 Agent 阅读 PDF`。
4. 扩展会打开 `src/pdf-viewer/viewer.html`。
5. 该页面使用本地打包的 `pdf.js` 渲染 PDF，并叠加可选择的 text layer。
6. 在自定义 PDF 阅读页中划词或划句，即可调用 `词译 / 句译 / 句解 / 术语 / 资源 / 状态`。

## 配置说明

打开扩展配置页，填写：

- `API Base URL / Endpoint`
- `API Key`
- `Model`
- `Temperature`
- `YouTube Data API Key`
- `自定义 Agent`

### OpenAI 示例

```text
API Base URL / Endpoint: https://api.openai.com/v1
Model: gpt-4o-mini
```

扩展会自动补全为：

```text
https://api.openai.com/v1/chat/completions
```

也可以直接填写完整 endpoint：

```text
https://api.openai.com/v1/chat/completions
```

### MiniMax 示例

```text
API Base URL / Endpoint: https://api.minimaxi.com/v1
Model: MiniMax-M2.7
```

扩展同样会自动补全 `/chat/completions`。

### YouTube Data API Key

`YouTube Data API Key` 是可选项。

- 不填写：`资源` 功能返回 YouTube 搜索页链接。
- 填写：`资源` 功能调用 YouTube Data API v3，返回排序后的具体视频结果。

这个 key 需要在 Google Cloud Console 创建，并启用 YouTube Data API v3。

## 自定义 Agent

自定义 Agent 不是必填项。不填写时，内置功能仍然可以正常使用。

配置页已经提供可视化表单：

- `新增 Agent`
- Agent 列表
- `ID`
- `名称`
- `按钮文字`
- `出现位置`
- `描述`
- `System Prompt`
- `Prompt Template`
- `应用到列表`
- `删除当前 Agent`
- `JSON 高级编辑`
- `从 JSON 载入`

表单和 JSON 会自动同步。你可以用表单编辑，也可以直接修改 JSON。

`scope` 决定按钮出现位置：

- `selection`：出现在划词浮动工具栏。
- `paper`：出现在右下角固定栏。

示例：

```json
[
  {
    "id": "formula_explain",
    "name": "公式推导解释 Agent",
    "label": "公式",
    "scope": "selection",
    "description": "解释选中公式或数学表达式的含义与推导思路。",
    "systemPrompt": "你是数学推导讲解助手，请用中文解释公式，并保持严谨。",
    "promptTemplate": "请解释以下论文内容中的公式或推导。选中文本：{{selection}}\n所在段落：{{paragraph}}\n论文标题：{{page.title}}\n正文片段：{{page.bodyText}}"
  }
]
```

可用占位符：

- `{{selection}}`
- `{{sentence}}`
- `{{paragraph}}`
- `{{page.title}}`
- `{{page.abstract}}`
- `{{page.bodyText}}`

## 安装方式

1. 打开 Chrome 或 Edge 扩展管理页面。
2. 开启“开发者模式”。
3. 选择“加载已解压的扩展程序”。
4. 选择项目根目录 `arxiv-paper-agent`。
5. 打开扩展配置页，填写模型参数。
6. 打开 arXiv 论文页面并刷新。

每次修改代码后，需要在扩展管理页点击“重新加载”，并刷新已打开的 arXiv 页面。

## 目录结构

```text
arxiv-paper-agent/
├── manifest.json
├── README.md
├── docs/
│   └── DEVELOPMENT_PROCESS.md
└── src/
    ├── background/
    ├── content/
    ├── options/
    ├── pdf-viewer/
    ├── popup/
    └── shared/
```

目录说明：

- `src/background`：后台 service worker，负责 Agent 调度、LLM 调用、YouTube API 调用和 API 状态记录。
- `src/content`：注入 arXiv 页面，负责划词检测、浮动工具栏、右下角固定栏和结果面板。
- `src/options`：配置页，负责模型配置、YouTube API Key、自定义 Agent 可视化表单和 JSON 高级编辑。
- `src/pdf-viewer`：扩展自定义 PDF 阅读页，基于本地 `pdf.js` 渲染 PDF 并支持 PDF 划词。
- `src/popup`：浏览器扩展图标弹窗，负责页面状态、PDF 阅读入口、摘要页跳转和 API 状态。
- `src/shared`：共享常量、内置 Agent 配置和 prompt 模板。
- `docs`：开发过程记录和设计说明。

## API 调用检测

扩展会记录最近一次 LLM API 调用。可以通过：

1. 页面内 `状态` 按钮查看。
2. 浏览器扩展图标 popup 查看。

状态包含：

- 调用时间
- 阶段：`started`、`completed`、`failed`
- 模型名称
- HTTP 状态码
- endpoint
- token usage
- 错误信息

如果没有记录，说明尚未真正触发模型请求。如果状态为 failed，说明请求发出但接口返回错误。

## Prompt 测试样例说明

后续计划中的“prompt 测试样例”指的是为每个 Agent 准备固定输入，自动调用 prompt 并检查模型输出是否是合法 JSON。

它主要检测：

- 是否能被 `JSON.parse` 解析。
- 是否包含必须字段。
- 字段类型是否正确。
- 是否夹杂 Markdown 或额外解释。
- 多次调用格式是否稳定。

这相当于给 prompt 做“单元测试”，目的是减少前端解析失败。

## 待优化项

- PDF 阅读页已支持划词，后续可继续优化页码跳转、懒加载渲染、当前页指示和 text layer 对齐精度。
- 不同模型仍可能偶尔返回非标准 JSON，后续可增加 prompt 测试样例和更强 JSON 容错。
- 可继续增加 Markdown 导出、更多论文站点适配和 prompt 测试工具。

## 开发过程

详细开发记录见：

[docs/DEVELOPMENT_PROCESS.md](docs/DEVELOPMENT_PROCESS.md)
