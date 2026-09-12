import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coordinatorPrompt,
  isBroadcastIntent,
  parseHandoff,
  parseHandoffs,
} from "./prompts.ts";
import type { Bot, Group } from "./types.ts";

const bots: Bot[] = [
  {
    id: "bot_1",
    name: "Nova",
    title: "Chief of Staff",
    description: "Routes work",
    systemPrompt: "Coordinate.",
    color: "teal",
    accessory: 0,
    status: "idle",
    createdAt: 1,
  },
  {
    id: "bot_2",
    name: "Rex",
    title: "Engineer",
    description: "Builds",
    systemPrompt: "Engineer.",
    color: "sky",
    accessory: 1,
    status: "idle",
    createdAt: 2,
  },
];

const group: Group = {
  id: "group_1",
  name: "Product Launch",
  botIds: ["bot_1", "bot_2"],
  createdAt: 1,
};

describe("isBroadcastIntent", () => {
  it("detects 提醒全员 / 全员 / 所有人 / @everyone / remind everyone", () => {
    assert.equal(isBroadcastIntent("提醒全员：请同步进度"), true);
    assert.equal(isBroadcastIntent("请全员回复"), true);
    assert.equal(isBroadcastIntent("所有人看一下"), true);
    assert.equal(isBroadcastIntent("Hey @everyone status?"), true);
    assert.equal(isBroadcastIntent("Please REMIND EVERYONE to check in"), true);
    assert.equal(isBroadcastIntent("Nova please plan the launch"), false);
  });
});

describe("parseHandoffs", () => {
  it("returns every HANDOFF line in order, not only the first", () => {
    const hops = parseHandoffs(
      [
        "Nova here.",
        "HANDOFF: @Rex | please sketch the API",
        "HANDOFF: Mira | visual pass next",
        "Thanks.",
      ].join("\n")
    );
    assert.deepEqual(hops, [
      { targetName: "Rex", reason: "please sketch the API" },
      { targetName: "Mira", reason: "visual pass next" },
    ]);
  });

  it("parseHandoff remains a first-hop wrapper", () => {
    const first = parseHandoff(
      "HANDOFF: @Rex | a\nHANDOFF: @Mira | b"
    );
    assert.deepEqual(first, { targetName: "Rex", reason: "a" });
    assert.equal(parseHandoff("no hop here"), null);
  });
});

describe("coordinatorPrompt", () => {
  it("tells the model to include the full roster on an everyone-respond ask", () => {
    const prompt = coordinatorPrompt(bots, group);
    assert.match(prompt, /include ALL roster names/i);
    assert.match(prompt, /提醒全员/);
    assert.match(prompt, /@everyone/);
  });
});
