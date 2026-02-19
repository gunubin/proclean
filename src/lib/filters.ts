import type { ProcessInfo } from "./types.js";

/** dev mode: whitelist - only show known dev tool orphans */
export function devFilter(proc: ProcessInfo): boolean {
  const cmd = proc.command;

  // Claude Code
  if (cmd.includes(".local/share/claude")) return true;

  // Node.js ecosystem
  if (cmd.includes(".npm")) return true;
  if (cmd.includes(".nvm")) return true;
  if (cmd.includes(".nodebrew")) return true;

  // Rust
  if (cmd.includes(".cargo")) return true;

  // Ruby
  if (cmd.includes(".rbenv")) return true;

  // Standalone node process
  if (cmd === "node" || cmd.startsWith("node ")) return true;

  // Shell spawned by Claude (.claude/ in command, started by bash/zsh)
  if (
    (/^\/bin\/(ba|z)sh/.test(cmd) || /^(ba|z)sh/.test(cmd)) &&
    cmd.includes(".claude/")
  ) {
    return true;
  }

  return false;
}

/** all mode: blacklist - show everything except system processes */
export function allFilter(proc: ProcessInfo): boolean {
  const cmd = proc.command;

  if (cmd.startsWith("/System/")) return false;
  if (cmd.startsWith("/usr/")) return false;
  if (cmd.startsWith("/Library/Apple")) return false;

  return true;
}
