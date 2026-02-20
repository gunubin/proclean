export interface ProcessInfo {
  pid: number;
  ppid: number;
  tty: string;
  cpu: number;
  /** RSS in KB */
  rss: number;
  elapsed: string;
  command: string;
}

export type Mode = "dev" | "all";
