export const palette = {
  fg: "#E8E6E3",
  fgDim: "#A09EA2",
  muted: "#6B6A6E",
  faint: "#3C3A42",
  accent: "#FF8FB1",
  accentDeep: "#E96A91",
  ok: "#7EC391",
  warn: "#E9B464",
  bad: "#E96A91",
} as const;

export const symbols = {
  prompt: "›",
  diamond: "◇",
  dot: "·",
  arrow: "→",
} as const;

export type PaletteKey = keyof typeof palette;
