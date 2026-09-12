# Crew acceptance C-MULTI-01 (CONTRACT_VERSION 0.1.0)

Primary deliverable for **Vector** (终审). Product contracts were **not** changed.  
Live run on a Cursor Cloud VM after **PR #9** (`21a1237` — coordinator observability + broadcast all + multi-handoff queue).

**Status:** IN PROGRESS — marks will be filled after live run.

## Verdict

| id | mark |
|----|------|
| C-MULTI-01 Broadcast | PENDING |
| C-MULTI-01 Coordinator failure observable | PENDING |
| C-MULTI-01 Multi-handoff | PENDING |
| C-MULTI-01 Stream 200 + Stop freeze | PENDING |

`CONTRACT_VERSION` remains **0.1.0**. API keys were used only in gitignored `.env.local` / Settings and are redacted here as `sk-…FKAA`.

---

## Environment

| Item | Value |
|------|--------|
| Host | Cursor Cloud VM |
| Repo base | `origin/main` @ `21a1237` (PR #9 merged) |
| App | `web/` Next.js, `NEXT_PUBLIC_USE_BACKEND=true`, `npm run dev` → http://localhost:3000 |
| LLM Base URL | `https://litellm.topviewclub.cn/v1` |
| LLM Model | `DeepSeek-V4-Flash-Vision-Exp` |
| LLM Key | `sk-…FKAA` (never committed) |
| CONTRACT_VERSION | **0.1.0** (unchanged) |

## Results

| id | mark | evidence | repro steps |
|----|------|----------|-------------|
| C-MULTI-01 Broadcast | PENDING | TBD | Product Launch → message meaning 提醒全员 / ask everyone to reply. Expect ≥2–3 distinct member bots with assistant bubbles (not only Nova). |
| C-MULTI-01 Coordinator failure | PENDING | TBD | Force bad model once or capture natural fail; activity/detail/log must show failure reason, not silent heuristic-only. |
| C-MULTI-01 Multi-handoff | PENDING | TBD | More than one hop when content requests it, or SKIP with code evidence from PR #9 queue. |
| C-MULTI-01 Stream + Stop | PENDING | TBD | `POST /api/chat/stream` HTTP 200; Stop mid-stream freezes ≥3s. |
