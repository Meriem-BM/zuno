export function Architecture() {
  return (
    <section id="architecture" className="mx-auto w-full max-w-6xl px-8 py-32 sm:py-40">
      <div className="mb-16 flex items-baseline justify-between">
        <h2 className="font-fraunces text-[34px] text-fg sm:text-[42px]">
          A small{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            mesh,
          </em>{" "}
          not a monolith.
        </h2>
        <span className="hidden font-jetbrains text-[11px] uppercase text-muted sm:block">
          §3, figure
        </span>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Diagram />
        </div>
        <div className="lg:col-span-5">
          <p className="text-[15.5px] leading-[1.7] text-fg-2">
            Each agent runs as its own process and connects to its own{" "}
            <span className="text-fg">AXL</span> node, Gensyn&apos;s peer-to-peer
            Agent eXchange Layer. They reach each other by ed25519 peer id over an encrypted
            overlay, with no central broker in the path.
          </p>
          <p className="mt-6 text-[15.5px] leading-[1.7] text-fg-2">
            The CLI is just another peer. Calculations stay deterministic in TypeScript; the model
            only routes, synthesises, and explains.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-y-3 font-jetbrains text-[11.5px]">
            <dt className="text-muted">transport</dt>
            <dd className="text-fg">axl /send · /recv</dd>
            <dt className="text-muted">topology</dt>
            <dd className="text-fg">peer mesh, 4 nodes</dd>
            <dt className="text-muted">addressing</dt>
            <dd className="text-fg">ed25519 peer id</dd>
            <dt className="text-muted">determinism</dt>
            <dd className="text-fg">tick math in ts</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Diagram() {
  // Geometry
  const W = 720;
  const H = 360;

  // Agent box centers
  const cliX = 90;
  const wX = 260;
  const pX = 430;
  const rX = 600;
  const agentY = 110;
  const axlY = 250;

  const boxW = 110;
  const boxH = 64;

  const node = (x: number) => ({
    x: x - boxW / 2,
    y: agentY - boxH / 2,
    cx: x,
    cy: agentY,
  });

  const cli = node(cliX);
  const w = node(wX);
  const p = node(pX);
  const r = node(rX);

  // AXL nodes (small dots beneath each agent)
  const axl = (x: number) => ({ x, y: axlY });
  const ax = [axl(cliX), axl(wX), axl(pX), axl(rX)];

  return (
    <figure className="rounded-md border border-line bg-bg-2 p-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Zuno architecture diagram"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-pink)" />
          </marker>
        </defs>

        {/* Faint grid for textbook feel */}
        <g opacity="0.06">
          {Array.from({ length: 20 }).map((_, i) => (
            <line
              key={`gx${i}`}
              x1={i * 36}
              y1={0}
              x2={i * 36}
              y2={H}
              stroke="white"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`gy${i}`}
              x1={0}
              y1={i * 30}
              x2={W}
              y2={i * 30}
              stroke="white"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* Agent boxes */}
        {[
          { box: cli, label: "cli", role: "user" },
          { box: w, label: "watcher", role: "reads" },
          { box: p, label: "planner", role: "proposes" },
          { box: r, label: "risk", role: "vetoes" },
        ].map((n) => (
          <g key={n.label}>
            <rect
              x={n.box.x}
              y={n.box.y}
              width={boxW}
              height={boxH}
              fill="#0a0a0b"
              stroke="var(--color-line)"
              strokeWidth="1"
              rx="3"
            />
            <text
              x={n.box.cx}
              y={agentY - 6}
              textAnchor="middle"
              fontFamily="var(--font-fraunces)"
              fontSize="15"
              fill="var(--color-fg)"
            >
              {n.label}
            </text>
            <text
              x={n.box.cx}
              y={agentY + 14}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains)"
              fontSize="9.5"
              fill="var(--color-pink)"
            >
              {n.role}
            </text>
          </g>
        ))}

        {/* Vertical hairlines from agent box down to its AXL node */}
        {ax.map((a, i) => (
          <line
            key={`v${i}`}
            x1={a.x}
            y1={agentY + boxH / 2}
            x2={a.x}
            y2={a.y - 8}
            stroke="var(--color-line)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        ))}

        {/* AXL nodes, small ringed dots */}
        {ax.map((a, i) => (
          <g key={`n${i}`}>
            <circle
              cx={a.x}
              cy={a.y}
              r="6.5"
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <circle cx={a.x} cy={a.y} r="3" fill="var(--color-pink)" className="axl-pulse" />
            <text
              x={a.x}
              y={a.y + 24}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains)"
              fontSize="9"
              fill="var(--color-muted)"
            >
              axl :{9002 + i * 10}
            </text>
            <text
              x={a.x}
              y={a.y + 38}
              textAnchor="middle"
              fontFamily="var(--font-jetbrains)"
              fontSize="8"
              fill="var(--color-faint)"
            >
              {peerId(i)}
            </text>
          </g>
        ))}

        {/* AXL mesh (peer-to-peer arc), full mesh between the four nodes */}
        {(() => {
          const lines: React.ReactNode[] = [];
          for (let i = 0; i < ax.length; i++) {
            for (let j = i + 1; j < ax.length; j++) {
              const a = ax[i]!;
              const b = ax[j]!;
              const mx = (a.x + b.x) / 2;
              const my = a.y + Math.min(40, Math.abs(b.x - a.x) * 0.18);
              lines.push(
                <path
                  key={`m${i}${j}`}
                  d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
                  fill="none"
                  stroke="var(--color-line)"
                  strokeWidth="1"
                />,
              );
            }
          }
          return lines;
        })()}

        {/* Sequential pink request flow on top of agent layer */}
        <path
          d={`M ${cli.cx + boxW / 2} ${agentY} L ${w.cx - boxW / 2} ${agentY}`}
          stroke="var(--color-pink)"
          strokeWidth="1.2"
          markerEnd="url(#arrow)"
        />
        <path
          d={`M ${w.cx + boxW / 2} ${agentY} L ${p.cx - boxW / 2} ${agentY}`}
          stroke="var(--color-pink)"
          strokeWidth="1.2"
          markerEnd="url(#arrow)"
        />
        <path
          d={`M ${p.cx + boxW / 2} ${agentY} L ${r.cx - boxW / 2} ${agentY}`}
          stroke="var(--color-pink)"
          strokeWidth="1.2"
          markerEnd="url(#arrow)"
        />

        {/* Layer labels on the side */}
        <text
          x="14"
          y={agentY + 4}
          fontFamily="var(--font-jetbrains)"
          fontSize="9"
          fill="var(--color-muted)"
        >
          agents
        </text>
        <text
          x="14"
          y={axlY + 4}
          fontFamily="var(--font-jetbrains)"
          fontSize="9"
          fill="var(--color-muted)"
        >
          axl mesh
        </text>

        {/* Caption */}
        <text
          x={W - 12}
          y={H - 10}
          textAnchor="end"
          fontFamily="var(--font-jetbrains)"
          fontSize="9.5"
          fill="var(--color-muted)"
        >
          fig 2, request flow (pink) over peer mesh (gray)
        </text>
      </svg>
    </figure>
  );
}

const peerId = (i: number) => {
  const ids = ["c0a3…1f7e", "8b21…d4e9", "11ee…a09b", "f44d…b201"];
  return ids[i] ?? "";
};
