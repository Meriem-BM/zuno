const items = [
  {
    no: "01",
    name: "Watcher",
    role: "reads",
    body: "Reads the position and pool tick from chain. Reports range, drift, and utilization.",
  },
  {
    no: "02",
    name: "Planner",
    role: "proposes",
    body: "Drafts one or two structured rebalance candidates with target ranges and capital splits.",
  },
  {
    no: "03",
    name: "Risk",
    role: "critiques",
    body: "Stress-tests each candidate, vetoes weak ones, and explains why the survivor is safer.",
  },
  {
    no: "04",
    name: "Turnkey",
    role: "signs",
    body: "Policy checks run before signing. Zuno wallet only signs after you approve the plan.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-8 py-32 sm:py-40">
      <div className="mb-20 flex items-baseline justify-between">
        <h2 className="font-fraunces text-[34px] tracking-[-0.01em] text-fg sm:text-[42px]">
          Three agents.{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            One plan.
          </em>{" "}
          You sign.
        </h2>
        <span className="hidden font-jetbrains text-[11px] uppercase text-muted sm:block">
          §1, flow
        </span>
      </div>

      {/* Connector with a traveling pink dot, hidden on mobile */}
      <div className="relative mb-12 hidden h-px sm:block">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <span
          className="absolute top-1/2 block h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-pink shadow-[0_0_10px_rgba(255,143,177,0.7)]"
          style={{ animation: "travel 9s linear infinite", offsetPath: "none" }}
        />
        <style>{`
          @keyframes travel {
            0% { left: 0%; opacity: 0; }
            6% { opacity: 1; }
            94% { opacity: 1; }
            100% { left: 100%; opacity: 0; }
          }
        `}</style>
      </div>

      <div className="grid grid-cols-1 gap-12 sm:grid-cols-4 sm:gap-0">
        {items.map((it, i) => (
          <div
            key={it.no}
            className={`lift relative rounded-sm border border-transparent p-1 ${
              i > 0 ? "sm:border-l sm:border-line sm:pl-10 sm:hover:border-line" : "sm:pr-10"
            } ${i < items.length - 1 ? "sm:pr-10" : ""}`}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-jetbrains text-[11px] text-muted">{it.no}</span>
              <h3 className="font-fraunces text-[22px] text-fg">{it.name}</h3>
              <span className="font-jetbrains text-[11px] text-pink">{it.role}</span>
            </div>
            <p className="mt-5 max-w-[280px] text-[14.5px] leading-[1.65] text-fg-2">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
