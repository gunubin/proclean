import { getProcessTable } from "./ps.js";
import { childrenMap, descendantsOf } from "./orphans.js";

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 選んだプロセスを、子・孫ごと止める。
 * 親だけ止めると子が新しい孤児として残る（npm exec を止めても node が残る、など）。
 * 子から先に SIGTERM を送り、最大 graceMs 待って、残ったものだけ SIGKILL する。
 */
export async function killTrees(pids: number[], graceMs = 3000): Promise<{ killed: number[]; forced: number[] }> {
  const table = await getProcessTable();
  const children = childrenMap(table);
  const targets: number[] = [];
  for (const pid of pids) {
    if (pid <= 1 || pid === process.pid) continue;
    // 子孫を先に、自分を最後に
    for (const d of descendantsOf(pid, children).reverse()) targets.push(d.pid);
    targets.push(pid);
  }
  const unique = [...new Set(targets)];

  for (const pid of unique) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* もういない */
    }
  }

  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline && unique.some(alive)) await sleep(100);

  const forced: number[] = [];
  for (const pid of unique.filter(alive)) {
    try {
      process.kill(pid, "SIGKILL");
      forced.push(pid);
    } catch {
      /* もういない */
    }
  }
  return { killed: unique, forced };
}
