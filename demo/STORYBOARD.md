# 分镜：open → chat → stop（60–90s）

一条成片即可。优先 **Mock**（零 Key）；同一操作在真实后端复录一遍作为可选 B-roll。口播：[SCRIPT.md](SCRIPT.md)。开 UI：[README.md](README.md)。

建议提示词（复制，够长才能看清打字机再按停）：

```
给 Product Launch 拆一版上线清单：先对齐目标，再并行技术和首屏。
```

---

## Beat 1 · 打开（0:00–0:15）

| | |
|--|--|
| **操作** | 打开 http://localhost:3000。不要先点「新建 Bot / 新建群组」。 |
| **画面** | 左栏 **Crew** +「多智能体协作工作台」。花名册**置顶是 Nova**（针标 · Chief of Staff），接着是群组 **Product Launch**（Users 图标），再往下 **Rex** · Engineer、**Mira** · Designer、**Kai** · Researcher。中间对话默认已是 Product Launch（空状态大标题是群组名 +「像给同事发消息一样布置任务…」）。底栏输入框，右侧是 **纸飞机（发送）**。 |
| **证明** | 工作台已就位：花名册 + 群组对话，不是空白概念页。 |

## Beat 2 · 发任务（0:15–0:30）

| | |
|--|--|
| **操作** | 确认左栏高亮的是 **Product Launch**（不是单个 Bot）。点底栏输入框，粘贴上面那句，**Enter** 发送（不要 Shift+Enter）。 |
| **画面** | 用户气泡出现；发送钮立刻变成 **实心方块（停止）**。群组流会先出一条居中活动条：**Routing to team**（后面跟成员名）。侧栏对应 Bot 的副行会变成 `working` 文案（如 `Working on: …`）。 |
| **证明** | 一句话进团队，不是「先选模型再配工作流」。 |

## Beat 3 · 流式 token（0:30–1:00）

| | |
|--|--|
| **操作** | 手离开键盘，让字往外蹦 **至少 2–3 秒**。方块钮先别点。 |
| **画面** | 助手气泡按人出现（先 `speaker` 再 `token*`）：Nova / Rex / Mira 等会陆续打字。可能出现交接条：头像 A → 头像 B + 原因。Mock 回复是演示稿；真实后端是模型字。两种都是同一套 SSE：`status → speaker → token* → message_done → (handoff \| activity) → done`。 |
| **证明** | 协作在**出活**：路由、接力、增量字，不是一张架构图。 |

## Beat 4 · 停止 · M-STOP（1:00–1:20）

| | |
|--|--|
| **操作** | 字还在蹦时，点输入框右侧 **实心方块**。停住 2 秒，不要刷新、不要再发送。 |
| **画面 / 验收** | **M-STOP：停止之后气泡不再追加任何新 token。** 方块变回纸飞机；成员 status 回到 idle（侧栏不再显示 Working / Drafting）。**不要**出现「出错了：…」活动条——`AbortError` 被吃掉是预期。真实后端时，DevTools Network 里该次 `chat/stream` 为 canceled / aborted，服务端不应继续打模型。 |
| **证明** | 生成可控，停了就是停了。 |

片尾留 3–5 秒定格在停住的半句气泡上。总长目标 **约 75s**（最短 60，最长 90）。

---

## 可选：同一四拍切真实后端

只在有 Key 时录。`web/.env.local`：

```
NEXT_PUBLIC_USE_BACKEND=true
```

重启 `npm run dev`。点左栏标题旁 **齿轮** →「连接你的模型」→ 填 **API Key**（及需要时的 Base URL / Model）→ **保存**。再走 Beat 1–4。

认路：Network 出现 `POST /api/chat/stream`。没 Key 不要硬录「真模型」——后台只会回说明文字。

Mock ↔ 后端对照、Stop 如何 abort fetch：根 [README.md](../README.md) 的「两种模式 / 验证」和 [docs/BRIDGE.md](../docs/BRIDGE.md)（AbortSignal / Stop）。
