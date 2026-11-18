import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import meow from "meow";
import { scan, type Scan } from "./lib/orphans.js";
import { killTrees } from "./lib/kill.js";
import type { Mode, Orphan, Zombie } from "./lib/types.js";

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

const home = process.env.HOME ?? "";
const tilde = (path: string) => (home && path.startsWith(home) ? "~" + path.slice(home.length) : path);
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function formatHeader(): string {
  return `${c.dim}${"PID".padEnd(7)} ${"CPU%".padStart(5)}  ${"MEM".padStart(6)}  ${"ELAPSED".padStart(12)}  WHAT${c.reset}`;
}

/** node・python などは、実行しているスクリプト（パッケージ名とファイル名）を出す */
function shortCommand(command: string): string {
  const [exe, ...rest] = command.split(" ");
  const base = exe.split("/").pop() ?? exe;
  if (!/^(node|python[\d.]*|Python|java|bun|deno|ruby)$/.test(base) || rest.length === 0) return tilde(command);
  const script = rest.find((a) => a.includes("/")) ?? rest.join(" ");
  const pkg = script.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1];
  const file = script.split("/").pop();
  const args = rest.filter((a) => a !== script).join(" ");
  return `${base} ${pkg ? `${pkg}/…/${file}` : tilde(script)}${args ? " " + args : ""}`;
}

/** 何のプロセスかを短く。Claude の裏のセッションは作業フォルダ、それ以外はコマンドと作業フォルダ */
function describe(o: Orphan): string {
  const where = o.cwd && o.cwd !== "/" ? `${c.dim} · ${tilde(o.cwd)}${c.reset}` : "";
  const ports = o.ports.length ? `${c.green}:${o.ports.join(",:")}${c.reset} ` : "";
  const kids = o.descendants.length ? `${c.dim} (+${o.descendants.length})${c.reset}` : "";
  if (o.kind === "claude-bg") return `${c.cyan}Claude bg session${c.reset}${kids}${where}`;
  const cmd = clip(shortCommand(o.proc.command), 56);
  const tty = o.kind === "tty" ? `${c.yellow}[${o.proc.tty}]${c.reset} ` : "";
  return `${tty}${ports}${cmd}${kids}${where}`;
}

function formatLine(o: Orphan): string {
  return [
    `${c.bold}${String(o.proc.pid).padEnd(7)}${c.reset}`,
    `${cpuColor(o.treeCpu)}${o.treeCpu.toFixed(1).padStart(5)}${c.reset}`,
    `  ${formatMem(o.treeRss).padStart(6)}`,
    `  ${c.dim}${o.proc.elapsed.padStart(12)}${c.reset}`,
    `  ${describe(o)}`,
  ].join("");
}

function formatZombie(z: Zombie): string {
  const parent = z.parent ? `${z.parent.pid} ${clip(tilde(z.parent.command), 40)}` : String(z.proc.ppid);
  // 先頭が数字でない行は kill の対象にしない（ゾンビは止められない。親が回収する）
  return `${c.red}Z${c.reset}${c.dim}      ${String(z.proc.pid).padEnd(7)} zombie · parent ${parent}${c.reset}`;
}

function buildList(result: Scan): { text: string; label: string } {
  const { orphans, zombies } = result;
  const lines: string[] = [formatHeader()];
  if (orphans.length === 0) lines.push(`${c.dim}  No orphan processes found.${c.reset}`);
  lines.push(...orphans.map(formatLine));
  if (zombies.length) {
    lines.push(`${c.red}${c.bold}  ⚠ zombies (cannot be killed; stop or wait for the parent)${c.reset}`);
    lines.push(...zombies.map(formatZombie));
  }
  const total = orphans.reduce((s, o) => s + o.treeRss, 0);
  const label = ` ${orphans.length} orphans · ${formatMem(total)}${zombies.length ? ` · ${zombies.length} zombies` : ""} `;
  return { text: lines.join("\n"), label };
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

// ── Preview（内部用: --_preview <pid>） ───────────────────
async function previewMode(pidArg: string | undefined): Promise<void> {
  const pid = Number(pidArg);
  if (!Number.isInteger(pid) || pid <= 1) {
    process.stdout.write(`\n${c.dim}  Not a process line${c.reset}\n`);
    return;
  }
  const result = await scan(cli.flags.all ? "all" : "dev");
  const o = result.orphans.find((x) => x.proc.pid === pid);
  if (!o) {
    process.stdout.write(`\n${c.red}  Process ${pid} no longer exists${c.reset}\n`);
    return;
  }
  const kindText: Record<Orphan["kind"], string> = {
    "claude-bg": "Claude Code の裏のセッション（ペインなし）",
    server: "ポートを開いているサーバー（使用中かも）",
    tty: "端末につながったまま（使用中かも）",
    normal: "親のいないプロセス",
  };
  const row = (k: string, v: string) => `${c.dim}  ${k.padEnd(9)}${c.reset}${v}`;
  const out = [
    "",
    `${c.cyan}${c.bold}  ── Process${c.reset}`,
    row("PID", `${c.bold}${o.proc.pid}${c.reset}  (PPID 1)`),
    row("Kind", kindText[o.kind]),
    row("Memory", `${formatMem(o.treeRss)}  (self ${formatMem(o.proc.rss)} + ${o.descendants.length} children)`),
    row("CPU", `${o.treeCpu.toFixed(1)}%`),
    row("Elapsed", o.proc.elapsed),
    row("Cwd", o.cwd ? tilde(o.cwd) : "-"),
    row("Ports", o.ports.length ? o.ports.join(", ") : "-"),
    "",
    `${c.cyan}${c.bold}  ── Command${c.reset}`,
    `  ${tilde(o.proc.command)}`,
  ];
  if (o.descendants.length) {
    out.push("", `${c.cyan}${c.bold}  ── Children（Enter で一緒に止める）${c.reset}`);
    for (const d of [...o.descendants].sort((a, b) => b.rss - a.rss).slice(0, 12)) {
      out.push(`  ${String(d.pid).padEnd(7)} ${formatMem(d.rss).padStart(6)}  ${clip(tilde(d.command), 60)}`);
    }
  }
  process.stdout.write(out.join("\n") + "\n");
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  const mode: Mode = cli.flags.all ? "all" : "dev";

  // 内部用: fzf の reload・preview・kill から呼ばれる
  if (process.argv.includes("--_list")) {
    process.stdout.write(buildList(await scan(mode)).text + "\n");
    return;
  }
  if (process.argv.includes("--_preview")) {
    await previewMode(process.argv[process.argv.indexOf("--_preview") + 1]);
    return;
  }
  if (process.argv.includes("--_kill")) {
    const pids = process.argv
      .slice(process.argv.indexOf("--_kill") + 1)
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 1);
    await killTrees(pids);
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

  const scriptPath = fileURLToPath(import.meta.url);
  const modeFlag = mode === "all" ? " -a" : "";
  const self = `node "${scriptPath}"${modeFlag}`;
  const { text: input, label: listLabel } = buildList(await scan(mode));

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
      " TAB:select  Enter:kill (with children)  ^R:reload  ^A:all  ^C:quit ",
      "--preview",
      `${self} --_preview {1}`,
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
      `enter:execute-silent(${self} --_kill {+1})+reload(${self} --_list)+clear-selection`,
      "--bind",
      `ctrl-r:reload(${self} --_list)`,
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
