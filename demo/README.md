# Crew 演示包

给 **Test / Crea / 评审** 用：60–90 秒录完 **打开 → 发任务 → 看流式 token → 按停止**。要证明的是多智能体把活干完（路由、接力、可中止），不是堆概念。

| 文件 | 用途 |
|------|------|
| [STORYBOARD.md](STORYBOARD.md) | 四拍分镜 + 要点验收（含 **M-STOP**） |
| [SCRIPT.md](SCRIPT.md) | 对齐四拍的中文口播 |

## 怎么打开 UI（录屏前）

安装、端口、两种模式的逐步说明只看仓库根 [README.md](../README.md)，这里不重复。

录屏**默认 Mock**（零 Key）：

```bash
cd web
npm run dev
```

浏览器打开 **http://localhost:3000**。

你应该立刻看到：

- 左栏标题 **Crew**，副标题「多智能体协作工作台」；标题旁 **齿轮**（`aria-label="Settings"`）
- 花名册**置顶是 Nova**（针标 · Chief of Staff），下一行是群组 **Product Launch**（Nova / Rex / Mira / Kai），再往下 Rex · Mira · Kai
- 中间对话默认已打开 Product Launch；空状态大标题是群组名，输入框占位「给 Product Launch 布置任务，用 @ 点名…」

若浏览器里已有 `localStorage` 键 `crew-bot-store-v1`（以前玩过），花名册/默认对话可能不是种子状态。录屏前清该站点数据，或点对话顶栏垃圾桶「清空对话」。

## Mock vs 真实后端

同一套四拍，只换开关。`NEXT_PUBLIC_*` 启动时打进客户端，**改完必须重启** `npm run dev`。

| 模式 | `web/.env.local` | Key | 画面上怎么认 |
|------|------------------|-----|--------------|
| **Mock（优先录）** | 不设，或 `NEXT_PUBLIC_USE_BACKEND` 不是字符串 `true` | 不需要 | 回复里会出现「前端演示模式」；Network **没有** `POST /api/chat/stream` |
| **真实后端** | `NEXT_PUBLIC_USE_BACKEND=true` 后重启 | **需要** | Network 能看到 `POST /api/chat/stream`（`Accept: text/event-stream`）；左栏齿轮 → 弹窗「连接你的模型」填 Base URL / API Key / Model → **保存** |

接线与 SSE 顺序见 [docs/BRIDGE.md](../docs/BRIDGE.md)，不要改 `CONTRACT_VERSION`（保持 **0.1.0**）。

## 免责声明

- **真实后端要自备** OpenAI 兼容 Base URL + API Key（Settings 保存，或服务端 `LLM_API_KEY`）。没 Key 时后端仍回一段说明文字，**不会打模型**——那不是编排坏了。
- 录屏不要露出完整 Key。
- 本目录只是演示说明，不改编排、不改契约。
