import { useState, useCallback } from "react";
import type { KillResult } from "../lib/types.js";

export function useKill() {
  const [results, setResults] = useState<KillResult[]>([]);
  const [killing, setKilling] = useState(false);

  const killProcesses = useCallback(async (pids: number[]) => {
    setKilling(true);
    const killResults: KillResult[] = [];

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
        killResults.push({ pid, success: true });
      } catch (e) {
        killResults.push({
          pid,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    setResults(killResults);
    setKilling(false);
    return killResults;
  }, []);

  return { killProcesses, results, killing };
}
