# Frontend ↔ Backend Bridge

Owned by **architecture / Cons**. Product behavior stays on **CONTRACT_VERSION 0.1.0** — do not bump the version in this doc or in code unless structure explicitly ships a new contract.

This file answers: how the Next page talks to Next API routes, how to switch mock vs backend, what SSE events look like, how Stop works, and how to keep the duplicated contract in sync.

Related (do not delete): [STRUCTURE.md](STRUCTURE.md), [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md), [HANDOFF.md](HANDOFF.md), root [AGENT_ROLE.md](../AGENT_ROLE.md).

---

## Single switch: `NEXT_PUBLIC_USE_BACKEND`

| 值 | 行为 |
|----|------|
| 未设置 / `false` / 任何非 `true` | **Mock**。`streamChat` 走 `streamMock`，不发 `/api/chat/stream`。不需要 API Key。 |
| 恰好 `true` | **Backend**。`streamChat` `POST /api/chat/stream`，由 `web/src/lib/server/orchestrator.ts` 编排。 |

读取位置（编译期，不是运行时 fetch）：

```95:98:web/src/lib/contract.ts
export const USE_BACKEND =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_USE_BACKEND === "true"
    : false;
```

模板：`web/.env.example` → 复制为 `web/.env.local`。

```
NEXT_PUBLIC_USE_BACKEND=false
```

改完必须重启 `npm run dev`。`NEXT_PUBLIC_*` 在 Next 打包客户端时内联；热更新不会重读 env。

服务端另有可选兜底（内存 store 初始化，见 `web/src/lib/server/store-io.ts`）：

| 变量 | 用途 |
|------|------|
| `LLM_BASE_URL` | 默认 `https://api.openai.com/v1` |
| `LLM_API_KEY` | 服务端默认 Key |
| `LLM_MODEL` | 默认 `gpt-4o-mini` |
| `LLM_TEMPERATURE` | 默认 `0.7` |

UI Settings 保存在浏览器 Zustand。`ChatPanel` 发流时把 `settings` 放进请求体；后端 `resolveSettings()`：**请求体优先，缺项再用服务端 store / 上述 env**。Settings 弹窗**不会**自动 `PUT /api/settings`。

---

## Client path

```
用户点发送
  → ChatPanel.handleSend (web/src/components/ChatPanel.tsx)
  → streamChat(req, { signal, onEvent })   // web/src/lib/api.ts
       ├─ USE_BACKEND === false → streamMock()
       └─ USE_BACKEND === true  → streamFromBackend()
            POST /api/chat/stream
            Accept: text/event-stream
            body: ChatStreamRequest
  → 解析 SSE 行 `data: <json>\n\n`
  → onEvent(StreamEvent)
  → ChatPanel.applyEvent 更新 Zustand（status / 气泡 / handoff / activity）
```

`ChatStreamRequest`（契约 0.1.0）字段：`threadId`, `mode` (`bot` \| `group`), `targetId`, `content`, 可选 `mentionBotIds`, 可选 `settings`。

路由实现：`web/src/app/api/chat/stream/route.ts` → `sseResponseWithSignal` → `runChatStream`。

其它同源 REST（后端独占 `web/src/app/api/**`）：

| 方法 | 路径 |
|------|------|
| GET | `/api/health` |
| GET \| PUT | `/api/settings` |
| GET \| POST | `/api/bots` ；PATCH \| DELETE `/api/bots/:id` |
| GET \| POST | `/api/groups` ；PATCH \| DELETE `/api/groups/:id` |
| GET | `/api/threads` ；GET `/api/threads/:threadId/messages` ；DELETE `/api/threads/:threadId` |

当前 UI **主要**用 `streamChat` + 本地 Zustand。CRUD / `PUT /api/settings` 已实现，但设置页只写本地 store。客户端辅助函数 `fetchHealth()`（`web/src/lib/api.ts`）在 `USE_BACKEND` 为 false 时直接返回 `false`，不会打 health。

SSE 帧格式（契约）：

```
data: ${JSON.stringify(StreamEvent)}\n\n
```

`[DONE]` 会被客户端忽略（兼容部分上游习惯；本仓 orchestrator 发的是 JSON `done` 事件）。

---

## Event order

契约顺序（`contracts/api.ts`）：

```
status → speaker → token* → message_done → (handoff | activity) → done | error
```

含义：

1. **status** — Bot 状态（thinking / working / idle / …）与可选 `action` 文案。
2. **speaker** — 开始一个助手气泡（`botId` + `name`）。前端此时插入空 `assistant` 消息。
3. **token\*** — 0..n 个增量；`content` 是**片段**，前端 `appendToMessage`。
4. **message_done** — 该轮完整 `content` + `messageId`。前端用全文覆盖，避免拼漏。
5. **handoff** 和/或 **activity** — 交接卡片或「正在路由」活动条。可缺省。
6. **done** 或 **error** — 流结束。实现里 **error 之后通常仍跟一条 done**；客户端应对两种都幂等。

实现上的合法变体（仍属 0.1.0，不要为此改 CONTRACT_VERSION）：

- **单 Bot**：常出现两次 status（thinking → working）再 speaker；`message_done` 后还有 `status: done` / `status: idle`，最后 `done`。
- **群组**：后端会先发一条 **activity**（Routing to team），再对每位 speaker 重复 `status → speaker → token* → message_done`，中间可插 **handoff**。这与「activity 仅在 message_done 之后」的字面顺序不完全相同——**以「每个 speaker 块内部」遵守上表为准**；组级 activity 允许出现在第一位 speaker 之前。
- Mock 群组同样先 `activity`，再逐人说话。

`StreamEvent` 判别字段是 `type`。解析失败的 JSON 行应丢弃，不要把整条流标死。

---

## AbortSignal / Stop

期望（Cons / Test 按此验收）：

| 层 | 行为 |
|----|------|
| UI | 发送中输入框主按钮变为停止；`onStop` → `abortRef.current.abort()`（`ChatPanel`）。 |
| 客户端 fetch | `streamFromBackend` 把 `handlers.signal` 传给 `fetch`. 中止后 Promise 以 `AbortError` reject。 |
| 客户端 mock | `sleep` / `emitTokens` 听 `abort`；中止抛 `AbortError`。 |
| ChatPanel | `AbortError` **不**再插入「出错了」气泡；`finally` 里 `setSending(false)` 并把成员 status 拉回 idle。 |
| 服务端 | `sseResponseWithSignal` 把 `req.signal` 传给 `runChatStream`，再传到 LLM `fetch`。客户端断开应停止继续打模型。 |
| 服务端若赶在连接关掉前 catch 到 Abort | 可能发出 `{ type: "error", message: "Aborted" }` + `done`。客户端已 abort 时往往收不到，属预期。 |

不要在 abort 之后继续 `enqueue` 到已关闭的 SSE controller（`sseResponseWithSignal` 在 `req.signal.aborted` 时直接 return）。

---

## Contract source of truth vs runtime mirrors

**权威（结构拥有，改字段先改这里）：**

- `contracts/types.ts` — Bot / Group / Thread / ChatMessage / ApiSettings / persist key
- `contracts/api.ts` — `CONTRACT_VERSION`, `StreamEvent`, `ChatStreamRequest`, REST 形状, `HANDOFF_PATTERN`

**运行时镜像（Next 实际 import，路径别名 `@/` → `web/src/`）：**

- `web/src/lib/types.ts`
- `web/src/lib/contract.ts`

`web/` **没有**把根目录 `contracts/` 配进 `tsconfig`。前后端都 import `@/lib/contract` 与 `@/lib/types`，**不是** `../../contracts/...`。因此两套文件是**复制对齐**，不是单一模块。

| 只存在于镜像、不算契约变更 | 说明 |
|----------------------------|------|
| `USE_BACKEND` | 仅 `web/src/lib/contract.ts` |
| `AppState` | 仅 `web/src/lib/types.ts`（Zustand 聚合） |
| 更长的 endpoint 注释、`settings` 覆盖说明 | 文档性差异，保持 `CONTRACT_VERSION` 仍为 `0.1.0` |

### 同步规则

1. 改事件字段、REST body、版本号 → **先改 `contracts/*`**，再 **逐字段抄到** `web/src/lib/types.ts` / `contract.ts`。
2. 不要只改镜像。Cons 验收时 diff 这两对文件。
3. **禁止**在未发新契约时把 `CONTRACT_VERSION` 改成非 `0.1.0`。
4. 前端独占逻辑（mock、Zustand、`USE_BACKEND`）可以留在镜像；不要反向写进 `contracts/`。
5. `STORE_PERSIST_KEY`（`crew-bot-store-v1`）与契约绑定；改 key 等于破坏用户本地数据，需升契约版本（当前不要做）。

---

## Common failure modes

| 症状 | 原因 | 处理 |
|------|------|------|
| 开关为 true 但仍像 Mock | `.env.local` 不在 `web/`，或没重启，或写成 `True` / `1` | 必须是 `NEXT_PUBLIC_USE_BACKEND=true` 后重启 |
| health 404 / 连不上 | 没跑 Next，或端口不是 3000 | `cd web && npm run dev`；`curl localhost:3000/api/health` |
| health 200 但 `contractVersion` 不对 | 镜像与 `contracts/api.ts` 漂移 | 对齐 `CONTRACT_VERSION`（目标仍是 `0.1.0`） |
| 流开始后立刻 error / 说明缺 Key | `settings.apiKey` 与 `LLM_API_KEY` 都空 | Settings 保存 Key，或配 env |
| CORS | 用其它 origin 打 `/api`，或浏览器直连供应商 | 用同源 `/api/chat/stream`；LLM 只在 server `llm.ts` |
| SSE 半路没了 | Stop、刷新、HMR、代理超时 | 重发；生产注意反向代理 idle timeout |
| 气泡空白或乱序 | 先 token 后 speaker，或 `message_done` 对不上 `botId` | 必须先 `speaker` 再 `token`；`applyEvent` 靠 `streamingIds[botId]` |
| 停止后仍继续打模型 | `signal` 没传到 fetch / orchestrator | 查 `ChatPanel` → `streamChat` → `req.signal` → `llm.ts` |
| Settings 保存了但 `PUT /api/settings` 仍是空 | UI 只写 Zustand | 属当前产品；流请求会带 `settings`。不要为此改 CONTRACT_VERSION |

---

## Cons acceptance checklist

做衔接 / 契约验收时逐项打勾：

- [ ] `GET /api/health` 返回 `ok: true` 且 **`contractVersion` 为 `"0.1.0"`**（与 `contracts/api.ts` 的 `CONTRACT_VERSION` 一致）。
- [ ] `POST /api/chat/stream` 的 SSE 行能 `JSON.parse` 成 `StreamEvent`；未知 `type` 不崩 UI。
- [ ] 单 Bot 流可观察到：`status` → `speaker` → `token*` → `message_done` → `done`（中间可有额外 status）。
- [ ] 群组流可解析 `activity` / `handoff`，且每位说话者仍遵守 speaker → token → message_done。
- [ ] **Mock ↔ backend**：`.env.local` 去掉或设 `false` 后重启 = 无 Key 也能聊；设 `true` 后重启 = 请求打到 `/api/chat/stream`（Network 面板可见）。
- [ ] **Stop 取消 fetch**：发送中点停止，客户端出现 aborted fetch，不再追加 token；成员 status 回到 idle。
- [ ] `contracts/types.ts` ↔ `web/src/lib/types.ts`、`contracts/api.ts` ↔ `web/src/lib/contract.ts` 的共享字段无静默漂移（允许镜像多 `USE_BACKEND` / `AppState`）。

前端安装步骤与用户向故障排查见仓库根 [README.md](../README.md)。
