"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { COLOR_MAP } from "@/lib/avatars";
import type { Bot, BotStatus } from "@/lib/types";

const ACCESSORIES = ["✦", "◆", "◎", "▴", "◌", "✚"];

export function BotAvatar({
  bot,
  size = 40,
  showStatus = true,
  className,
}: {
  bot: Pick<Bot, "name" | "color" | "accessory" | "status" | "currentAction">;
  size?: number;
  showStatus?: boolean;
  className?: string;
}) {
  const palette = COLOR_MAP[bot.color];
  const accessory = ACCESSORIES[bot.accessory % ACCESSORIES.length];
  const anim = statusAnim(bot.status);

  return (
    <div
      className={clsx("relative shrink-0", className)}
      style={{ width: size, height: size }}
      title={bot.currentAction || bot.name}
    >
      <motion.div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 28%, ${palette.face}, ${palette.cheek})`,
          boxShadow: bot.status === "working" || bot.status === "thinking"
            ? `0 0 0 3px ${palette.glow}`
            : undefined,
        }}
        animate={anim.face}
        transition={anim.transition}
      >
        {/* eyes */}
        <motion.div
          className="absolute left-[28%] top-[38%] h-[18%] w-[14%] rounded-full"
          style={{ background: palette.eye }}
          animate={anim.eyes}
        />
        <motion.div
          className="absolute right-[28%] top-[38%] h-[18%] w-[14%] rounded-full"
          style={{ background: palette.eye }}
          animate={anim.eyes}
        />
        {/* accessory */}
        <div
          className="absolute right-[6%] top-[8%] text-[10px] leading-none opacity-90"
          style={{ fontSize: Math.max(9, size * 0.22), color: palette.eye }}
        >
          {accessory}
        </div>
      </motion.div>

      {showStatus && bot.status !== "idle" && (
        <span
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)]",
            statusDot(bot.status)
          )}
        />
      )}
    </div>
  );
}

function statusDot(status: BotStatus) {
  switch (status) {
    case "working":
    case "thinking":
      return "bg-[var(--accent)] animate-pulse";
    case "waiting":
      return "bg-[var(--warn)]";
    case "blocked":
      return "bg-[var(--danger)]";
    case "done":
      return "bg-[var(--accent)]";
    default:
      return "bg-[var(--muted)]";
  }
}

function statusAnim(status: BotStatus) {
  if (status === "thinking") {
    return {
      face: { y: [0, -1, 0], scale: [1, 1.02, 1] },
      eyes: { scaleY: [1, 0.2, 1] },
      transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const },
    };
  }
  if (status === "working") {
    return {
      face: { rotate: [-2, 2, -2] },
      eyes: { x: [-1, 1, -1] },
      transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" as const },
    };
  }
  if (status === "waiting" || status === "blocked") {
    return {
      face: { y: [0, 1, 0] },
      eyes: { scaleY: 0.55 },
      transition: { duration: 2, repeat: Infinity },
    };
  }
  if (status === "done") {
    return {
      face: { scale: [1, 1.06, 1] },
      eyes: { scaleY: 1 },
      transition: { duration: 0.5 },
    };
  }
  return {
    face: { y: 0, rotate: 0, scale: 1 },
    eyes: { scaleY: 1, x: 0 },
    transition: { duration: 0.3 },
  };
}
