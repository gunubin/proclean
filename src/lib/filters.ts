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

  // Node.js package managers / runners
  if (/^(npm|npx|pnpm|yarn|bun|tsx|ts-node)(\s|$)/.test(cmd)) return true;

  // Standalone node process
  if (cmd === "node" || cmd.startsWith("node ")) return true;

  // Python
  if (/^python[23]?(\s|$)/.test(cmd)) return true;
  if (cmd.includes(".pyenv")) return true;

  // Deno
  if (/^deno(\s|$)/.test(cmd)) return true;

  // Go
  if (/^go(\s|$)/.test(cmd)) return true;

  // Version managers
  if (cmd.includes(".volta")) return true;
  if (cmd.includes(".asdf")) return true;
  if (cmd.includes(".mise")) return true;

  // Claude-related (tmux watcher pattern: /tmp/claude-tmux/)
  if (cmd.includes("claude-tmux") || cmd.includes("claude_")) return true;

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
