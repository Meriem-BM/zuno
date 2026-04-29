export function Nav() {
  return (
    <nav className="rise rise-1 mx-auto flex w-full max-w-6xl items-center justify-between px-8 pt-10">
      <a href="/" className="flex items-center gap-2.5">
        <span className="block h-[7px] w-[7px] rounded-full bg-pink" />
        <span className="font-fraunces text-[17px] text-fg">
          zuno
        </span>
      </a>
      <div className="hidden gap-9 font-jetbrains text-[12px] text-muted sm:flex">
        <a href="#how" className="transition hover:text-fg">
          how it works
        </a>
        <a href="#architecture" className="transition hover:text-fg">
          architecture
        </a>
        <a href="https://github.com" className="transition hover:text-fg">
          github
        </a>
      </div>
      <a
        href="#workflow"
        className="font-jetbrains text-[12px] text-fg transition hover:text-pink"
      >
        install →
      </a>
    </nav>
  );
}
