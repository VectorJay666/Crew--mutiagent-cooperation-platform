"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { COLOR_MAP } from "@/lib/avatars";
import type { Bot, BotColor, BotStatus } from "@/lib/types";

export function BotAvatar({
  bot,
  size = 40,
  className,
}: {
  bot: Pick<Bot, "name" | "color" | "accessory" | "status" | "currentAction">;
  size?: number;
  /** Kept for callers; status lives in sidebar text, not as an avatar badge. */
  showStatus?: boolean;
  className?: string;
}) {
  const palette = COLOR_MAP[bot.color];
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
        }}
        animate={anim.face}
        transition={anim.transition}
      >
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
      </motion.div>
    </div>
  );
}

/** 2×2 member-color collage, circular clip, no frame / shadow / hairline seams. */
export function GroupCollage({
  bots,
  size = 40,
  className,
  title,
}: {
  bots: Pick<Bot, "color">[];
  size?: number;
  className?: string;
  title?: string;
}) {
  const tiles = collageTiles(bots);

  return (
    <div
      className={clsx("relative shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: COLOR_MAP[tiles[0]].cheek,
      }}
      title={title}
    >
      <div className="group-collage-grid">
        {tiles.map((color, i) => {
          const palette = COLOR_MAP[color];
          return (
            <div
              key={`${color}-${i}`}
              style={{
                background: `linear-gradient(160deg, ${palette.face} 0%, ${palette.cheek} 100%)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function collageTiles(bots: Pick<Bot, "color">[]): BotColor[] {
  const colors = bots.map((b) => b.color);
  if (colors.length === 0) return ["slate", "slate", "slate", "slate"];
  if (colors.length === 1) return [colors[0], colors[0], colors[0], colors[0]];
  if (colors.length === 2) return [colors[0], colors[1], colors[0], colors[1]];
  if (colors.length === 3) return [colors[0], colors[1], colors[2], colors[0]];
  return colors.slice(0, 4);
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
