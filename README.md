# Vocalis · AI IELTS Speaking Studio

一款可在本地运行的 AI 雅思口语模拟与专项练习 Web 应用。界面以中文为主，考官提问、考试对话和示范表达使用自然英语。

> 重要说明：本项目不属于 IELTS 官方产品，也不使用官方商标或未公开题库。所有估分仅供练习参考。

## 你可以做什么

- 完成一次包含 Introduction、Part 1、Part 2、Part 3 的完整模拟考试。
- 允许 Chrome 使用麦克风，录制每段回答并查看音量。
- 日常练习使用可驱动的分层 2D 教练；全真模拟使用四名完全虚构的预渲染写实成年考官（东亚、南亚、黑人、白人外观），不再复用卡通人物，也没有黑色嘴眼覆盖层。
- 在设置中选择并试听经过核验的英式女声、英式男声和北美女声；未通过真实性别、口音或流畅度检查的北美男声、澳洲和印度声音明确停用。
- 全真模拟每场可随机分配考官形象与可用口音；本场 Part 1–3 以及恢复考试时保持一致。
- 在 Part 2 使用 60 秒准备倒计时、电子笔记和最长 120 秒讲话计时。
- 练习 Part 1、Part 2 或 Part 3，并得到即时的 Mock 反馈。
- 查看四项估分、合理区间、证据、转写、录音、纠错和改进计划。
- 在当前浏览器保存版本化完整报告、历史、表达库、趋势和未完成考试进度。
- 根据实际回答生成少量词汇、搭配、连接表达、句型和语法推荐，并跨多次练习维护“我的表达库”。
- 无 API 密钥时使用完整 Mock 模式；有密钥时切换到服务端 OpenAI provider。
- 作为 PWA 安装；基础页面和静态素材可离线打开。

## 最快启动方法

### 1. 安装软件

请先安装：

- [Node.js](https://nodejs.org/) 22.13 或更高版本
- 最新版 Google Chrome

### 2. 打开终端并进入项目目录

```bash
cd ielts-speaking-studio
```

如果你把项目复制到了别的地方，请把上面的路径换成你自己的路径。

### 3. 安装依赖

```bash
npm install
```

### 4. 启动开发服务器

```bash
npm run dev
```

终端出现 `Ready` 后，在 Chrome 打开：

```text
http://localhost:5173
```

首次使用时，Chrome 会询问麦克风权限。请选择“允许”。

## 不配置 API 密钥也能使用吗？

可以。默认就是 Mock 模式：

- 考官语音使用浏览器 Speech Synthesis，但会等待异步 `voiceschanged`，按地区、音色风格和质量显式选择 voice，不直接使用系统默认 voice。
- 录音使用 `MediaRecorder`。
- 实时转写优先使用 Chrome Web Speech API。
- 评分使用本地、可测试的保守估算逻辑。
- Mock 模式不会把录音发送到本项目配置的外部 AI provider。
- 发音没有经过音素级声学模型分析，因此发音结论明确标为“低置信度”。

Mock 分数只用于预览流程和日常自我观察，不能替代人工评分。

## 考官声音、随机口音与数字人

### 声音选择

- 默认日常练习声音为中性英式女声预设，`rate=0.98`、`pitch=1`、`volume=1`；不会用提高 pitch 掩盖低质量 voice。
- 设置页展示每个预设的口音、声音风格、provider、本地/网络属性、当前可用状态和统一文本试听。
- 浏览器层会优先选择 Microsoft/Google/Apple 的地区匹配自然声音，并排除常见 novelty/eSpeak 声音。指定声音不可用时，依次回退到同地区备用、同风格英式声音、其他高质量英语声音，并显示提示。
- 任意新语音或录音回放开始前都会停止上一段；开始用户录音前也会强制停止考官语音。
- OpenAI TTS 输出通过 Web Audio `AnalyserNode` 获取平滑音量，直接驱动嘴部开合。浏览器 Speech Synthesis 不提供输出 PCM，因此 Mock 模式使用 `boundary` 事件与文本元音单元生成简化 viseme；这是真正随文本进度变化的口型，但不是音素级唇形同步。

### 模拟考试随机考官

- 只在全真模拟中自动随机；日常练习始终使用用户选择的固定声音。
- 当前正式随机池只包含已核验的标准英式男/女声与北美女声。北美男声、澳大利亚和印度英语预设仍保留在 provider 配置中，但 `enabled=false`，不会为了凑口音数量进入正式模拟。
- 如果以后在实际设备或远程 provider 中核验到合格的澳洲/印度声音，可通过结构化 voice profile 重新启用；不会用 pitch、rate 或滤镜伪造地区口音。
- 最近三场的相同口音和完全相同的“形象 + 声音”组合会被降权。分配由 session seed 决定并写入考试恢复点，所以刷新恢复、Part 1、Part 2 和 Part 3 均保持同一考官。
- 人物外观与口音独立抽取，不根据肤色或面部特征推断口音。考试历史保存考官编号、口音和独立的“是否容易理解”反馈；该反馈不会进入四项评分。

### 当前数字人实现和限制

`PracticeExaminer` 封装现有分层 SVG rig，只用于日常练习。`MockExamExaminer` 则使用本地、完全虚构且获得本项目使用权的写实预渲染状态精灵：每位人物都有独立的 Idle、Blink、Speaking 真正画面，组件以随机眨眼、轻微呼吸、倾听点头和经过平滑的 TTS 音量切换完整帧。它不会在静态照片上画黑色椭圆或眼罩，缩放时也不会发生脸部覆盖层错位。

这仍是“简化真人模式”，不是连续视频、3D blend shape、Live2D、音素级 viseme 或付费实时数字人。嘴型目前是音量驱动的闭口/开口预渲染帧；高级唇形和连续表情需要以后接入授权 3D 模型或真人数字人 provider。界面和 README 都如实标注这一限制。

## 配置 OpenAI 服务（可选）

1. 复制环境变量示例：

   ```bash
   cp .env.example .env.local
   ```

2. 用文本编辑器打开 `.env.local`，填写：

   ```text
   OPENAI_API_KEY=你的服务端密钥
   ```

3. 重新运行 `npm run dev`。
4. 在应用的“设置 → OpenAI 评分”中选择“OpenAI 服务端模式”，再点击“测试 OpenAI 连接”。

ChatGPT 网页登录和 ChatGPT Plus 不会给这个项目自动提供 API 权限。OpenAI API 使用独立的项目密钥、账单与额度，真实转写、语音和评分会产生 API 费用。

API 密钥只由 `app/api/ai/route.ts` 和 `lib/ai/providers.server.ts` 在服务端读取。任何密钥都不应使用 `NEXT_PUBLIC_` 前缀，也不要写进 React 组件或提交到 Git。

默认模型可在 `.env.local` 中覆盖：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe-2025-12-15` | 英语录音转写 |
| `OPENAI_TTS_MODEL` | `gpt-audio-1.5` | 通过 Chat Completions 生成自然考官语音；可显式覆盖回旧 Speech endpoint 模型 |
| `OPENAI_TTS_VOICE` | `marin` | 考官音色 |
| `OPENAI_TTS_VOICE_{GB,US,AU,IN}_{FEMALE,MALE}` | 空 | 可选的 8 个考官声音覆盖值；未设置时女声用 `marin`、男声用 `cedar` |
| `OPENAI_TEXT_MODEL` | `gpt-5.6-terra` | Responses API 严格结构化复盘报告 |
| `OPENAI_API_BASE` | `https://api.openai.com/v1` | API 地址 |

实现使用官方 `openai` SDK。转写使用 `gpt-4o-mini-transcribe`；语音默认使用 `gpt-audio-1.5` 的 Chat Completions 音频输出；评分使用 Responses API 严格 JSON Schema，默认 `gpt-5.6-terra`，并设置 `store: false`。连接诊断只发送一个极小的合法请求，不上传整场录音。

## 音频与隐私

- “保存录音”默认关闭。
- 关闭时，音频只存在于当前页面会话，刷新或关闭页面后不会由应用永久保留。
- 开启后，音频保存到当前浏览器的 IndexedDB，不会自动上传到项目服务器。
- Mock 模式不把录音发送给本项目的 OpenAI provider；Chrome 的系统转写能力可能受浏览器和操作系统服务实现影响。
- OpenAI 模式会把回答录音发送到你配置的 OpenAI 服务用于转写，并把转写和时间指标发送用于评分。
- 设置、历史列表小索引与恢复点保存在 Local Storage；版本化完整报告和表达库保存在 IndexedDB，避免完整报告挤爆 Local Storage。
- 身份检查只模拟考试对话，不上传身份证或其他证件。
- 删除历史前会明确列出范围并二次确认；删除后会移除该记录的 IndexedDB 报告和允许保存的音频。历史报告中的原始推荐快照与当前表达库状态彼此独立。

## 完整历史报告与表达库

- 每次评分先保存小型历史索引，再把不可变的结构化报告快照写入 IndexedDB。报告包括题目、Cue Card、分段时间戳、转写来源/置信度、四项评分证据、全部纠错、改进回答、训练任务、考官/voice/provider/model 和个性化推荐。
- 用户未开启“保存录音”时，报告只保留允许保存的文字和指标，不会偷偷持久化音频。
- 旧版 Local Storage 历史会迁移为 `reportVersion=1` 摘要；缺失区域显示“该内容在旧版本中未保存”，不补造旧反馈。
- “使用当前评分系统重新分析”必须主动点击，会新增一个报告版本，不覆盖原始版本，并显示日期、模型和可能产生费用的提示。
- 推荐系统优先识别真实回答中的重复简单词、报告纠错和当前薄弱项，限制总数量并去重；不把所有简单词当错误，也不堆砌生僻 Band 9 词汇。
- “我的表达库”支持待学习、复习中、已掌握、经常用错和隐藏状态，以及收藏、来源定位、发音、自己的造句和删除。已掌握项目以后再次明显用错时会重新标记。

## 常用命令

```bash
# 开发模式
npm run dev

# TypeScript 类型检查
npm run typecheck

# ESLint
npm run lint

# 单元测试
npm test

# 生产构建
npm run build

# 运行已经构建的生产版本
npm start
```

## 测试范围

`tests/core.test.mjs` 当前覆盖：

- 11 状态考试状态机与完整转场
- 非法状态转场
- Part 2 准备和讲话计时边界
- 题目主题去重
- Part 2 与 Part 3 主题关联
- 语速、停顿、填充词等辅助指标
- 保守 Mock 评分和发音低置信度
- 专项练习反馈
- 历史记录去重和上限
- Provider 与麦克风异常提示
- 考官 session seed 的确定性恢复与设备可用 voice 过滤
- 固定声音、口音范围、近期口音降权和人物/口音独立性

## 项目目录

```text
ielts-speaking-studio/
├── app/
│   ├── api/ai/route.ts          # 服务端 AI 网关
│   ├── globals.css              # 响应式视觉系统
│   ├── layout.tsx               # 元数据和 PWA 声明
│   └── page.tsx                 # 应用入口
├── components/
│   ├── ExaminerAvatar.tsx       # 日常练习分层卡通教练与音量波形
│   ├── PracticeExaminer.tsx     # 日常练习考官适配层
│   ├── MockExamExaminer.tsx     # 写实预渲染模拟考官适配层
│   ├── HistoryReportDetail.tsx  # 不可变完整历史报告与版本切换
│   ├── ExpressionLibraryView.tsx # 我的表达库
│   ├── Icons.tsx                # 本地 SVG 图标
│   ├── VoiceSettings.tsx        # 声音列表、可用状态与试听
│   └── SpeakingStudio.tsx       # 完整产品交互与页面
├── lib/
│   ├── ai/providers.server.ts   # 可替换的服务端 provider
│   ├── ai-client.ts             # 前端诊断、幂等评分与安全错误映射
│   ├── browser-audio.ts         # 麦克风、录音、转写与语音播放
│   ├── core.mjs                 # 题库、状态机、计时、指标与评分
│   ├── examiner-voices.ts        # 浏览器 voice 排序、回退与 voiceschanged
│   ├── storage.ts               # Local Storage 与 IndexedDB
│   ├── reporting.ts             # 版本化报告快照
│   ├── recommendations.ts       # 个性化表达与长期信号
│   └── types.ts                 # 领域类型
├── public/
│   ├── manifest.webmanifest
│   └── sw.js
├── tests/core.test.mjs
├── .env.example
├── AGENTS.md
└── docs/ARCHITECTURE.md
```

## 已实现的 MVP

- 中文首页、首次引导、设备检查、目标设置和明暗模式。
- 完整模拟考试状态机，考试期间不显示中文反馈、转写或答案提示。
- 结构化原创题库；最近主题避重复；Part 2/Part 3 强关联。
- Part 2 Cue Card、电子笔记、准备倒计时和讲话上限。
- 真实麦克风录音、音量检测、长停顿计数、浏览器转写和语音播放。
- 日常练习保留分层 2D 教练；全真模拟使用四套虚构写实预渲染考官（含东亚和南亚外观）及 Idle/Speaking/Listening 状态。
- 8 个结构化声音预设中只启用 3 个已验证选项；统一试听、异步 voice 加载、显式停用状态、回退提示和播放互斥。
- 仅全真模拟启用的随机考官系统、近期组合降权、session 恢复、历史口音与独立听感反馈。
- Mock 与 OpenAI 两种 provider；外部服务失败时显示错误，不伪造云端评分。
- 四维估分、区间、置信度、证据、指标、完整转写与页面内录音回放。
- Part 1/2/3 专项练习、实时转写、严格模式、时长选择、即时反馈和重练。
- IndexedDB 完整报告快照、可追加重新分析版本、表达库、跨记录信号、Local Storage 小索引、恢复点和可选录音持久化。
- PWA manifest、service worker、桌面/平板/手机响应式布局和键盘焦点状态。

## 后续可继续开发

- 接入音素级发音模型，提供更可靠的音素、重音、节奏与语调证据。
- 接入低延迟 Realtime 语音对话，减少轮次之间等待。
- 接入更高级的实时数字人服务；现有 `ExaminerAvatar` 已与对话状态解耦。
- 加入服务器数据库、账号、多设备同步和教师端报告。
- 加入经审核的 AI 原创题目生成、内容安全过滤和题库后台。
- 加入 Part 2 两次录音并排对比、波形对齐和更细的回答结构分析。
- 增加 Playwright 端到端浏览器测试和真实设备矩阵。

## 部署

### OpenAI Sites（本仓库当前正式部署）

本仓库包含 `.openai/hosting.json` 和带服务端路由的 vinext/Cloudflare 构建。正式发布应使用 Sites 部署，并在站点环境变量中配置 `OPENAI_API_KEY` 以及需要覆盖的模型变量。这样 `/api/ai` 才真实存在。

GitHub Pages 只发布静态预览：Mock、练习、录音、本地历史和浏览器语音可以工作，但它没有服务端运行时，因此“测试 OpenAI 连接”会明确显示评分路由不存在，不能声称是真实 OpenAI 评分。

### Vercel

1. 把代码推送到 Git 仓库。
2. 在 Vercel 导入仓库。
3. Framework 选择 Next.js。
4. 在 Vercel 项目设置中填写与 `.env.example` 对应的服务端环境变量。
5. 部署后使用 HTTPS 域名访问。浏览器麦克风在生产环境通常要求 HTTPS。

### 普通 Node.js 服务器

```bash
npm ci
npm run build
npm start
```

反向代理应启用 HTTPS，并把请求转发到默认端口 3000。

## 常见问题

### Chrome 没有弹出麦克风权限

点击地址栏左侧的站点图标，打开“网站设置”，把“麦克风”改成“允许”，然后刷新页面。

### 显示“没有找到麦克风”

确认设备已连接，并在操作系统隐私设置中允许 Chrome 使用麦克风。关闭正在独占麦克风的会议软件后重试。

### 有录音但没有实时转写

Chrome Web Speech API 在某些系统、地区或网络环境中可能不可用。录音仍会保留在当前会话；可配置 OpenAI provider 做服务端转写。

### OpenAI 检测显示未配置

确认 `.env.local` 位于项目根目录、变量名为 `OPENAI_API_KEY`，然后完全停止并重新启动 `npm run dev`。

### API 超时或额度不足

页面会明确显示错误并保留考试进度，不会伪造云端评分。可以稍后重试，或主动选择“使用 Mock 低置信度分析”。

### 刷新后为什么录音不见了

这是默认隐私设计。只有在设置中主动打开“保存录音到本机”后，新录音才会写入 IndexedDB。

### 为什么 Mock 发音结论是低置信度

文字稿无法可靠判断具体发音。Mock 只参考录音时长、转写可用性、语速和停顿，不会把猜测写成确定事实。
