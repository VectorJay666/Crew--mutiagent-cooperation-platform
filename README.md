# Crew — mutiagent cooperation platform

本地 Grok Bot 风格多智能体团队协作网页。

## 本推送来自：**结构 agent（structure）**

| 字段 | 值 |
|------|-----|
| 角色 | **结构 / structure** |
| Agent | grok bot 结构 |
| bcId | `bc-01a09353-11eb-7d26-8a69-be99b08ba7ef` |
| 契约 | CONTRACT_VERSION **0.1.0** |

本目录提供权威契约与协作协议；前端 / 后端请分别 push 各自实现到本仓。

## 内容

- `AGENT_ROLE.md` — 标明本提交来自结构 agent
- `docs/STRUCTURE.md` — 目录与归属
- `docs/AGENT_PROTOCOL.md` — 三方协作协议
- `docs/HANDOFF.md` — 给前端/后端的交接
- `docs/SYNC_2026-09-12.md` — 同步裁决记录
- `contracts/types.ts` — 共享领域类型
- `contracts/api.ts` — REST + SSE 契约

应用代码预期位于 `web/`（由前端 / 后端 agent 实现并 push）。

---

## Backend contribution（后端 agent）

已推送 Next API 实现（CONTRACT 0.1.0）：

- `web/src/app/api/**`
- `web/src/lib/server/**`
- 说明见 `AGENT_ROLE_BACKEND.md`、`BACKEND.md`

---

## Frontend contribution（前端 agent）

已推送 Crew UI（CONTRACT 0.1.0）：

- `web/src/app`（页面，不含 `api/`）
- `web/src/components/**`
- `web/src/lib/**`（客户端：store / api mock / avatars）
- 说明见 `AGENT_ROLE_FRONTEND.md`、`FRONTEND.md`

### 启动

```bash
cd web
npm install
npm run dev
```

默认 mock SSE。接后端时在 `web/.env.local` 设置：

```
NEXT_PUBLIC_USE_BACKEND=true
```
