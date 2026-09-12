# Crew

本地多智能体协作工作台：组花名册、派任务、看接力与流式回复，随时能停。给想在本机带一支小团队干活的人用（Grok Bot 风格）；自备 OpenAI 兼容 API。

契约版本：**CONTRACT_VERSION 0.1.0**（不要擅自改版本号）。

## 这是什么 / 不是什么

**是什么：** 可点的协作台。左边是 Bot 和群组的花名册，中间像给同事发消息一样布置任务，对话里能看见谁在接（routing / handoff），字按同一套 SSE 往外蹦，点停止会真的 abort 这次请求。

**不是什么：** 又一个只能聊天的套壳 Prompt。不是换个人设继续单聊，也不是只能看的多 Agent 概念图或配置地狱。默认 **Mock**，零 Key 就能演示；要接真模型，打开 `NEXT_PUBLIC_USE_BACKEND=true`，到 Settings 填你自己的 Key。

## 痛点

今天常见的两头都别扭：

- **单模型聊天难分工**：一个人设扛策划、工程、设计，活分不出去，也看不清谁在干哪一段。
- **多 Agent 常是概念图或配置地狱**：先画架构、再配工作流，打开却点不到「派给这支队」。
- **生成停不了、交接看不见**：字在蹦却按不停；handoff 只写在文档或日志里，对话里没有。

## 相对套壳差在哪

| 套壳常见样子 | Crew 钉住的 |
|--------------|-------------|
| 一个对话框换人设 | **花名册 + 群组**：点 Bot 或 Product Launch 这类团队再派活 |
| 交接写在文档里 | 对话里可见 **handoff / routing**（活动条、交接条） |
| Mock 一套、真后端另一套协议 | **同一套 SSE**，只换开关 |
| 「停止」只是按钮变灰 | 点停真 **abort** 这次 fetch（验收 **M-STOP**） |
| 前后端口型对不上 | 契约 **0.1.0** 对齐（`contracts/` ↔ 前端镜像 ↔ `/api`） |

## Demo 看啥

评审片看 [demo/](demo/) 的「开 → 聊 → 停」四拍（约 75 秒，分镜 [demo/STORYBOARD.md](demo/STORYBOARD.md)）。安装、端口、两种模式**仍以本文「安装与使用」为准**，这里不另写步骤。

---

## 安装与使用

这是本仓库最重要的部分。照着做即可在本机跑起来。

### 环境要求

| 项 | 要求 |
|----|------|
| Node.js | **≥ 20.9**（`web/package.json` 未写 `engines`；应用使用 Next.js 16，官方最低要求为 Node 20.9） |
| 包管理器 | **npm**（仓库带 `web/package-lock.json`） |
| 浏览器 | 现代桌面浏览器 |

不需要 Docker。Mock 模式不需要任何 API Key。

### 安装步骤

```bash
git clone https://github.com/VectorJay666/Crew--mutiagent-cooperation-platform.git
cd Crew--mutiagent-cooperation-platform/web
npm install
```

可选：复制环境变量模板（默认就是 Mock，可不改）：

```bash
cp .env.example .env.local
```

`web/.env.example` 里目前只有前端开关；服务端 LLM 变量见该文件注释。

### 两种模式

#### 1. Mock（默认）— 不需要真实 API Key

```bash
npm run dev
```

浏览器打开 **http://localhost:3000**（`package.json` 的 `dev` 脚本是 `next dev`，默认端口 3000）。

此时 `NEXT_PUBLIC_USE_BACKEND` 不为 `true`，前端走本地 mock SSE（`web/src/lib/api.ts` 的 `streamMock`），即可体验花名册、群组交接和打字机效果。

#### 2. 接后端 — 走真实编排 + OpenAI 兼容模型

1. 在 `web/.env.local` 设置：

   ```
   NEXT_PUBLIC_USE_BACKEND=true
   ```

2. **必须重启** `npm run dev`。`NEXT_PUBLIC_*` 在 Next 启动时打进客户端包，改完不重启等于没改。

3. 打开页面后，点左侧栏标题旁的 **齿轮（Settings）**，弹出「连接你的模型」：
   - **Base URL**：OpenAI 兼容地址，默认 `https://api.openai.com/v1`
   - **API Key**：你的密钥（`sk-...` 或供应商提供的 key）
   - **Model**：如 `gpt-4o-mini`
   - **Temperature**：可选，默认 `0.7`
   - 点 **保存**。配置写入浏览器本地 Zustand（key：`crew-bot-store-v1`），发消息时随 `POST /api/chat/stream` 的 `settings` 传给后端。

4. 也可在 `.env.local` 写服务端兜底（请求体没带齐时用）：`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` / `LLM_TEMPERATURE`。

### 验证

任选其一即可：

- 打开 http://localhost:3000，选一个 Bot 或群组，**发一条消息**。Mock 应立刻出现流式回复；接后端时应看到 thinking / 打字机，或明确的缺 Key / 上游错误提示。
- 接后端时，浏览器或终端访问健康检查：

  ```bash
  curl http://localhost:3000/api/health
  ```

  期望类似：`{"ok":true,"version":"0.1.0","contractVersion":"0.1.0"}`。

停生成：输入框右侧发送按钮在流式过程中会变成 **停止（方块）**，会 `AbortController.abort()` 取消本次 fetch。评审录屏（open → chat → stop）：[demo/README.md](demo/README.md)。

---

## 目录归属

| 路径 | 归属 | 做什么 |
|------|------|--------|
| `contracts/` | 结构 / 契约 | 权威类型与 REST+SSE。`types.ts` 领域模型；`api.ts` 端点与 `StreamEvent` |
| `web/src/components/` | 前端 | UI：Sidebar、ChatPanel、Settings 弹窗、输入框 |
| `web/src/app/`（不含 `api/`） | 前端 | Next 页面与布局 |
| `web/src/lib/`（客户端） | 前端 | `api.ts`（`streamChat`）、Zustand `store.ts`、契约镜像 |
| `web/src/app/api/` + `web/src/lib/server/` | 后端 | health / settings / CRUD / `chat/stream`、编排、LLM 代理 |

前端↔后端怎么连、SSE 顺序、停流、契约同步：**[docs/BRIDGE.md](docs/BRIDGE.md)**。

---

## 团队分工

| 角色 | 职责 |
|------|------|
| **Cons** | 前后端衔接 / 契约（开关、SSE、health、`contracts/` 与 `web/src/lib/contract.ts` 对齐） |
| **Skills** | 编排与 Skill（`web/src/lib/server/orchestrator.ts`、prompt、handoff） |
| **Demo** | 演示（Mock 流、种子 Bot/群组、可截图路径） |
| **Test** | 验收（health、发消息、mock↔backend 切换、停止取消 fetch） |
| **Crea** | README 白话层 / 空状态与演示口径 |
| **Vector** | 终审 |

历史三角色文档仍有效，请勿删除：

- [AGENT_ROLE.md](AGENT_ROLE.md)（结构）
- [AGENT_ROLE_FRONTEND.md](AGENT_ROLE_FRONTEND.md)
- [AGENT_ROLE_BACKEND.md](AGENT_ROLE_BACKEND.md)
- [docs/STRUCTURE.md](docs/STRUCTURE.md) · [docs/AGENT_PROTOCOL.md](docs/AGENT_PROTOCOL.md) · [docs/HANDOFF.md](docs/HANDOFF.md)

---

## 已知限制 / 故障排查

| 现象 | 怎么处理 |
|------|----------|
| 改了 `.env.local` 没效果 | `NEXT_PUBLIC_*` 需**重启** `npm run dev`。确认文件在 `web/.env.local`，不是仓库根目录。 |
| 接了后端但回复像演示稿 / 提示未配置 Key | Settings 里填 **API Key** 并保存；或设 `LLM_API_KEY`。空 Key 时后端仍会回一段说明文字，不会去打模型。 |
| CORS / 浏览器拦跨域 | 页面与 `/api/*` 是**同源** Next 路由，正常本地开发不会 CORS。LLM 由**服务端**代理。若把前端和 API 拆到不同域名，需自配 CORS；不要在浏览器里直连第三方 `baseUrl`（会泄 Key + 容易 CORS）。 |
| SSE 断流、回复停在半句 | 点停止、刷新、网络抖动或代理超时都可能掐流。点停止会 abort fetch，属预期。重发一条即可。长回复若经反向代理，需加大 read timeout。 |
| `GET /api/health` 失败 | 先确认 `npm run dev` 已起来且端口是 **3000**。health 不依赖 API Key。 |
| Mock / 后端行为对不上 | 看 `web/.env.local` 的 `NEXT_PUBLIC_USE_BACKEND`。`false` 或不存在 = Mock；只有字符串 `true` 才走后端。 |
| 设置保存后刷新还在 | 正常：存在 `localStorage` 的 `crew-bot-store-v1`。清站点数据会丢掉 bots / 对话 / settings。 |

更细的衔接说明与 Cons 验收清单见 [docs/BRIDGE.md](docs/BRIDGE.md)。
