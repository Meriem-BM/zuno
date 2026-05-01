type Color = "watcher" | "planner" | "risk" | "axl" | "muted";

const PALETTE: Record<Color, string> = {
  watcher: "\x1b[36m",
  planner: "\x1b[33m",
  risk: "\x1b[35m",
  axl: "\x1b[35m",
  muted: "\x1b[90m",
};

const RESET = "\x1b[0m";

export type Logger = (msg: string) => void;

export function makeLogger(role: Color): Logger {
  return (msg) => {
    const ts = new Date().toISOString().slice(11, 19);
    process.stdout.write(
      `${PALETTE.muted}${ts}${RESET}  ${PALETTE[role]}${role.padEnd(7)}${RESET}  ${msg}\n`,
    );
  };
}
