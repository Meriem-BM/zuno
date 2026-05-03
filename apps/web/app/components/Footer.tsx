export function Footer() {
  return (
    <footer className="relative pb-16 pt-28">
      <div className="hairline mx-auto mb-16 w-full max-w-6xl px-8" />

      <div className="mx-auto max-w-3xl px-8 text-center">
        <p className="font-mono font-semibold text-[22px] leading-[1.45] tracking-[-0.02em] text-fg sm:text-[26px]">
          <em className="italic" style={{ fontStyle: "italic" }}>
            Multi-agent
          </em>{" "}
          isn&apos;t a feature of Zuno. <span className="text-fg-2">It is the workflow.</span>
        </p>
      </div>

      <div className="mx-auto mt-20 flex w-full max-w-6xl flex-wrap items-center justify-between gap-y-3 px-8 font-jetbrains text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <span className="block h-[6px] w-[6px] rounded-full bg-pink axl-pulse" />
          <span>zuno · uniswap v4</span>
        </div>
        <div className="flex gap-6">
          <a
            href="https://github.com/Meriem-BM/zuno"
            target="_blank"
            rel="noopener noreferrer"
            className="link-sweep transition hover:text-fg"
          >
            github
          </a>
          <a
            href="https://zuno-fb55ec99.mintlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="link-sweep transition hover:text-fg"
          >
            docs
          </a>
        </div>
        <span>$ npm i -g @zunocli/cli</span>
      </div>
    </footer>
  );
}
