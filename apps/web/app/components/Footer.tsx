export function Footer() {
  return (
    <footer className="relative pb-16 pt-32">
      <div className="hairline mx-auto mb-16 w-full max-w-6xl px-8" />

      <div className="mx-auto max-w-3xl px-8 text-center">
        <p className="font-[family-name:var(--font-fraunces)] text-[26px] leading-[1.4] text-[var(--color-fg)] sm:text-[30px]">
          <em className="italic" style={{ fontStyle: "italic" }}>
            Multi-agent
          </em>{" "}
          isn't a feature of Zuno.{" "}
          <span className="text-[var(--color-fg-2)]">It is the workflow.</span>
        </p>
      </div>

      <div className="mx-auto mt-20 flex w-full max-w-6xl items-center justify-between px-8 font-[family-name:var(--font-jetbrains)] text-[11px] text-[var(--color-muted)]">
        <div className="flex items-center gap-2">
          <span className="block h-[6px] w-[6px] rounded-full bg-[var(--color-pink)]" />
          <span>zuno · v0.1</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="transition hover:text-[var(--color-fg)]">
            github
          </a>
          <a href="#" className="transition hover:text-[var(--color-fg)]">
            docs
          </a>
          <a href="#" className="transition hover:text-[var(--color-fg)]">
            x
          </a>
        </div>
        <span>built for uniswap v3 / v4</span>
      </div>
    </footer>
  );
}
