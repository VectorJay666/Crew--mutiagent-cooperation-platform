import type { BotColor } from "./types";

export const COLOR_MAP: Record<
  BotColor,
  { face: string; cheek: string; eye: string; glow: string; soft: string }
> = {
  teal: {
    face: "#1FA97A",
    cheek: "#148A62",
    eye: "#083528",
    glow: "rgba(31,169,122,0.35)",
    soft: "#E7F7F0",
  },
  amber: {
    face: "#E8A317",
    cheek: "#C8870C",
    eye: "#3A2800",
    glow: "rgba(232,163,23,0.35)",
    soft: "#FFF6E5",
  },
  rose: {
    face: "#E56B7A",
    cheek: "#C94F5E",
    eye: "#3A1016",
    glow: "rgba(229,107,122,0.35)",
    soft: "#FDECEF",
  },
  sky: {
    face: "#3BA3D9",
    cheek: "#2A86B8",
    eye: "#0B2A3A",
    glow: "rgba(59,163,217,0.35)",
    soft: "#E8F5FC",
  },
  violet: {
    face: "#8B7CF6",
    cheek: "#6F5FE0",
    eye: "#1E1848",
    glow: "rgba(139,124,246,0.35)",
    soft: "#F0EDFE",
  },
  lime: {
    face: "#8FBF3A",
    cheek: "#739E28",
    eye: "#24300A",
    glow: "rgba(143,191,58,0.35)",
    soft: "#F3F9E6",
  },
  coral: {
    face: "#F07A4A",
    cheek: "#D45F31",
    eye: "#3A180C",
    glow: "rgba(240,122,74,0.35)",
    soft: "#FEF0E9",
  },
  slate: {
    face: "#6B7785",
    cheek: "#55606C",
    eye: "#1A2027",
    glow: "rgba(107,119,133,0.35)",
    soft: "#EEF1F4",
  },
};

export const BOT_COLORS: BotColor[] = [
  "teal",
  "amber",
  "rose",
  "sky",
  "violet",
  "lime",
  "coral",
  "slate",
];

export { DEFAULT_BOTS } from "./seed";
