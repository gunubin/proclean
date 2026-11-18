import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessInfo } from "./types.js";

const execFileAsync = promisify(execFile);

async function run(cmd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { maxBuffer: 32 * 1024 * 1024 });
    return stdout;
  } catch (e) {
    // lsof は一部のプロセスが読めないと 1 で終わるが、出力は使える
    return (e as { stdout?: string }).stdout ?? "";
  }
}

/** 自分のユーザーの全プロセス（1 回の ps で取る） */
export async function getProcessTable(): Promise<ProcessInfo[]> {
  const uid = process.getuid?.()?.toString() ?? "";
  if (!uid) return [];
  const stdout = await run("ps", ["-u", uid, "-o", "pid=,ppid=,stat=,tty=,%cpu=,rss=,etime=,command="]);
  const out: ProcessInfo[] = [];
  for (const line of stdout.split("\n")) {
    const p = parsePsLine(line);
    if (p) out.push(p);
  }
  return out;
}

export function parsePsLine(line: string): ProcessInfo | null {
  // PID PPID STAT TTY %CPU RSS ELAPSED COMMAND...（COMMAND は空白を含む）
  const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/);
  if (!m) return null;
  return {
    pid: Number(m[1]),
    ppid: Number(m[2]),
    stat: m[3],
    tty: m[4],
    cpu: Number(m[5]),
    rss: Number(m[6]),
    elapsed: m[7],
    command: m[8]
      .replace(/[\x00-\x1f]/g, " ")
      .replace(/\\0[0-7]{2}/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/** launchd のジョブとして正式に動いているプロセス（LaunchAgents・ログイン項目）。孤児ではない */
export async function getLaunchdJobPids(): Promise<Set<number>> {
  const stdout = await run("launchctl", ["list"]);
  const pids = new Set<number>();
  for (const line of stdout.split("\n").slice(1)) {
    const pid = Number(line.split("\t")[0]);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return pids;
}

/** pid → LISTEN しているポート */
export async function getListeningPorts(): Promise<Map<number, number[]>> {
  const stdout = await run("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]);
  const map = new Map<number, number[]>();
  let pid = 0;
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n")) {
      const port = Number(line.slice(line.lastIndexOf(":") + 1));
      if (!port) continue;
      const list = map.get(pid) ?? [];
      if (!list.includes(port)) list.push(port);
      map.set(pid, list);
    }
  }
  return map;
}

/** pid → 作業フォルダ（まとめて 1 回の lsof で取る） */
export async function getCwds(pids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (pids.length === 0) return map;
  const stdout = await run("lsof", ["-a", "-d", "cwd", "-p", pids.join(","), "-Fpn"]);
  let pid = 0;
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n")) map.set(pid, line.slice(1));
  }
  return map;
}
