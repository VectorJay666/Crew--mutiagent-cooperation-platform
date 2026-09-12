# Crew — 前端对接说明

权威契约已迁移到仓库根目录：

- [`docs/STRUCTURE.md`](../docs/STRUCTURE.md)
- [`docs/AGENT_PROTOCOL.md`](../docs/AGENT_PROTOCOL.md)
- [`docs/HANDOFF.md`](../docs/HANDOFF.md)
- [`contracts/types.ts`](../contracts/types.ts)
- [`contracts/api.ts`](../contracts/api.ts)

前端镜像：`src/lib/types.ts`、`src/lib/contract.ts`（与 contracts 保持一致；`USE_BACKEND` 为前端开关）。

## 前端职责

- UI：花名册 / 群组 / ChatPanel / Settings / AppShell
- 本地 Zustand（persist: `crew-bot-store-v2`）
- 客户端 `src/lib/api.ts`（mock SSE 或请求后端）
- **不实现** `src/app/api/**`（后端独占）

## 启动

```bash
cd web
npm install
npm run dev
```

## 对接开关

`.env.local`:

```
NEXT_PUBLIC_USE_BACKEND=true
```

为 `true` 时请求 `POST /api/chat/stream`（由后端实现）。

## @结构

契约字段 / 路径 / SSE 事件变更请找结构 agent（`bc-01a09353-11eb-7d26-8a69-be99b08ba7ef`）发版后再改实现。
