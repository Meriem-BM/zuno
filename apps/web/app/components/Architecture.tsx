import { Diagram } from "./architecture/Diagram";

export function Architecture() {
  return (
    <section id="architecture" className="mx-auto w-full max-w-6xl px-8 py-28 sm:py-32">
      <div className="mb-14">
        <h2 className="font-mono font-bold text-[30px] tracking-[-0.03em] text-fg sm:text-[38px]">
          A small{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            mesh,
          </em>{" "}
          not a monolith.
        </h2>
        <p className="mt-4 max-w-[600px] text-[15.5px] leading-[1.6] text-fg-2">
          Each agent runs as its own process and talks through{" "}
          <span className="text-fg">AXL</span> - Gensyn&apos;s peer-to-peer
          Agent eXchange Layer. They reach each other by ed25519 peer id.
          No central broker.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-8">
          <Diagram />
        </div>
        <div className="lg:col-span-4">
          <dl className="grid grid-cols-2 gap-y-3 font-jetbrains text-[12px] lg:grid-cols-1">
            <dt className="text-muted">transport</dt>
            <dd className="text-fg">axl /send · /recv</dd>
            <dt className="text-muted">topology</dt>
            <dd className="text-fg">peer mesh, 5 nodes</dd>
            <dt className="text-muted">addressing</dt>
            <dd className="text-fg">ed25519 peer id</dd>
            <dt className="text-muted">determinism</dt>
            <dd className="text-fg">tick math in ts</dd>
            <dt className="text-muted">signer</dt>
            <dd className="text-fg">turnkey policy</dd>
            <dt className="text-muted">fallback</dt>
            <dd className="text-fg">in-process</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}
