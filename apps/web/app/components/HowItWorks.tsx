const items = [
  {
    no: "01",
    name: "Watcher",
    role: "reads",
    body: "Pulls your LP position, the pool's current tick, and reports whether you're in range or drifting.",
  },
  {
    no: "02",
    name: "Planner",
    role: "proposes",
    body: "Generates one or two structured rebalance candidates with target ranges and capital allocation.",
  },
  {
    no: "03",
    name: "Risk",
    role: "critiques",
    body: "Stress-tests each candidate, vetoes weak ones, and explains why the survivor is the safer play.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-8 py-32 sm:py-40">
      <div className="mb-20 flex items-baseline justify-between">
        <h2 className="font-fraunces text-[34px] text-fg sm:text-[42px]">
          Three agents.{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            One plan.
          </em>
        </h2>
        <span className="hidden font-jetbrains text-[11px] uppercase text-muted sm:block">
          §1, flow
        </span>
      </div>

      <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-0">
        {items.map((it, i) => (
          <div
            key={it.no}
            className={`relative ${
              i > 0 ? "sm:border-l sm:border-line sm:pl-10" : "sm:pr-10"
            } ${i < items.length - 1 ? "sm:pr-10" : ""}`}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-jetbrains text-[11px] text-muted">
                {it.no}
              </span>
              <h3 className="font-fraunces text-[22px] text-fg">
                {it.name}
              </h3>
              <span className="font-jetbrains text-[11px] text-pink">
                {it.role}
              </span>
            </div>
            <p className="mt-5 max-w-[280px] text-[14.5px] leading-[1.65] text-fg-2">
              {it.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
