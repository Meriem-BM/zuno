const reasons = [
  "A debate models the real LP tradeoff, fee density vs survival, instead of picking one side and asking you to trust it.",
  "LLMs reason; deterministic code computes. The model picks shapes (width, offset, exposure), never raw ticks, amounts, or addresses. The Critic re-verifies every number before a plan ships.",
  "Every line of reasoning is auditable. The full transcript ships with the plan; `explain recommendation` replays it on demand.",
  "Your wallet stays separate. Zuno signs only after explicit approval, through a Turnkey-backed agent wallet you control.",
];

export function WhyItMatters() {
  return (
    <section className="mx-auto w-full max-w-6xl px-8 py-28 sm:py-32">
      <h2 className="mb-16 font-mono font-bold text-[30px] tracking-[-0.03em] text-fg sm:text-[38px]">
        Why this beats a{" "}
        <em className="italic text-fg-2" style={{ fontStyle: "italic" }}>
          single-shot copilot.
        </em>
      </h2>

      <ol className="max-w-[760px] space-y-6">
        {reasons.map((r, i) => (
          <li
            key={i}
            className="rise flex items-start gap-6"
            style={{ animationDelay: `${0.1 + i * 0.12}s` }}
          >
            <span className="mt-[12px] block h-px w-10 shrink-0 bg-pink" />
            <span className="text-[18px] leading-[1.55] text-fg">{r}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
