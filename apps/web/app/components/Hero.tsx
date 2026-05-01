import { Terminal } from "./Terminal";

export function Hero() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-8 pt-24 pb-32 sm:pt-32 sm:pb-40">
      <div className="dot-grid pointer-events-none absolute inset-x-8 top-24 h-[260px] opacity-40" />

      <div className="relative grid grid-cols-1 gap-x-16 gap-y-20 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="rise rise-1 flex items-center gap-3 font-jetbrains text-[11px] uppercase tracking-[0.04em] text-muted">
            <MiniMesh />
            <span>
              <span className="text-pink">v0.1</span> · turnkey wallet · gensyn axl
            </span>
          </p>

          <h1 className="rise rise-2 mt-7 font-fraunces text-[44px] leading-[1.05] tracking-[-0.01em] text-fg sm:text-[58px] lg:text-[68px]">
            Rebalance Uniswap LPs
            <br />
            with{" "}
            <em className="italic text-pink" style={{ fontStyle: "italic" }}>
              three agents
            </em>{" "}
            you can read.
          </h1>

          <p className="rise rise-3 mt-8 max-w-[540px] text-[16.5px] leading-[1.65] text-fg-2">
            Watcher, Planner, and Risk debate every move. You see the diff, the rejected option, and
            the reason. The Zuno wallet only signs once you approve.
          </p>

          <div className="rise rise-4 mt-12 flex flex-wrap items-center gap-5">
            <a
              href="#workflow"
              className="group inline-flex items-center gap-2 rounded-sm bg-fg px-5 py-2.5 font-jetbrains text-[12.5px] text-bg transition hover:bg-pink"
            >
              See the workflow
              <span className="transition group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#architecture"
              className="link-sweep font-jetbrains text-[12.5px] text-fg-2 transition hover:text-fg"
            >
              How it&apos;s wired
            </a>
          </div>

          <div className="rise rise-5 mt-16 flex flex-wrap items-center gap-x-4 gap-y-2 font-jetbrains text-[11px] text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="block h-[5px] w-[5px] rounded-full bg-pink axl-pulse" />
              <span>cli online</span>
            </span>
            <span className="text-faint">|</span>
            <span>$ npm i -g zuno</span>
            <span className="text-faint">|</span>
            <span>brew install zuno</span>
          </div>
        </div>

        <div className="rise rise-4 lg:col-span-5" id="workflow">
          <Terminal />
          <div className="mt-3 flex items-center gap-2 px-1 font-jetbrains text-[10.5px] text-muted">
            <span className="block h-[5px] w-[5px] rounded-full bg-pink axl-pulse" />
            <span>fig 1, reviewed plan, awaiting human approval</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Tiny live-mesh badge — three orbiting peer dots, telegraphs the
 * "multi-agent over a peer-to-peer mesh" story before the user even
 * scrolls. CSS-only animation; respects prefers-reduced-motion.
 */
function MiniMesh() {
  return (
    <span className="relative inline-block h-[22px] w-[22px] shrink-0" aria-hidden="true">
      <span className="absolute inset-0 rounded-full border border-faint" />
      <span className="absolute inset-0 mini-orbit">
        <span className="absolute left-1/2 top-0 block h-[3.5px] w-[3.5px] -translate-x-1/2 rounded-full bg-pink" />
        <span className="absolute left-full top-1/2 block h-[3.5px] w-[3.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-2" />
        <span className="absolute left-0 top-1/2 block h-[3.5px] w-[3.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg-2" />
      </span>
      <span className="absolute left-1/2 top-1/2 block h-[3.5px] w-[3.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink axl-pulse" />
    </span>
  );
}
