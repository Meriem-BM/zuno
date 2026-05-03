// Pure layout math for the architecture diagram. No JSX, no React.
// Box centres + edge accessors are derived once and consumed by Diagram.

export const W = 820;
export const H = 380;

export const BOX_W = 138;
export const BOX_H = 72;

const TOP_Y = 110;
const ARB_Y = 270;
const STEP_X = 170;

// Four boxes evenly spaced, centred inside the viewBox. Box content span
// is 3 × stepX + boxW = 648, which leaves 86px margin on each side of an
// 820px viewBox.
const CONTENT_SPAN = 3 * STEP_X + BOX_W;
const START_X = (W - CONTENT_SPAN) / 2 + BOX_W / 2;

export interface Edge {
  cx: number;
  cy: number;
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
}

const edge = (cx: number, cy: number): Edge => ({
  cx,
  cy,
  leftX: cx - BOX_W / 2,
  rightX: cx + BOX_W / 2,
  topY: cy - BOX_H / 2,
  bottomY: cy + BOX_H / 2,
});

export const cli = edge(START_X, TOP_Y);
export const scout = edge(START_X + STEP_X, TOP_Y);
export const strategist = edge(START_X + STEP_X * 2, TOP_Y);
export const critic = edge(START_X + STEP_X * 3, TOP_Y);
export const arbiter = edge(critic.cx, ARB_Y);

// Strip above the boxes where every horizontal-arrow label lives.
export const LABEL_Y = TOP_Y - BOX_H / 2 - 16;
