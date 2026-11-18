import type { ProcessInfo } from "./types.js";

/**
 * 親が PID 1 でも、止めると困る常駐。どちらのモードでも出さない。
 * tmux のサーバーを止めると全部のペインが消え、子ごと止める kill では被害がさらに広がる。
 */
export function isProtected(proc: ProcessInfo): boolean {
  const cmd = proc.command;
  return (
    /^(\S*\/)?tmux(\s|$)/.test(cmd) ||
    /^(\S*\/)?(zellij|screen)(\s|$)/.test(cmd) ||
    /^(\S*\/)?op daemon/.test(cmd) ||
    /^(\S*\/)?adb .*fork-server/.test(cmd) ||
    /^(\S*\/)?(ssh-agent|gpg-agent)(\s|$)/.test(cmd) ||
    // agent-device の共通の常駐（端末の操作で全部のセッションが使う）
    /agent-device\/dist\/src\/internal\/daemon\.js/.test(cmd) ||
    /\.app\/Contents\/MacOS\/[^/]+$/.test(cmd.split(" -")[0])
  );
}

/** dev mode: whitelist - only show known dev tool orphans */
export function devFilter(proc: ProcessInfo): boolean {
  const cmd = proc.command;

  // Claude Code
  if (cmd.includes(".local/share/claude")) return true;

  // Node.js ecosystem
  if (cmd.includes(".npm")) return true;
  if (cmd.includes(".nvm") || cmd.includes("/nvm/")) return true;
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

  // Claude Code の裏のセッション（bg-pty-host）
  if (/^claude\s/.test(cmd)) return true;

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
