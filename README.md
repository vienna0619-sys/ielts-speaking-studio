# Vocalis · AI IELTS Speaking Studio

一款可在本地运行的 AI 雅思口语模拟与专项练习 Web 应用。界面以中文为主，考官提问、考试对话和示范表达使用自然英语。

> 重要说明：本项目不属于 IELTS 官方产品，也不使用官方商标或未公开题库。所有估分仅供练习参考。

## 你可以做什么

- 完成一次包含 Introduction、Part 1、Part 2、Part 3 的完整模拟考试。
- 允许 Chrome 使用麦克风，录制每段回答并查看音量。
- 使用虚构的真人风格 AI 考官；页面包含嘴部动作、眨眼、待机与倾听动画。
- 在 Part 2 使用 60 秒准备倒计时、电子笔记和最长 120 秒讲话计时。
- 练习 Part 1、Part 2 或 Part 3，并得到即时的 Mock 反馈。
- 查看四项估分、合理区间、证据、转写、录音、纠错和改进计划。
- 在当前浏览器保存历史、趋势和未完成考试进度。
- 无 API 密钥时使用完整 Mock 模式；有密钥时切换到服务端 OpenAI provider。
- 作为 PWA 安装；基础页面和静态素材可离线打开。

## 最快启动方法

### 1. 安装软件

请先安装：

- [Node.js](https://nodejs.org/) 20 或更高版本
- 最新版 Google Chrome

### 2. 打开终端并进入项目目录

```bash
cd /workspace/scratch/37d75d71638d/ielts-speaking-studio
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
http://localhost:3000
```

首次使用时，Chrome 会询问麦克风权限。请选择“允许”。

## 不配置 API 密钥也能使用吗？

可以。默认就是 Mock 模式：

- 考官语音使用浏览器的 Speech Synthesis。
- 录音使用 `MediaRecorder`。
- 实时转写优先使用 Chrome Web Speech API。
- 评分使用本地、可测试的保守估算逻辑。
- Mock 模式不会把录音发送到本项目配置的外部 AI provider。
- 发音没有经过音素级声学模型分析，因此发音结论明确标为“低置信度”。

Mock 分数只用于预览流程和日常自我观察，不能替代人工评分。

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
4. 在应用的“设置 → 语音与评分服务”中选择“OpenAI 服务端模式”，再点击检测。

API 密钥只由 `app/api/ai/route.ts` 和 `lib/ai/providers.server.ts` 在服务端读取。任何密钥都不应使用 `NEXT_PUBLIC_` 前缀，也不要写进 React 组件或提交到 Git。

默认模型可在 `.env.local` 中覆盖：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe-2025-12-15` | 英语录音转写 |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts-2025-12-15` | 考官语音 |
| `OPENAI_TTS_VOICE` | `marin` | 考官音色 |
| `OPENAI_TEXT_MODEL` | `gpt-5.4-mini` | 结构化复盘报告 |
| `OPENAI_API_BASE` | `https://api.openai.com/v1` | API 地址 |

实现遵循官方 [Speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text)、[Text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech) 与 [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) 说明。Responses 请求设置了 `store: false`。

## 音频与隐私

- “保存录音”默认关闭。
- 关闭时，音频只存在于当前页面会话，刷新或关闭页面后不会由应用永久保留。
- 开启后，音频保存到当前浏览器的 IndexedDB，不会自动上传到项目服务器。
- Mock 模式不把录音发送给本项目的 OpenAI provider；Chrome 的系统转写能力可能受浏览器和操作系统服务实现影响。
- OpenAI 模式会把回答录音发送到你配置的 OpenAI 服务用于转写，并把转写和时间指标发送用于评分。
- 历史成绩、转写、设置与恢复点保存在浏览器 Local Storage。
- 身份检查只模拟考试对话，不上传身份证或其他证件。
- 删除一条保存了录音的历史记录时，关联的 IndexedDB 音频也会删除。

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

## 项目目录

```text
ielts-speaking-studio/
├── app/
│   ├── api/ai/route.ts          # 服务端 AI 网关
│   ├── globals.css              # 响应式视觉系统
│   ├── layout.tsx               # 元数据和 PWA 声明
│   └── page.tsx                 # 应用入口
├── components/
│   ├── ExaminerAvatar.tsx       # 数字考官与音量波形
│   ├── Icons.tsx                # 本地 SVG 图标
│   └── SpeakingStudio.tsx       # 完整产品交互与页面
├── lib/
│   ├── ai/providers.server.ts   # 可替换的服务端 provider
│   ├── browser-audio.ts         # 麦克风、录音、转写与语音播放
│   ├── core.mjs                 # 题库、状态机、计时、指标与评分
│   ├── storage.ts               # Local Storage 与 IndexedDB
│   └── types.ts                 # 领域类型
├── public/
│   ├── images/examiner.png      # 完全虚构的考官素材
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
- 虚构真人风格数字考官及说话、眨眼、待机、倾听动画。
- Mock 与 OpenAI 两种 provider；外部服务失败时显示错误，不伪造云端评分。
- 四维估分、区间、置信度、证据、指标、完整转写与页面内录音回放。
- Part 1/2/3 专项练习、实时转写、严格模式、时长选择、即时反馈和重练。
- 本地历史、移动平均趋势、未完成考试恢复点和可选录音持久化。
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
