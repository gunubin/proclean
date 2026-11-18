export interface ProcessInfo {
  pid: number;
  ppid: number;
  /** ps の STAT（Z ならゾンビ） */
  stat: string;
  tty: string;
  cpu: number;
  /** RSS in KB */
  rss: number;
  elapsed: string;
  command: string;
}

export type Mode = "dev" | "all";

/** claude-bg: Claude Code の裏のセッション / server: ポートを LISTEN 中 / tty: 端末につながったまま */
export type OrphanKind = "claude-bg" | "server" | "tty" | "normal";

export interface Orphan {
  proc: ProcessInfo;
  /** 子・孫 */
  descendants: ProcessInfo[];
  /** 自分と子孫の RSS の合計（KB） */
  treeRss: number;
  treeCpu: number;
  /** 自分か子孫が LISTEN しているポート */
  ports: number[];
  cwd?: string;
  kind: OrphanKind;
}

export interface Zombie {
  proc: ProcessInfo;
  parent?: ProcessInfo;
}
