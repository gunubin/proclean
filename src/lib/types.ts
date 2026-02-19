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

export type AppPhase =
  | "loading"
  | "list"
  | "confirm"
  | "killing"
  | "done"
  | "empty";

export interface KillResult {
  pid: number;
  success: boolean;
  error?: string;
}
