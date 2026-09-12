import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { LlmError } from "./llm.ts";
import {
  describeCoordinatorFailure,
  maxGroupTurns,
  pickSpeakers,
  runChatStream,
} from "./orchestrator.ts";
import { store } from "./store-io.ts";
import type { ApiSettings, Bot, Group } from "../types.ts";
import type { StreamEvent } from "../contract.ts";

const settings: ApiSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.7,
};

const members: Bot[] = store.listBots();
const group = store.getGroup("group_1") as Group;

function names(bots: Bot[]) {
  return bots.map((b) => b.name);
}

describe("describeCoordinatorFailure", () => {
  it("includes HTTP status and redacts API keys", () => {
    const key = "sk-secretTESTKEY999";
    const err = new LlmError(`LLM error (401): invalid key ${key}`, 401);
    const detail = describeCoordinatorFailure(err, key);
    assert.match(detail, /HTTP 401/);
    assert.doesNotMatch(detail, /sk-secretTESTKEY999/);
    assert.match(detail, /\[redacted\]/);
  });

  it("labels JSON parse failures", () => {
    assert.equal(
      describeCoordinatorFailure(new SyntaxError("Unexpected token")),
      "invalid JSON"
    );
  });
});

describe("maxGroupTurns", () => {
  it("caps at max(8, members * 2)", () => {
    assert.equal(maxGroupTurns(2), 8);
    assert.equal(maxGroupTurns(4), 8);
    assert.equal(maxGroupTurns(5), 10);
  });
});

describe("pickSpeakers", () => {
  it("broadcasts to all members for 提醒全员 when there are no @mentions", async () => {
    const { speakers, plan } = await pickSpeakers(
      members,
      group,
      "提醒全员：请同步各自进度",
      undefined,
      settings,
      []
    );
    assert.equal(plan, "Broadcast: all members");
    assert.deepEqual(names(speakers).sort(), ["Kai", "Mira", "Nova", "Rex"]);
  });

  it("lets explicit @mentions override broadcast", async () => {
    const { speakers, plan } = await pickSpeakers(
      members,
      group,
      "提醒全员 @Nova 你先总结",
      undefined,
      settings,
      []
    );
    assert.match(plan, /Honoring mentions/);
    assert.deepEqual(names(speakers), ["Nova"]);
  });

  it("lets mentionBotIds override broadcast", async () => {
    const rex = members.find((m) => m.name === "Rex")!;
    const { speakers, plan } = await pickSpeakers(
      members,
      group,
      "提醒全员",
      [rex.id],
      settings,
      []
    );
    assert.match(plan, /Honoring mentions/);
    assert.deepEqual(names(speakers), ["Rex"]);
  });

  it("soft-fails coordinator HTTP errors with an observable plan", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("nope, bad token sk-LEAKEDKEY123456", {
        status: 401,
        statusText: "Unauthorized",
      })) as typeof fetch;
    try {
      const { speakers, plan } = await pickSpeakers(
        members,
        group,
        "帮我排一下这周计划",
        undefined,
        { ...settings, apiKey: "sk-TESTKEYVALUE99" },
        []
      );
      assert.match(plan, /Coordinator failed \(HTTP 401/);
      assert.match(plan, /heuristic:/);
      assert.doesNotMatch(plan, /sk-TESTKEYVALUE99/);
      assert.doesNotMatch(plan, /sk-LEAKEDKEY123456/);
      assert.ok(speakers.length >= 1);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("soft-fails invalid coordinator JSON with an observable plan", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "not-json-at-all" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
    try {
      const { plan } = await pickSpeakers(
        members,
        group,
        "帮我排一下这周计划",
        undefined,
        { ...settings, apiKey: "sk-TESTKEYVALUE99" },
        []
      );
      assert.match(plan, /Coordinator failed \(invalid JSON\)/);
      assert.match(plan, /heuristic:/);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("soft-fails empty speaker lists with heuristic detail", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            { message: { content: '{"speakers":[],"plan":""}' } },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )) as typeof fetch;
    try {
      const { speakers, plan } = await pickSpeakers(
        members,
        group,
        "帮我排一下这周计划",
        undefined,
        { ...settings, apiKey: "sk-TESTKEYVALUE99" },
        []
      );
      assert.match(plan, /Coordinator failed \(empty speakers\)/);
      assert.match(plan, /heuristic:/);
      assert.ok(speakers.length >= 1);
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe("runChatStream group orchestration", () => {
  afterEach(() => {
    store.setSettings({ apiKey: "" });
  });

  it("emits activity detail and multiple speakers for 提醒全员", async () => {
    const events: StreamEvent[] = [];
    await runChatStream(
      {
        threadId: "thread_group_1",
        mode: "group",
        targetId: "group_1",
        content: "提醒全员：请各自同步进度",
        settings,
      },
      (e) => events.push(e)
    );

    const activity = events.find((e) => e.type === "activity");
    assert.ok(activity && activity.type === "activity");
    assert.equal(activity.detail, "Broadcast: all members");
    assert.equal(activity.botIds?.length, 4);

    const speakerNames = events
      .filter((e) => e.type === "speaker")
      .map((e) => (e.type === "speaker" ? e.name : ""));
    assert.deepEqual(new Set(speakerNames), new Set(["Nova", "Rex", "Mira", "Kai"]));
    assert.equal(speakerNames.length, 4);
    assert.equal(events.at(-1)?.type, "done");
  });

  it("walks a multi-handoff queue, including hops from handoff replies", async () => {
    const orig = globalThis.fetch;
    const replies: Record<string, string> = {
      Nova: [
        "Nova coordinating.",
        "HANDOFF: @Rex | sketch the API",
        "HANDOFF: @Mira | visual structure",
      ].join("\n"),
      Rex: [
        "Rex on API.",
        "HANDOFF: @Kai | check risks",
      ].join("\n"),
      Mira: "Mira on UI.",
      Kai: "Kai on risks.",
    };

    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        stream?: boolean;
        messages?: { role: string; content: string }[];
      };
      if (!body.stream) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: '{"speakers":["Nova"],"plan":"Nova first"}',
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      const system = body.messages?.[0]?.content ?? "";
      const who =
        /You are (Nova|Rex|Mira|Kai),/.exec(system)?.[1] ?? "Nova";
      const text = replies[who] ?? `${who} reply`;
      const sse = `data: ${JSON.stringify({
        choices: [{ delta: { content: text } }],
      })}\n\ndata: [DONE]\n\n`;
      return new Response(sse, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as typeof fetch;

    try {
      const events: StreamEvent[] = [];
      await runChatStream(
        {
          threadId: "thread_group_1",
          mode: "group",
          targetId: "group_1",
          content: "开始产品发布",
          settings: {
            ...settings,
            apiKey: "sk-TESTKEYVALUE99",
          },
        },
        (e) => events.push(e)
      );

      const speakerNames = events
        .filter((e) => e.type === "speaker")
        .map((e) => (e.type === "speaker" ? e.name : ""));
      assert.deepEqual(speakerNames, ["Nova", "Rex", "Mira", "Kai"]);

      const hops = events.filter((e) => e.type === "handoff");
      assert.equal(hops.length, 3);
      assert.deepEqual(
        hops.map((h) =>
          h.type === "handoff" ? `${h.fromBotId}->${h.toBotId}` : ""
        ),
        ["bot_1->bot_2", "bot_1->bot_3", "bot_2->bot_4"]
      );
      assert.equal(events.at(-1)?.type, "done");
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("keeps single-bot mode as a one-speaker stream", async () => {
    const events: StreamEvent[] = [];
    await runChatStream(
      {
        threadId: "thread_bot_1",
        mode: "bot",
        targetId: "bot_1",
        content: "你好",
        settings,
      },
      (e) => events.push(e)
    );
    const speakers = events.filter((e) => e.type === "speaker");
    assert.equal(speakers.length, 1);
    assert.equal(speakers[0] && speakers[0].type === "speaker" && speakers[0].name, "Nova");
    assert.ok(events.some((e) => e.type === "message_done"));
    assert.equal(events.at(-1)?.type, "done");
    assert.ok(!events.some((e) => e.type === "handoff"));
    assert.ok(!events.some((e) => e.type === "activity"));
  });

  it("stops the work queue when AbortSignal fires", async () => {
    const ac = new AbortController();
    const events: StreamEvent[] = [];
    await runChatStream(
      {
        threadId: "thread_group_1",
        mode: "group",
        targetId: "group_1",
        content: "提醒全员：停一下",
        settings,
      },
      (e) => {
        events.push(e);
        if (e.type === "message_done") ac.abort();
      },
      ac.signal
    );
    const speakers = events.filter((e) => e.type === "speaker");
    assert.equal(speakers.length, 1);
    assert.ok(events.some((e) => e.type === "error"));
    assert.equal(events.at(-1)?.type, "done");
  });
});
