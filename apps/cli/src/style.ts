/**
 * Terminal styling, ANSI codes, no dependencies.
 *
 * The pink accent matches the landing page: a single colour used sparingly
 * on key tokens, never on whole blocks of text.
 */

export const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",

  fg: "\x1b[38;2;232;230;227m",
  fgDim: "\x1b[38;2;160;158;160m",
  muted: "\x1b[38;2;107;106;110m",
  faint: "\x1b[38;2;60;58;66m",

  pink: "\x1b[38;2;255;143;177m",
  pinkDeep: "\x1b[38;2;233;106;145m",

  green: "\x1b[38;2;126;195;145m",
  amber: "\x1b[38;2;233;180;100m",
  red: "\x1b[38;2;233;106;145m",
};

export const pink = (s: string) => `${c.pink}${s}${c.reset}`;
export const pinkDeep = (s: string) => `${c.pinkDeep}${s}${c.reset}`;
export const muted = (s: string) => `${c.muted}${s}${c.reset}`;
export const faint = (s: string) => `${c.faint}${s}${c.reset}`;
export const dim = (s: string) => `${c.fgDim}${s}${c.reset}`;
export const fg = (s: string) => `${c.fg}${s}${c.reset}`;
export const bold = (s: string) => `${c.bold}${s}${c.reset}`;

const HR = "─".repeat(56);
export const hr = () => muted(HR);

export const mark = pink("◇");
export const dot = pink("·");

export function header(prompt: string, value: string): string {
  return `${pink("$")} ${fg(prompt)} ${pink(value)}`;
}

export function row(
  k: string,
  v: string,
  suffix?: string,
  width = 12,
): string {
  const key = muted(k.padEnd(width));
  return suffix
    ? `  ${key}${fg(v)}  ${suffix}`
    : `  ${key}${fg(v)}`;
}

export function blank(): void {
  process.stdout.write("\n");
}

export function line(s = ""): void {
  process.stdout.write(s + "\n");
}

/** Hide / show cursor for spinner-free progress lines. */
export const cursor = {
  hide: () => process.stdout.write("\x1b[?25l"),
  show: () => process.stdout.write("\x1b[?25h"),
  back: (cols: number) => process.stdout.write(`\x1b[${cols}D`),
  up: (n: number) => process.stdout.write(`\x1b[${n}A`),
  clearLine: () => process.stdout.write("\x1b[2K\r"),
};
