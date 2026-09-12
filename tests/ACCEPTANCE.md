# Crew acceptance test report (CONTRACT_VERSION 0.1.0)

Primary deliverable for **Vector** (终审). Product contracts were **not** changed.  
Written record of live runs on a Cursor Cloud VM (2026-09-12). Same table is in PR #4.

## Verdict

| id | mark |
|----|------|
| C-INSTALL-01 | **PASS** |
| C-MOCK-01 | **PASS** |
| C-STOP-01 | **PASS** (not SILENT_FAIL) |
| C-HEALTH-01 | **PASS** (health + missing-key explicit; real-model chat **SKIP**) |
| C-DEMO-01 | **PASS** |

No install blocker. README was not rewritten. `CONTRACT_VERSION` remains **0.1.0** in `contracts/api.ts` and `web/src/lib/contract.ts`.

---

## Environment

| Item | Value |
|------|--------|
| Host | Cursor Cloud VM only (not a user machine) |
| OS | Ubuntu 24.04.4 LTS (Noble), Linux 6.12.94+ x86_64 |
| Node | **v22.14.0** (README / Next.js 16 require ≥ 20.9) |
| npm | 10.9.7 |
| Browser | `/usr/local/bin/google-chrome` + Playwright (`playwright-core` against that binary) |
| Repo base | `origin/main` @ `599e1c2` (PR #1 README/BRIDGE + PR #2 demo storyboard merged) |
| App | `web/` Next.js 16.3.5, `npm run dev` → http://localhost:3000 |
| LLM key | **Unset** (`LLM_API_KEY` / Settings `apiKey` empty) |
| CONTRACT_VERSION | **0.1.0** (unchanged) |

## Method (live-run vs code-review)

| Case | How verified |
|------|----------------|
| C-INSTALL-01 | **Live-run**: `cd web && npm install` (345 packages, 0 vulns); `npm run dev`; `curl` homepage HTTP 200 |
| C-MOCK-01 | **Live-run**: Playwright + Chrome GUI. Default mock (`NEXT_PUBLIC_USE_BACKEND` not `true`). No `POST /api/chat/stream` |
| C-STOP-01 | **Live-run**: Playwright measured `innerText` length for 3s after Stop (frozen at 487). Chrome GUI + recording. **Code-trace** Stop → `AbortController` (supporting, not the only evidence) |
| C-HEALTH-01 | **Live-run**: wrote `web/.env.local` `NEXT_PUBLIC_USE_BACKEND=true` (gitignored), restarted `npm run dev` (log: `Environments: .env.local`); `curl /api/health`; `POST /api/chat/stream` without key; Playwright UI. Real-model chat **SKIP** |
| C-DEMO-01 | **Live-run**: DOM `innerText` vs `demo/STORYBOARD.md` + `demo/SCRIPT.md` + `demo/README.md`; 4-beat path executed |

---

## Results

| id | mark | evidence | repro steps |
|----|------|----------|-------------|
| C-INSTALL-01 | **PASS** | Node v22.14.0. Fresh `cd web && npm install` succeeded in ~6s. `npm run dev` → Next.js 16.3.5 Ready in 241ms on port 3000. `curl http://localhost:3000/` → **HTTP 200**, HTML `lang="zh-CN"`, title later confirmed `Crew — 多智能体协作`. No README factual install blocker. | 1. Node ≥ 20.9. 2. `cd web && npm install`. 3. `npm run dev`. 4. Open http://localhost:3000. |
| C-MOCK-01 | **PASS** | Playwright (headless Chrome) on default mock: selected **Product Launch**, Enter-sent storyboard prompt. Send icon became **Square** (`hasSquare: true`). Text length grew 245 → 482 over ~2.8s (typewriter). UI showed **Routing to team · Nova · Rex · Mira**, Nova/Rex/Mira bubbles, handoff Nova→Mira, 「前端演示模式」/「演示模式」. Network: **no** `/api/*` requests (`postedChatStream: false`). Chrome GUI walk + 13s recording reproduced the same path. | 1. Do not set `NEXT_PUBLIC_USE_BACKEND=true`. 2. `npm run dev`. 3. Select Product Launch (default). 4. Send a message. 5. Expect streaming mock tokens, not `POST /api/chat/stream`. |
| C-STOP-01 | **PASS** | While Mira was mid-bubble (`界面压成「花名册 + 对话 +`), clicked Square. Ten samples over **3020 ms** after Stop: length stayed **487** (`grewAfterStop: false`). Paper-plane returned (`sendBack: true`). No 「出错了」 (`hasErrorActivity: false`). GUI recording: Stop at ~00:11 while Mira still typing; stream aborted; no new tokens. **Not SILENT_FAIL** (surface stopped *and* appending stopped). Code-trace: `MessageInput` Square → `ChatPanel.onStop` → `abortRef.abort()` → `streamMock` `sleep`/`emitTokens` reject `AbortError`; `ChatPanel` swallows `AbortError`. | 1. In mock, send a long prompt. 2. After 2–3s of tokens, click the Square. 3. Wait ≥ 3s without refresh. 4. Pass = no new tokens; fail-silent = button idle but text still grows. |
| C-HEALTH-01 | **PASS** (real chat **SKIP**) | After restart with `NEXT_PUBLIC_USE_BACKEND=true`: `GET /api/health` → `{"ok":true,"version":"0.1.0","contractVersion":"0.1.0"}`. `POST /api/chat/stream` (empty `apiKey`) completed immediately with SSE `token` text **「后端已收到请求，但尚未配置 API Key」** + `LLM_API_KEY` hint, then `message_done` + `done` (no hang). Playwright UI: `POST /api/chat/stream` (`Accept: text/event-stream`) in **86 ms**; same missing-key copy; no 「出错了」. No LLM key on this VM → **SKIP** real-model chat (per case). | 1. `web/.env.local`: `NEXT_PUBLIC_USE_BACKEND=true`. 2. Restart `npm run dev`. 3. `curl http://localhost:3000/api/health`. 4. Without a key, send a message or `POST /api/chat/stream`; expect explicit missing-key copy, not a hang. 5. Skip live model chat if no key. |
| C-DEMO-01 | **PASS** | Seed first screen DOM (cleared `crew-bot-store-v1`) matches storyboard/script labels (see below). Four-beat path **open → chat → stop** exists and was executed (~10s product path; storyboard’s ~75s is voiceover pacing, not a latency gate). | 1. Clear `localStorage` key `crew-bot-store-v1` if needed. 2. Open http://localhost:3000 (do not click 新建). 3. Confirm Product Launch empty hero. 4. Paste storyboard prompt, Enter. 5. Watch stream ≥ 2–3s. 6. Click Square. |

---

## C-DEMO-01 label cross-check

DOM `innerText` / attributes after seed hydration (Playwright):

| Storyboard / demo README | Actual UI | Match |
|--------------------------|-----------|-------|
| Title **Crew** +「多智能体协作工作台」 | Exact | yes |
| Gear `aria-label="Settings"` | Present | yes |
| Roster top **Nova** pin + Chief of Staff | `Nova` / `Chief of Staff` / pin | yes |
| Next **Product Launch** + Users icon | Group row + Users icon; default selected | yes |
| Then **Rex** Engineer, **Mira** Designer, **Kai** Researcher | Exact order | yes |
| Empty hero title = group name | `h1` / hero **Product Launch** | yes |
| Empty subtitle starts with「像给同事发消息一样布置任务」 | `像给同事发消息一样布置任务。用 @ 点名，或让协调者自动路由。` | yes (storyboard uses ellipsis; full sentence is longer) |
| Placeholder「给 Product Launch 布置任务，用 @ 点名…」 | Exact | yes |
| Paper-plane send | `lucide-send-horizontal`; becomes Square while sending | yes |
| Header group line | `4 位队友 · 可见交接与并行协作` + `Group` | extra copy vs storyboard; not a blocker |
| Empty roster preview | `还没有消息` | demo README only; OK |
| Beat 2 **Routing to team** | Centered activity `Routing to team · Nova · Rex · Mira` | yes |
| Beat 4 Stop, no 「出错了」 | Confirmed | yes |
| Settings title「连接你的模型」+ Base URL / API Key / Model / Temperature / **保存** | Exact | yes |

`demo/SCRIPT.md` four beats (打开 / 发任务 / 流式 / 停止) map 1:1 onto that path.

---

## C-STOP-01 code-trace (supporting)

Executed in UI; this is the wiring that the live abort used:

1. `web/src/components/MessageInput.tsx` — `sending` renders `<Square>` `onClick={onStop}`.
2. `web/src/components/ChatPanel.tsx` — `abortRef = new AbortController()`; `onStop={() => abortRef.current?.abort()}`; `streamChat(..., { signal })`; `AbortError` does not insert 「出错了」; `finally` sets `sending=false` and members `idle`.
3. `web/src/lib/api.ts` — mock `sleep` / `emitTokens` listen for `signal.abort` and throw `AbortError`.

Backend abort path (`fetch` signal → `sseResponseWithSignal` → `runChatStream`) was **code-reviewed**, not live-aborted against a long LLM stream (no key; missing-key payload finishes in &lt;100 ms).

---

## Notes / non-blockers

- Health is served by Next even in mock mode (`GET /api/health` was 200 before the backend switch too). C-HEALTH-01 was still re-run after `NEXT_PUBLIC_USE_BACKEND=true` + restart as specified.
- Missing key is an **explicit assistant message**, not an SSE `{ type: "error" }`. That matches README/BRIDGE (“空 Key 时后端仍会回一段说明文字”). Does not hang.
- Settings footer still says「前端演示模式…」even when the backend switch is on (copy leftover; does not affect stream routing — Network showed `POST /api/chat/stream`).
- `.env.local` used for the backend switch is gitignored and was **not** committed.
- Playwright scripts lived under `/tmp/crew-accept/` (not in repo).

## Out of scope

- No `CONTRACT_VERSION` bump.
- No README rewrite.
- No orchestrator / SSE / mock behavior changes.
