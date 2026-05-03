const agents = [
  {
    no: "01",
    name: "Scout",
    role: "observes",
    body: "Reads the position (or surveys live pools, for a new one). Loads volatility, gas, and yield. Labels the market regime in plain English.",
  },
  {
    no: "02",
    name: "Strategist",
    role: "proposes",
    body: "Drafts 2-5 candidate ranges. Picks proportions only - tick math is snapped deterministically so the LLM never fabricates numbers.",
  },
  {
    no: "03",
    name: "Critic",
    role: "challenges",
    body: "Stress-tests every candidate at 1×, 2×, 3× volatility. Vetoes weak ranges with concrete reasons. Asks the strategist to revise.",
  },
  {
    no: "04",
    name: "Arbiter",
    role: "decides",
    body: "Only joins on deadlock. Reads the full debate, picks one candidate, writes the rationale the user reads in `explain recommendation`.",
  },
];

export function Agents() {
  return (
    <section
      id="agents"
      className="mx-auto w-full max-w-6xl px-8 py-28 sm:py-32"
    >
      <div className="mb-20 grid grid-cols-1 gap-y-6 lg:grid-cols-12 lg:gap-x-16">
        <h2 className="font-mono font-bold text-[30px] tracking-[-0.03em] text-fg sm:text-[38px] lg:col-span-7">
          Four agents.{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            One debate.
          </em>
        </h2>
        <p className="text-[15.5px] leading-[1.65] text-fg-2 lg:col-span-5">
          Each agent is its own process with its own AXL peer id. Numbers come
          from deterministic helpers; the LLM only owns reasoning. The
          transcript ships with the plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-y-14 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-4 lg:gap-y-0">
        {agents.map((a, i) => (
          <div
            key={a.no}
            className={[
              "flex flex-col",
              i === 0 ? "lg:pr-8" : "",
              i > 0 && i < agents.length - 1 ? "lg:border-l lg:border-line lg:px-8" : "",
              i === agents.length - 1 ? "lg:border-l lg:border-line lg:pl-8" : "",
            ].join(" ")}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-jetbrains text-[10.5px] text-muted">{a.no}</span>
              <h3 className="font-mono font-semibold text-[20px] leading-tight tracking-[-0.03em] text-fg">
                {a.name}
              </h3>
            </div>
            <p className="mt-1 font-jetbrains text-[11px] uppercase tracking-[0.04em] text-pink">
              {a.role}
            </p>
            <p className="mt-6 text-[14px] leading-[1.65] text-fg-2">{a.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
