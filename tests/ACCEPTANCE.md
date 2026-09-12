# Crew acceptance test report (CONTRACT_VERSION 0.1.0)

Primary deliverable for **Vector** (终审). Product contracts were **not** changed.  
This file is the written record of live runs on a Cursor Cloud VM. The same table is in the PR body.

## Environment

| Item | Value |
|------|--------|
| Host | Cursor Cloud VM only (not a user machine) |
| OS | Ubuntu 24.04.4 LTS (Noble), Linux 6.12.94+ x86_64 |
| Node | **v22.14.0** (≥ 20.9 required by README / Next.js 16) |
| npm | 10.9.7 |
| Chrome | `/usr/local/bin/google-chrome` available |
| Repo / SHA | `main` at `599e1c2` (PR #1 README/BRIDGE + PR #2 demo storyboard merged) + this report |
| App | `web/` Next.js 16.3.5 (`npm run dev` → `http://localhost:3000`) |
| LLM key | **Not present** (`LLM_API_KEY` / Settings key unset) |
| CONTRACT_VERSION | **0.1.0** (unchanged in `contracts/api.ts` and `web/src/lib/contract.ts`) |

## Method

| Case | How verified |
|------|----------------|
| C-INSTALL-01 | **Live-run**: `cd web && npm install` then `npm run dev`; `curl` homepage |
| C-MOCK-01 | **Live-run**: browser UI + client mock SSE (`streamMock`) |
| C-STOP-01 | **Live-run**: browser Stop click; plus code-trace Stop → `AbortController` |
| C-HEALTH-01 | **Live-run**: restart with `NEXT_PUBLIC_USE_BACKEND=true`; `curl /api/health`; POST `/api/chat/stream` without key. Real-model chat **SKIP** |
| C-DEMO-01 | **Live-run**: UI labels vs `demo/STORYBOARD.md` + `demo/SCRIPT.md`; walk open → chat → stop |

Marks: **PASS** / **FAIL** / **SILENT_FAIL** / **SKIP**.

---

## Results

| id | mark | evidence | repro steps |
|----|------|----------|-------------|
| C-INSTALL-01 | _pending live UI_ | See below after browser pass | README: Node ≥ 20.9; `cd web && npm install`; `npm run dev`; open http://localhost:3000 |
| C-MOCK-01 | _pending_ | | Default mock (`NEXT_PUBLIC_USE_BACKEND` not `true`); pick bot/group; send; streaming reply |
| C-STOP-01 | _pending_ | | While streaming, click Stop (send becomes square); no new tokens within 3s |
| C-HEALTH-01 | _pending_ | | `NEXT_PUBLIC_USE_BACKEND=true`, restart, `curl localhost:3000/api/health`; missing key must not hang |
| C-DEMO-01 | _pending_ | | Cross-check storyboard/script labels; ~75s open→chat→stop path exists |

---

## Notes

- Do not bump `CONTRACT_VERSION`.
- README was not rewritten (install path worked as documented).
- Draft written before browser verification; this file is updated after live UI runs.
