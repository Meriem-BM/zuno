const reasons = [
  "Dashboards report numbers. They don't explain decisions.",
  "Manual rebalancing is slow and error-prone — and the cost compounds.",
  "Zuno keeps execution in a dedicated agent wallet, with explicit human approval.",
];

export function WhyItMatters() {
  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-32 sm:py-40">
      <div className="mb-16 flex items-baseline justify-between">
        <h2 className="font-fraunces text-[34px] tracking-[-0.01em] text-fg sm:text-[42px]">
          Why it{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            matters.
          </em>
        </h2>
        <span className="hidden font-jetbrains text-[11px] uppercase text-muted sm:block">
          §2, premise
        </span>
      </div>

      <ol className="max-w-[760px] space-y-7">
        {reasons.map((r, i) => (
          <li
            key={i}
            className="rise flex items-start gap-6"
            style={{ animationDelay: `${0.1 + i * 0.12}s` }}
          >
            <span className="mt-[10px] block h-px w-10 shrink-0 bg-pink" />
            <span className="text-[19px] leading-[1.55] text-fg">{r}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
