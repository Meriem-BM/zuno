import {
  arbiter,
  cli,
  critic,
  H,
  LABEL_Y,
  scout,
  strategist,
  W,
} from "./constants";
import { AgentBox, Arrow, ArrowMarkers, EdgeLabel } from "./parts";

export function Diagram() {
  return (
    <figure className="overflow-hidden rounded-md border border-line bg-bg-2 p-5 sm:p-7">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Zuno mesh: cli, scout, strategist, critic, arbiter"
      >
        <ArrowMarkers />

        {/* Forward path */}
        <Arrow from={cli.rightX} to={scout.leftX - 4} y={cli.cy} />
        <Arrow from={scout.rightX} to={strategist.leftX - 4} y={scout.cy} />

        {/* strategist ↔ critic: two stacked arrows, opposite directions */}
        <Arrow from={strategist.rightX} to={critic.leftX - 4} y={strategist.cy - 8} />
        <Arrow
          from={critic.leftX}
          to={strategist.rightX + 4}
          y={strategist.cy + 8}
          muted
          dashed
        />

        {/* critic → arbiter (deadlock branch) */}
        <line
          x1={critic.cx}
          y1={critic.bottomY}
          x2={arbiter.cx}
          y2={arbiter.topY - 4}
          stroke="var(--color-fg-2)"
          strokeWidth="1.4"
          strokeDasharray="4 4"
          markerEnd="url(#arrow-muted)"
        />

        {/* Edge labels - strip above the boxes, no overlap with box fill */}
        <EdgeLabel x={(cli.rightX + scout.leftX) / 2} y={LABEL_Y} text="flow_start" />
        <EdgeLabel
          x={(scout.rightX + strategist.leftX) / 2}
          y={LABEL_Y}
          text="context_observed"
        />
        <EdgeLabel
          x={(strategist.rightX + critic.leftX) / 2}
          y={LABEL_Y}
          text="proposal ⇄ critique"
        />
        <EdgeLabel
          x={arbiter.cx + 70}
          y={(critic.bottomY + arbiter.topY) / 2 + 4}
          text="deadlock"
          muted
        />

        {/* Boxes drawn after lines so corners stay clean */}
        <AgentBox cx={cli.cx} cy={cli.cy} label="cli" role="you" primary />
        <AgentBox cx={scout.cx} cy={scout.cy} label="scout" role="reads regime" />
        <AgentBox cx={strategist.cx} cy={strategist.cy} label="strategist" role="proposes" />
        <AgentBox cx={critic.cx} cy={critic.cy} label="critic" role="challenges" />
        <AgentBox cx={arbiter.cx} cy={arbiter.cy} label="arbiter" role="resolves" muted />

        {/* Caption */}
        <text
          x={W / 2}
          y={H - 16}
          textAnchor="middle"
          fontFamily="var(--font-jetbrains)"
          fontSize="11.5"
          fill="var(--color-muted)"
        >
          every arrow rides the axl mesh · plan_ready returns to cli on accept or after arbiter resolves
        </text>
      </svg>
    </figure>
  );
}
