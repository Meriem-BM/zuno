import { Terminal } from "./Terminal";

export function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-8 pt-24 pb-32 sm:pt-32 sm:pb-40">
      <div className="dot-grid pointer-events-none absolute inset-x-8 top-24 h-[260px] opacity-40" />

      <div className="relative grid grid-cols-1 gap-x-16 gap-y-20 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="rise rise-1 font-jetbrains text-[11px] uppercase text-muted">
            <span className="text-pink">v0.1</span> · multi-agent over gensyn axl
          </p>

          <h1 className="rise rise-2 mt-7 font-fraunces text-[44px] leading-[1.05] text-fg sm:text-[58px] lg:text-[68px]">
            A terminal-native
            <br />
            copilot for{" "}
            <em className="italic text-pink" style={{ fontStyle: "italic" }}>
              Uniswap
            </em>{" "}
            LPs.
          </h1>

          <p className="rise rise-3 mt-8 max-w-[520px] text-[16.5px] leading-[1.65] text-fg-2">
            Zuno uses a small network of AXL-connected agents to inspect positions, debate
            rebalances, and produce execution-ready liquidity plans.
          </p>

          <div className="rise rise-4 mt-12 flex flex-wrap items-center gap-5">
            <a
              href="#workflow"
              className="group inline-flex items-center gap-2 rounded-sm bg-fg px-5 py-2.5 font-jetbrains text-[12.5px] text-bg transition hover:bg-pink"
            >
              View workflow
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#architecture"
              className="font-jetbrains text-[12.5px] text-fg-2 underline decoration-faint decoration-[1px] underline-offset-[6px] transition hover:text-pink hover:decoration-pink"
            >
              Read architecture
            </a>
          </div>

          <div className="rise rise-5 mt-16 flex items-center gap-4 font-jetbrains text-[11px] text-muted">
            <span>$ npm i -g zuno</span>
            <span className="text-faint">|</span>
            <span>brew install zuno</span>
          </div>
        </div>

        <div className="rise rise-4 lg:col-span-5" id="workflow">
          <Terminal />
          <div className="mt-3 flex items-center gap-2 px-1 font-jetbrains text-[10.5px] text-muted">
            <span className="block h-[5px] w-[5px] rounded-full bg-pink axl-pulse" />
            <span>fig 1, reviewed recommendation for an ETH/USDC v3 position</span>
          </div>
        </div>
      </div>
    </section>
  );
}
