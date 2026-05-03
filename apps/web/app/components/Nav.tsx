export function Nav() {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        backgroundColor: "rgba(10, 10, 11, 0.86)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid rgba(29, 28, 32, 0.9)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-5">
        <a href="/" className="flex items-center gap-2.5">
          <span className="block h-[7px] w-[7px] rounded-full bg-pink axl-pulse" />
          <span className="font-mono font-semibold text-[15px] tracking-[-0.02em] text-fg">zuno</span>
        </a>
        <div className="hidden gap-9 font-jetbrains text-[12px] text-muted sm:flex">
          <a href="#capabilities" className="link-sweep transition hover:text-fg">
            what it does
          </a>
          <a href="#agents" className="link-sweep transition hover:text-fg">
            agents
          </a>
          <a href="#architecture" className="link-sweep transition hover:text-fg">
            architecture
          </a>
        </div>
        <a
          href="https://github.com/Meriem-BM/zuno"
          className="font-jetbrains text-[12px] text-fg transition hover:text-pink"
        >
          github →
        </a>
      </div>
    </header>
  );
}
