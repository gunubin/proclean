import { devFilter, allFilter, isProtected } from "./filters.js";
import { getCwds, getLaunchdJobPids, getListeningPorts, getProcessTable } from "./ps.js";
import type { Mode, Orphan, OrphanKind, ProcessInfo, Zombie } from "./types.js";

export function childrenMap(table: ProcessInfo[]): Map<number, ProcessInfo[]> {
  const map = new Map<number, ProcessInfo[]>();
  for (const p of table) {
    const list = map.get(p.ppid) ?? [];
    list.push(p);
    map.set(p.ppid, list);
  }
  return map;
}

export function descendantsOf(pid: number, children: Map<number, ProcessInfo[]>): ProcessInfo[] {
  const out: ProcessInfo[] = [];
  const stack = [...(children.get(pid) ?? [])];
  while (stack.length) {
    const p = stack.pop()!;
    out.push(p);
    stack.push(...(children.get(p.pid) ?? []));
  }
  return out;
}

function classify(proc: ProcessInfo, ports: number[]): OrphanKind {
  if (proc.command.includes("bg-pty-host")) return "claude-bg";
  if (proc.tty !== "??") return "tty";
  if (ports.length > 0) return "server";
  return "normal";
}

export interface Scan {
  orphans: Orphan[];
  zombies: Zombie[];
}

export async function scan(mode: Mode): Promise<Scan> {
  const [table, launchdPids, listening] = await Promise.all([
    getProcessTable(),
    getLaunchdJobPids(),
    getListeningPorts(),
  ]);
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const children = childrenMap(table);
  const filter = mode === "dev" ? devFilter : allFilter;

  const roots = table.filter(
    (p) => p.ppid === 1 && p.pid !== process.pid && !launchdPids.has(p.pid) && !p.stat.startsWith("Z") && !isProtected(p) && filter(p),
  );

  const orphans: Orphan[] = roots.map((proc) => {
    const descendants = descendantsOf(proc.pid, children);
    const tree = [proc, ...descendants];
    const ports = [...new Set(tree.flatMap((p) => listening.get(p.pid) ?? []))].sort((a, b) => a - b);
    return {
      proc,
      descendants,
      treeRss: tree.reduce((s, p) => s + p.rss, 0),
      treeCpu: tree.reduce((s, p) => s + p.cpu, 0),
      ports,
      kind: classify(proc, ports),
    };
  });

  // 作業フォルダは、Claude の裏のセッションなら中のセッションのものを見る
  const cwdPid = (o: Orphan) => (o.kind === "claude-bg" ? o.descendants.at(-1)?.pid ?? o.proc.pid : o.proc.pid);
  const cwds = await getCwds(orphans.map(cwdPid));
  for (const o of orphans) o.cwd = cwds.get(cwdPid(o));

  orphans.sort((a, b) => b.treeRss - a.treeRss);

  const zombies: Zombie[] = table
    .filter((p) => p.stat.startsWith("Z"))
    .map((proc) => ({ proc, parent: byPid.get(proc.ppid) }));

  return { orphans, zombies };
}
