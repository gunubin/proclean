import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import meow from "meow";
import { getOrphanProcesses } from "./lib/ps.js";
import { devFilter, allFilter } from "./lib/filters.js";
import type { Mode, ProcessInfo } from "./lib/types.js";

const cli = meow(
  `
  Usage
    $ proclean [options]

  Options
    -a, --all    Show all orphan processes (not just dev tools)
    -h, --help   Show this help

  Examples
    $ proclean        # dev mode: Claude Code, node, cargo, etc.
    $ proclean -a     # all mode: everything except system processes
`,
  {
    importMeta: import.meta,
    flags: {
      all: {
        type: "boolean",
        shortFlag: "a",
        default: false,
      },
    },
  },
);

// ── ANSI helpers ──────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// ── Format helpers ────────────────────────────────────────
function formatMem(rssKb: number): string {
  const mb = rssKb / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}G`;
  return `${Math.round(mb)}M`;
}

function cpuColor(cpu: number): string {
  if (cpu > 5) return c.red;
  if (cpu > 1) return c.yellow;
  return "";
}

function formatHeader(): string {
  return `${c.dim}${"PID".padEnd(7)} ${"CPU%".padStart(5)}  ${"MEM".padStart(6)}  ${"ELAPSED".padStart(14)}  COMMAND${c.reset}`;
}

function formatLine(proc: ProcessInfo, ttyOrphan = false): string {
  const cpu = cpuColor(proc.cpu);
  const cpuStr = proc.cpu.toFixed(1).padStart(5);
  const mem = formatMem(proc.rss).padStart(6);
  const elapsed = proc.elapsed.padStart(14);
  const cmd =
    proc.command.length > 50
      ? proc.command.slice(0, 47) + "..."
      : proc.command;

  const line = [
    `${c.bold}${String(proc.pid).padEnd(7)}${c.reset}`,
    `${cpu}${cpuStr}${c.reset}`,
    ` ${mem}`,
    `  ${c.dim}${elapsed}${c.reset}`,
    `  ${cmd}`,
  ].join("");

  // TTY-attached orphans: wrap entire line in yellow for visual distinction
  return ttyOrphan ? `${c.yellow}${line}${c.reset}` : line;
}

function splitByTty(processes: ProcessInfo[]): {
  normal: ProcessInfo[];
  ttyAttached: ProcessInfo[];
} {
  const normal: ProcessInfo[] = [];
  const ttyAttached: ProcessInfo[] = [];
  for (const p of processes) {
    if (p.tty === "??") {
      normal.push(p);
    } else {
      ttyAttached.push(p);
    }
  }
  return { normal, ttyAttached };
}

// ── Wait for any keypress (raw mode) ─────────────────────
function waitForKey(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

// ── fzf preview command (wrapped in bash for fish compatibility) ──
function buildPreviewCmd(): string {
  const script = [
    'pid=$1',
    'case "$pid" in ""|*[!0-9]*) printf "\\n\\033[2m  Not a process line\\033[0m\\n"; exit 0 ;; esac',
    'w=${FZF_PREVIEW_COLUMNS:-50}',
    'hr() { printf "\\033[1;36m  "; printf "─%.0s" $(seq 1 $((w - 4))); printf "\\033[0m\\n"; }',
    'section() { local t=" $1 "; local tl=${#t}; local rl=$((w - 4 - tl)); printf "\\033[1;36m  ─── %s " "$1"; printf "─%.0s" $(seq 1 $rl); printf "\\033[0m\\n"; }',
    '',
    'info=$(ps -p $pid -o pid=,ppid=,stat=,%cpu=,%mem=,rss=,lstart= 2>/dev/null)',
    'if [ -z "$info" ]; then',
    '  printf "\\033[31m  Process $pid no longer exists\\033[0m\\n"',
    '  exit 0',
    'fi',
    '',
    'etime=$(ps -p $pid -o etime= 2>/dev/null | sed "s/^ *//")',
    'cpu=$(ps -p $pid -o %cpu= 2>/dev/null | sed "s/^ *//")',
    'mem=$(ps -p $pid -o %mem= 2>/dev/null | sed "s/^ *//")',
    'rss=$(ps -p $pid -o rss= 2>/dev/null | sed "s/^ *//")',
    'stat=$(ps -p $pid -o stat= 2>/dev/null | sed "s/^ *//")',
    'lstart=$(ps -p $pid -o lstart= 2>/dev/null | sed "s/^ *//")',
    'rss_mb=$((rss / 1024))',
    '',
    'printf "\\n"',
    'section "Process"',
    'printf "\\033[2m  %-10s\\033[0;1m%s\\033[0m\\n" "PID" "$pid"',
    'printf "\\033[2m  %-10s\\033[0m%s\\n" "PPID" "1 (orphan)"',
    'printf "\\033[2m  %-10s\\033[0m%s\\n" "State" "$stat"',
    'printf "\\033[2m  %-10s\\033[0m%s%%\\n" "CPU" "$cpu"',
    'printf "\\033[2m  %-10s\\033[0m%s MB  (%s%%)\\n" "Memory" "$rss_mb" "$mem"',
    'printf "\\033[2m  %-10s\\033[0m%s\\n" "Started" "$lstart"',
    'printf "\\033[2m  %-10s\\033[0m%s\\n" "Elapsed" "$etime"',
    'printf "\\n"',
    '',
    'cmd=$(ps -p $pid -o command= 2>/dev/null)',
    'section "Command"',
    'echo "  $cmd" | fold -s -w $((w - 4))',
    'printf "\\n"',
    '',
    'nfiles=$(lsof -p $pid 2>/dev/null | wc -l | sed "s/^ *//")',
    'if [ "$nfiles" -gt 0 ]; then',
    '  section "Open Files ($nfiles)"',
    '  lsof -p $pid -Fn 2>/dev/null | grep "^n/" | head -8 | sed "s/^n/  /"',
    'fi',
  ].join("\n");

  return `bash -c '${script.replace(/'/g, "'\\''")}' -- {1}`;
}

// ── List mode (internal: outputs formatted list for fzf reload) ──
async function listMode(mode: Mode): Promise<void> {
  const all = await getOrphanProcesses();
  const filter = mode === "dev" ? devFilter : allFilter;
  const processes = all.filter(filter);
  const { normal, ttyAttached } = splitByTty(processes);

  const lines: string[] = [formatHeader()];
  if (processes.length === 0) {
    lines.push(`${c.dim}  No orphan processes found.${c.reset}`);
  } else {
    lines.push(...normal.map((p) => formatLine(p)));
    if (ttyAttached.length > 0) {
      lines.push(
        `${c.yellow}${c.bold}  ⚠ TTY-attached orphans (may still be active)${c.reset}`,
      );
      lines.push(...ttyAttached.map((p) => formatLine(p, true)));
    }
  }
  process.stdout.write(lines.join("\n") + "\n");
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const mode: Mode = cli.flags.all ? "all" : "dev";

  // Internal --_list flag: output formatted list for fzf reload
  if (process.argv.includes("--_list")) {
    await listMode(mode);
    return;
  }

  // Check fzf availability
  try {
    execFileSync("which", ["fzf"], { stdio: "ignore" });
  } catch {
    console.error(`${c.red}fzf is required.${c.reset} Install: brew install fzf`);
    console.error(`${c.dim}Press any key to close${c.reset}`);
    await waitForKey();
    process.exit(1);
  }

  const all = await getOrphanProcesses();
  const filter = mode === "dev" ? devFilter : allFilter;
  const processes = all.filter(filter);
  const { normal, ttyAttached } = splitByTty(processes);

  // Build reload command for fzf
  const scriptPath = fileURLToPath(import.meta.url);
  const modeFlag = mode === "all" ? " -a" : "";
  const reloadCmd = `node "${scriptPath}" --_list${modeFlag}`;

  // Table header + data lines
  const lines: string[] = [formatHeader()];
  if (processes.length === 0) {
    lines.push(`${c.dim}  No orphan processes found.${c.reset}`);
  } else {
    lines.push(...normal.map((p) => formatLine(p)));
    if (ttyAttached.length > 0) {
      lines.push(
        `${c.yellow}${c.bold}  ⚠ TTY-attached orphans (may still be active)${c.reset}`,
      );
      lines.push(...ttyAttached.map((p) => formatLine(p, true)));
    }
  }
  const input = lines.join("\n");
  const listLabel =
    processes.length === 0
      ? " 0 orphan processes "
      : ` ${processes.length} orphan processes `;

  // Spawn fzf (--style=full matching tmux popup conventions)
  const fzf = spawn(
    "fzf",
    [
      "--multi",
      "--ansi",
      "--style=full",
      "--header-lines=1",
      "--input-label",
      ` proclean [${mode}] `,
      "--list-label",
      listLabel,
      "--header-label",
      " TAB:select  Enter:kill  ^A:all  ^C:quit ",
      "--preview",
      buildPreviewCmd(),
      "--preview-window",
      "right:48%:wrap",
      "--preview-label",
      " Details ",
      "--pointer",
      "▶ ",
      "--marker",
      "● ",
      "--bind",
      "ctrl-a:toggle-all",
      "--bind",
      `enter:execute-silent(bash -c 'for p in {+1}; do case "$p" in ""|*[!0-9]*) continue ;; esac; kill -TERM $p 2>/dev/null; done; sleep 0.3; for p in {+1}; do case "$p" in ""|*[!0-9]*) continue ;; esac; kill -0 $p 2>/dev/null && kill -9 $p 2>/dev/null; done; sleep 0.1')+reload(${reloadCmd})`,
      "--color",
      "spinner:#F2D5CF,hl:#E78284",
      "--color",
      "fg:#C6D0F5,header:#E78284,info:#CA9EE6,pointer:#F2D5CF",
      "--color",
      "marker:#BABBF1,fg+:#C6D0F5,prompt:#CA9EE6,hl+:#E78284",
      "--color",
      "bg+:#51576D",
      "--highlight-line",
      "--color",
      "selected-fg:#C6D0F5,selected-bg:#414559",
      "--color",
      "alt-bg:#353a4a",
      "--gap=0",
      "--gap-line", "┈",
      "--header-border",
      "--color",
      "header-border:#737994,header-label:#C6D0F5",
      "--color",
      "border:#303446,label:#C6D0F5",
      "--color",
      "preview-border:#9999cc,preview-label:#ccccff",
      "--color",
      "list-border:#bfe7bb,list-label:#99cc99",
      "--color",
      "input-border:#f6cce7,input-label:#ffcccc",
    ],
    {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env, FZF_DEFAULT_OPTS: "" },
    },
  );

  fzf.stdin.write(input);
  fzf.stdin.end();

  await new Promise<void>((resolve) => {
    fzf.on("close", () => resolve());
    fzf.on("error", async (err) => {
      console.error(`${c.red}fzf error:${c.reset} ${err.message}`);
      console.error(`${c.dim}Press any key to close${c.reset}`);
      await waitForKey();
      resolve();
    });
  });
}

main().catch(async (e) => {
  console.error(e);
  console.error(`${c.dim}Press any key to close${c.reset}`);
  await waitForKey();
  process.exit(1);
});
