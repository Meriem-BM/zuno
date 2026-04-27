export function Nav() {
  return (
    <nav className="rise rise-1 mx-auto flex w-full max-w-6xl items-center justify-between px-8 pt-10">
      <a href="/" className="flex items-center gap-2.5">
        <span className="block h-[7px] w-[7px] rounded-full bg-[var(--color-pink)]" />
        <span className="font-[family-name:var(--font-fraunces)] text-[17px] tracking-tight text-[var(--color-fg)]">
          zuno
        </span>
      </a>
      <div className="hidden gap-9 font-[family-name:var(--font-jetbrains)] text-[12px] text-[var(--color-muted)] sm:flex">
        <a href="#how" className="transition hover:text-[var(--color-fg)]">
          how it works
        </a>
        <a href="#architecture" className="transition hover:text-[var(--color-fg)]">
          architecture
        </a>
        <a
          href="https://github.com"
          className="transition hover:text-[var(--color-fg)]"
        >
          github
        </a>
      </div>
      <a
        href="#demo"
        className="font-[family-name:var(--font-jetbrains)] text-[12px] text-[var(--color-fg)] transition hover:text-[var(--color-pink)]"
      >
        install →
      </a>
    </nav>
  );
}
