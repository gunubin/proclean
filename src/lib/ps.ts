import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessInfo } from "./types.js";

const execFileAsync = promisify(execFile);

export async function getOrphanProcesses(): Promise<ProcessInfo[]> {
  const uid = process.getuid?.()?.toString() ?? "";
  if (!uid) return [];

  const { stdout } = await execFileAsync("ps", [
    "-u",
    uid,
    "-o",
    "pid=,ppid=,tty=,%cpu=,rss=,etime=,command=",
  ]);

  const processes: ProcessInfo[] = [];

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = parsePsLine(trimmed);
    if (!parsed) continue;

    // Only orphan processes (PPID=1) with no controlling terminal
    if (parsed.ppid === 1 && parsed.tty === "??") {
      processes.push(parsed);
    }
  }

  return processes;
}

function parsePsLine(line: string): ProcessInfo | null {
  // Format: PID PPID TTY %CPU RSS ELAPSED COMMAND...
  // Fields are whitespace-separated, but COMMAND can contain spaces
  const match = line.match(
    /^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(.+)$/,
  );
  if (!match) return null;

  return {
    pid: parseInt(match[1], 10),
    ppid: parseInt(match[2], 10),
    tty: match[3],
    cpu: parseFloat(match[4]),
    rss: parseInt(match[5], 10),
    elapsed: match[6],
    command: match[7]
      .replace(/[\x00-\x1f]/g, " ")
      .replace(/\\0[0-7]{2}/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}
