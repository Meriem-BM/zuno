type Color = "scout" | "strategist" | "critic" | "arbiter" | "monitor" | "axl" | "muted";

const PALETTE: Record<Color, string> = {
  scout: "\x1b[36m",      // cyan
  strategist: "\x1b[33m", // yellow
  critic: "\x1b[31m",     // red
  arbiter: "\x1b[35m",    // magenta
  monitor: "\x1b[32m",    // green
  axl: "\x1b[35m",
  muted: "\x1b[90m",
};

const RESET = "\x1b[0m";

export type Logger = (msg: string) => void;

export function makeLogger(role: Color): Logger {
  return (msg) => {
    const ts = new Date().toISOString().slice(11, 19);
    process.stdout.write(
      `${PALETTE.muted}${ts}${RESET}  ${PALETTE[role]}${role.padEnd(10)}${RESET}  ${msg}\n`,
    );
  };
}
