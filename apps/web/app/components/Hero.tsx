import { Terminal } from "./Terminal";

export function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-8 pt-24 pb-32 sm:pt-32 sm:pb-40">
      {/* faint dot grid behind type, barely visible */}
      <div className="dot-grid pointer-events-none absolute inset-x-8 top-24 h-[260px] opacity-40" />

      <div className="relative grid grid-cols-1 gap-x-16 gap-y-20 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="rise rise-1 font-[family-name:var(--font-jetbrains)] text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            <span className="text-[var(--color-pink)]">v0.1</span> · multi-agent
            over gensyn axl
          </p>

          <h1 className="rise rise-2 mt-7 font-[family-name:var(--font-fraunces)] text-[44px] leading-[1.05] tracking-[-0.022em] text-[var(--color-fg)] sm:text-[58px] lg:text-[68px]">
            A terminal-native
            <br />
            copilot for{" "}
            <em className="italic text-[var(--color-pink)]" style={{ fontStyle: "italic" }}>
              Uniswap
            </em>{" "}
            LPs.
          </h1>

          <p className="rise rise-3 mt-8 max-w-[520px] text-[16.5px] leading-[1.65] text-[var(--color-fg-2)]">
            Zuno uses a small network of AXL-connected agents to inspect
            positions, debate rebalances, and produce execution-ready liquidity
            plans.
          </p>

          <div className="rise rise-4 mt-12 flex flex-wrap items-center gap-5">
            <a
              href="#demo"
              className="group inline-flex items-center gap-2 rounded-sm bg-[var(--color-fg)] px-5 py-2.5 font-[family-name:var(--font-jetbrains)] text-[12.5px] text-[var(--color-bg)] transition hover:bg-[var(--color-pink)]"
            >
              View demo
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#architecture"
              className="font-[family-name:var(--font-jetbrains)] text-[12.5px] text-[var(--color-fg-2)] underline decoration-[var(--color-faint)] decoration-[1px] underline-offset-[6px] transition hover:text-[var(--color-pink)] hover:decoration-[var(--color-pink)]"
            >
              Read architecture
            </a>
          </div>

          <div className="rise rise-5 mt-16 flex items-center gap-4 font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--color-muted)]">
            <span>$ npm i -g zuno</span>
            <span className="text-[var(--color-faint)]">|</span>
            <span>brew install zuno</span>
          </div>
        </div>

        <div className="rise rise-4 lg:col-span-5" id="demo">
          <Terminal />
          <div className="mt-3 flex items-center gap-2 px-1 font-[family-name:var(--font-jetbrains)] text-[10.5px] text-[var(--color-muted)]">
            <span className="block h-[5px] w-[5px] rounded-full bg-[var(--color-pink)] axl-pulse" />
            <span>fig 1, output of `zuno plan` against a live ETH/USDC v3 position</span>
          </div>
        </div>
      </div>
    </section>
  );
}
