import { Terminal } from "./Terminal";

export function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-8 pt-24 pb-28 sm:pt-32 sm:pb-32">
      <div className="dot-grid pointer-events-none absolute inset-x-8 top-24 h-[260px] opacity-40" />

      <div className="relative grid grid-cols-1 gap-x-12 gap-y-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="rise rise-1 flex items-center gap-3 font-jetbrains text-[11px] uppercase tracking-[0.04em] text-muted">
            <span>terminal-native · uniswap v4 · axl mesh</span>
          </p>

          <h1 className="rise rise-2 mt-7 font-mono font-bold text-[40px] leading-[1.1] tracking-[-0.04em] text-fg sm:text-[52px] lg:text-[60px]">
            An LP copilot that
            <br />
            <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
              shows its work.
            </em>
          </h1>

          <p className="rise rise-3 mt-8 max-w-[540px] text-[16.5px] leading-[1.65] text-fg-2">
            Open, rebalance, and monitor Uniswap v4 positions in plain English. Four agents debate
            every move, you see the reasoning before the wallet signs.
          </p>

          <div className="rise rise-4 mt-12 flex flex-wrap items-center gap-5">
            <a
              href="#capabilities"
              className="group inline-flex items-center gap-2 rounded-sm bg-fg px-5 py-2.5 font-jetbrains text-[12.5px] text-bg transition hover:bg-pink"
            >
              See what it does
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#agents"
              className="link-sweep font-jetbrains text-[12.5px] text-fg-2 transition hover:text-fg"
            >
              Meet the agents
            </a>
          </div>

          <div className="rise rise-5 mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 font-jetbrains text-[11px] text-muted">
            <p className="text-fg-2">
              <span className="text-pink font-bold">$</span> npm i -g @zunocli/cli
            </p>
          </div>
        </div>

        <div className="rise rise-4 lg:col-span-6" id="workflow">
          <Terminal />
          <div className="mt-3 flex items-center gap-2 px-1 font-jetbrains text-[10.5px] text-muted">
            <span className="block h-[5px] w-[5px] rounded-full bg-pink axl-pulse" />
            <span>live debate · awaiting human approval</span>
          </div>
        </div>
      </div>
    </section>
  );
}
