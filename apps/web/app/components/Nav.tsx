export function Nav() {
  return (
    <div className="sticky top-0 z-50">
      <nav className="rise rise-1 nav-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-5">
          <a href="/" className="flex items-center gap-2.5">
            <span className="block h-[7px] w-[7px] rounded-full bg-pink axl-pulse" />
            <span className="font-fraunces text-[17px] tracking-[-0.01em] text-fg">zuno</span>
          </a>
          <div className="hidden gap-9 font-jetbrains text-[12px] text-muted sm:flex">
            <a href="#how" className="link-sweep transition hover:text-fg">
              how it works
            </a>
            <a href="#architecture" className="link-sweep transition hover:text-fg">
              architecture
            </a>
            <a href="https://github.com" className="link-sweep transition hover:text-fg">
              github
            </a>
          </div>
          <a
            href="#workflow"
            className="font-jetbrains text-[12px] text-fg transition hover:text-pink"
          >
            install →
          </a>
        </div>
      </nav>
    </div>
  );
}
