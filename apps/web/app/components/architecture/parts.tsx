import { BOX_H, BOX_W } from "./constants";

// SVG arrowhead markers used by every line in the diagram. Rendered once
// inside <defs> by the Diagram and referenced via url(#id).
export function ArrowMarkers() {
  return (
    <defs>
      <marker
        id="arrow-pink"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="var(--color-pink)" />
      </marker>
      <marker
        id="arrow-muted"
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L10,5 L0,10 z" fill="var(--color-fg-2)" />
      </marker>
    </defs>
  );
}

interface ArrowProps {
  from: number;
  to: number;
  y: number;
  muted?: boolean;
  dashed?: boolean;
}

export function Arrow({ from, to, y, muted, dashed }: ArrowProps) {
  return (
    <line
      x1={from}
      y1={y}
      x2={to}
      y2={y}
      stroke={muted ? "var(--color-fg-2)" : "var(--color-pink)"}
      strokeWidth="1.6"
      strokeDasharray={dashed ? "4 4" : undefined}
      markerEnd={muted ? "url(#arrow-muted)" : "url(#arrow-pink)"}
    />
  );
}

interface EdgeLabelProps {
  x: number;
  y: number;
  text: string;
  muted?: boolean;
}

export function EdgeLabel({ x, y, text, muted }: EdgeLabelProps) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontFamily="var(--font-jetbrains)"
      fontSize="12"
      fill={muted ? "var(--color-muted)" : "var(--color-fg)"}
    >
      {text}
    </text>
  );
}

interface AgentBoxProps {
  cx: number;
  cy: number;
  label: string;
  role: string;
  primary?: boolean;
  muted?: boolean;
}

export function AgentBox({ cx, cy, label, role, primary, muted }: AgentBoxProps) {
  const x = cx - BOX_W / 2;
  const y = cy - BOX_H / 2;
  const fill = primary ? "var(--color-bg)" : "#0d0d10";
  const stroke = muted ? "var(--color-faint)" : "var(--color-fg-2)";
  const strokeWidth = primary ? "1.6" : "1.2";
  const roleColor = muted ? "var(--color-muted)" : "var(--color-pink)";

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={BOX_W}
        height={BOX_H}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        rx="4"
      />
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="20"
        fill="var(--color-fg)"
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="11.5"
        fill={roleColor}
      >
        {role}
      </text>
    </g>
  );
}
