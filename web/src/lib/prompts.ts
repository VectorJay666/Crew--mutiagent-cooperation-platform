import type { Bot, ChatMessage, Group } from "./types";

export function botSystemPrompt(bot: Bot): string {
  return [
    `You are ${bot.name}, ${bot.title}.`,
    bot.description,
    bot.systemPrompt,
    "",
    "Communication style:",
    "- Talk like a capable teammate in a messaging app.",
    "- Be concrete. Prefer short paragraphs and checklists when useful.",
    "- If you need another specialist, end with a handoff line exactly like:",
    '  HANDOFF: @BotName | reason',
    "- Do not invent tools you do not have. You can reason, draft, plan, and coordinate.",
  ].join("\n");
}

export function coordinatorPrompt(bots: Bot[], group: Group): string {
  const roster = bots
    .filter((b) => group.botIds.includes(b.id))
    .map((b) => `- ${b.name} (${b.title}): ${b.description}`)
    .join("\n");

  return [
    "You are the routing brain for a multi-agent team chat.",
    "Given the latest user message and recent transcript, decide which bots should speak next.",
    "Rules:",
    "- Prefer 1-3 speakers.",
    "- If the user @mentions bots, include those bots first.",
    "- Include a coordinator/chief-of-staff first when the ask is broad.",
    "- Return ONLY valid JSON: {\"speakers\":[\"Exact Bot Name\"],\"plan\":\"one short sentence\"}",
    "",
    "Team roster:",
    roster,
  ].join("\n");
}

export function groupBotPrompt(bot: Bot, teammates: Bot[]): string {
  const others = teammates
    .filter((t) => t.id !== bot.id)
    .map((t) => `- ${t.name} (${t.title})`)
    .join("\n");

  return [
    botSystemPrompt(bot),
    "",
    "You are in a group chat with teammates:",
    others || "- (solo)",
    "",
    "You can see shared context. Do your part; hand off when another role should continue.",
    "When you hand off, use: HANDOFF: @BotName | reason",
  ].join("\n");
}

export function transcriptForModel(
  messages: ChatMessage[],
  botsById: Record<string, Bot>,
  limit = 24
): { role: "user" | "assistant" | "system"; content: string }[] {
  const sliced = messages.filter((m) => m.kind !== "activity").slice(-limit);
  return sliced.map((m) => {
    if (m.kind === "user") return { role: "user" as const, content: m.content };
    if (m.kind === "handoff") {
      const from = m.meta?.fromBotId ? botsById[m.meta.fromBotId]?.name : "Bot";
      const to = m.meta?.toBotId ? botsById[m.meta.toBotId]?.name : "Bot";
      return {
        role: "assistant" as const,
        content: `[Handoff] ${from} → ${to}: ${m.content}`,
      };
    }
    const name = m.botId ? botsById[m.botId]?.name ?? "Bot" : "Bot";
    return {
      role: "assistant" as const,
      content: `${name}: ${m.content}`,
    };
  });
}

export function parseHandoff(content: string): { targetName: string; reason: string } | null {
  const match = content.match(/HANDOFF:\s*@?([^\n|]+)\|\s*(.+)/i);
  if (!match) return null;
  return {
    targetName: match[1].trim().replace(/^@/, ""),
    reason: match[2].trim(),
  };
}

export function extractMentions(text: string, bots: Bot[]): Bot[] {
  const found: Bot[] = [];
  for (const bot of bots) {
    const re = new RegExp(`@${bot.name}\\b`, "i");
    if (re.test(text)) found.push(bot);
  }
  return found;
}
