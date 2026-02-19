import { useState, useEffect, useCallback } from "react";
import { getOrphanProcesses } from "../lib/ps.js";
import { devFilter, allFilter } from "../lib/filters.js";
import type { ProcessInfo, Mode } from "../lib/types.js";

export function useProcessList(mode: Mode) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getOrphanProcesses();
      const filter = mode === "dev" ? devFilter : allFilter;
      setProcesses(all.filter(filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { processes, loading, error, refresh };
}
