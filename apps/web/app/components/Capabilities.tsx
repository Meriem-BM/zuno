const items = [
  {
    no: "01",
    name: "Create",
    line: "open a new position",
    body: "Type the goal in plain English. Scout surveys live v4 pools on the chain, the agents debate width and pool, and Zuno prepares the mint.",
    sample: "create a position with 0.05 ETH passively",
  },
  {
    no: "02",
    name: "Rebalance",
    line: "review an existing one",
    body: "Same four agents, applied to a position you already hold. The transcript is persisted with the plan so you can replay the reasoning later.",
    sample: "recommend what I should do with this position",
  },
  {
    no: "03",
    name: "Monitor",
    line: "background watcher",
    body: "Polls your positions on a schedule. Out-of-range or near-boundary conditions ping you on Telegram and land in `~/.zuno/alerts.json`.",
    sample: "show alerts",
  },
];

export function Capabilities() {
  return (
    <section
      id="capabilities"
      className="mx-auto w-full max-w-6xl px-8 py-28 sm:py-32"
    >
      <div className="mb-20 grid grid-cols-1 gap-y-6 lg:grid-cols-12 lg:gap-x-16">
        <h2 className="font-mono font-bold text-[30px] tracking-[-0.03em] text-fg sm:text-[38px] lg:col-span-7">
          Three things,{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            one shell.
          </em>
        </h2>
        <p className="text-[15.5px] leading-[1.6] text-fg-2 lg:col-span-5">
          Open positions, rebalance them, and watch them - without leaving
          your terminal. Each surface is one intent away.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-y-14 lg:grid-cols-3 lg:gap-y-0">
        {items.map((it, i) => (
          <div
            key={it.no}
            className={[
              "flex flex-col",
              i === 0 ? "lg:pr-10" : "",
              i === 1 ? "lg:border-x lg:border-line lg:px-10" : "",
              i === 2 ? "lg:pl-10" : "",
            ].join(" ")}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-jetbrains text-[10.5px] text-muted">{it.no}</span>
              <h3 className="font-mono font-semibold text-[22px] leading-tight tracking-[-0.03em] text-fg">
                {it.name}
              </h3>
            </div>
            <p className="mt-1 font-jetbrains text-[11px] uppercase tracking-[0.04em] text-pink">
              {it.line}
            </p>
            <p className="mt-6 max-w-[340px] text-[14.5px] leading-[1.65] text-fg-2">
              {it.body}
            </p>
            <div className="mt-auto pt-8">
              <div className="inline-flex w-fit max-w-full items-baseline gap-2 rounded-sm border border-faint bg-bg-2 px-3 py-2 font-jetbrains text-[11.5px] text-fg-2">
                <span className="text-pink">$</span>
                <span className="truncate">{it.sample}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
