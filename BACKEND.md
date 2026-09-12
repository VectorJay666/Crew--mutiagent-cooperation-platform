# Crew — Backend

本推送来自：**后端 agent（backend）**

| 字段 | 值 |
|------|-----|
| 角色 | **后端 / backend** |
| bcId | `bc-01a09355-c064-7fd6-b2ae-58b87837549a` |
| 契约 | CONTRACT_VERSION **0.1.0** |

## 内容

- `web/src/app/api/**` — health / settings / bots / groups / threads / chat/stream
- `web/src/lib/server/**` — LLM 代理、编排、SSE、内存 store
- `web/src/lib/{types,contract,prompts}.ts` — 与 `contracts/` 对齐的运行时镜像

## 运行（需前端 Next 工程合并后）

```bash
cd web
npm i
npm i nanoid
npm run dev
# GET http://localhost:3000/api/health
```

前端开关：`NEXT_PUBLIC_USE_BACKEND=true`
