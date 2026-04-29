const reasons = [
  "LP management is still mostly manual.",
  "Dashboards report numbers; they don't explain decisions.",
  "Zuno produces structured, inspectable plans you can act on.",
];

export function WhyItMatters() {
  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-32 sm:py-40">
      <div className="mb-16 flex items-baseline justify-between">
        <h2 className="font-fraunces text-[34px] text-fg sm:text-[42px]">
          Why it{" "}
          <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
            matters.
          </em>
        </h2>
        <span className="hidden font-jetbrains text-[11px] uppercase text-muted sm:block">
          §2, premise
        </span>
      </div>

      <ol className="max-w-[720px] space-y-6">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-6">
            <span className="mt-[6px] block h-px w-10 shrink-0 bg-pink" />
            <span className="text-[19px] leading-[1.55] text-fg">{r}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
