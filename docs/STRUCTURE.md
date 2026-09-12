# Crew — 项目结构契约（权威）

产品名：**Crew**。本地 Grok Bot 风格多智能体协作网页；用户自备 OpenAI 兼容 baseUrl + apiKey。

## 三角色

| Agent | 职责 |
|-------|------|
| **结构** | docs/、contracts/、目录与 API/SSE 契约 |
| **前端** | UI、Zustand、mock SSE |
| **后端** | Next API routes、LLM 代理、编排 |

## 技术栈

Next.js App Router + TS + Tailwind；Zustand；开关 `NEXT_PUBLIC_USE_BACKEND=true`。

## 目录

- `contracts/` 权威类型与 API
- `web/src/app/api/**` 后端独占
- `web/src/components/**` 前端独占

## SSE

status → speaker → token* → message_done → (handoff/activity) → done

前后端如何接线、env 开关、abort、契约镜像同步：见 [BRIDGE.md](BRIDGE.md)。

CONTRACT_VERSION **0.1.0**
