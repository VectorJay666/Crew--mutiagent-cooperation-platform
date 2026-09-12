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
