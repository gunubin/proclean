import { useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "@inkjs/ui";
import { Header } from "./components/Header.js";
import { ProcessTable } from "./components/ProcessTable.js";
import { useProcessList } from "./hooks/useProcessList.js";
import { useKill } from "./hooks/useKill.js";
import { useKeyBindings } from "./hooks/useKeyBindings.js";
import type { Mode, AppPhase, KillResult } from "./lib/types.js";

interface AppProps {
  mode: Mode;
}

export function App({ mode }: AppProps) {
  const { exit } = useApp();
  const { processes, loading, error, refresh } = useProcessList(mode);
  const { killProcesses, results } = useKill();

  const [phase, setPhase] = useState<AppPhase>("loading");
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter processes by search query
  const filteredProcesses = useMemo(() => {
    if (!searchQuery) return processes;
    const q = searchQuery.toLowerCase();
    return processes.filter(
      (p) =>
        p.command.toLowerCase().includes(q) ||
        String(p.pid).includes(q),
    );
  }, [processes, searchQuery]);

  // Update phase based on loading state
  if (loading && phase === "loading") {
    // stay in loading
  } else if (!loading && phase === "loading") {
    if (processes.length === 0) {
      setPhase("empty");
    } else {
      setPhase("list");
    }
  }

  // Search mode input handler
  useInput(
    (input, key) => {
      if (key.escape || key.return) {
        setSearchMode(false);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        setCursor(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + input);
        setCursor(0);
      }
    },
    { isActive: searchMode },
  );

  const handleMoveUp = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const handleMoveDown = useCallback(() => {
    setCursor((c) => Math.min(filteredProcesses.length - 1, c + 1));
  }, [filteredProcesses.length]);

  const handleToggleSelect = useCallback(() => {
    const proc = filteredProcesses[cursor];
    if (!proc) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(proc.pid)) {
        next.delete(proc.pid);
      } else {
        next.add(proc.pid);
      }
      return next;
    });
  }, [cursor, filteredProcesses]);

  const handleSelectAll = useCallback(() => {
    if (selected.size === filteredProcesses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredProcesses.map((p) => p.pid)));
    }
  }, [filteredProcesses, selected.size]);

  const handleConfirm = useCallback(() => {
    const pidsToKill =
      selected.size > 0
        ? [...selected]
        : filteredProcesses[cursor]
          ? [filteredProcesses[cursor].pid]
          : [];
    if (pidsToKill.length === 0) return;
    setPhase("confirm");
  }, [selected, filteredProcesses, cursor]);

  const handleQuit = useCallback(() => {
    exit();
  }, [exit]);

  const handleSearch = useCallback(() => {
    setSearchMode(true);
  }, []);

  const handleTogglePreview = useCallback(() => {
    setShowPreview((p) => !p);
  }, []);

  const handleEscape = useCallback(() => {
    if (searchMode) {
      setSearchMode(false);
      setSearchQuery("");
      return;
    }
    if (phase === "confirm") {
      setPhase("list");
    }
  }, [searchMode, phase]);

  useKeyBindings({
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onToggleSelect: handleToggleSelect,
    onConfirm: handleConfirm,
    onQuit: handleQuit,
    onSearch: handleSearch,
    onSelectAll: handleSelectAll,
    onTogglePreview: handleTogglePreview,
    onEscape: handleEscape,
    enabled: !searchMode && phase === "list",
  });

  // Confirm phase input
  useInput(
    (input, key) => {
      if (input === "y" || input === "Y") {
        setPhase("killing");
        const pidsToKill =
          selected.size > 0
            ? [...selected]
            : filteredProcesses[cursor]
              ? [filteredProcesses[cursor].pid]
              : [];
        killProcesses(pidsToKill).then(() => {
          setPhase("done");
        });
      } else if (input === "n" || input === "N" || key.escape) {
        setPhase("list");
      }
    },
    { isActive: phase === "confirm" },
  );

  // Done phase input
  useInput(
    (_input, key) => {
      if (key.return || _input === "q") {
        exit();
      } else if (_input === "r") {
        setSelected(new Set());
        setCursor(0);
        setPhase("loading");
        refresh();
      }
    },
    { isActive: phase === "done" },
  );

  // --- Render ---

  if (phase === "loading") {
    return (
      <Box paddingX={1} paddingY={1}>
        <Spinner label="Scanning orphan processes..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box paddingX={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    );
  }

  if (phase === "empty") {
    return (
      <Box paddingX={1} paddingY={1} flexDirection="column">
        <Text color="green">No orphan processes found.</Text>
        <Text dimColor>
          Mode: {mode} | Nothing to clean up
        </Text>
      </Box>
    );
  }

  const pidsToKill =
    selected.size > 0
      ? [...selected]
      : filteredProcesses[cursor]
        ? [filteredProcesses[cursor].pid]
        : [];

  return (
    <Box flexDirection="column">
      <Header
        mode={mode}
        processCount={filteredProcesses.length}
        selectedCount={selected.size}
        searchMode={searchMode}
        searchQuery={searchQuery}
      />
      <Box paddingX={1}>
        <Text dimColor>{"─".repeat(70)}</Text>
      </Box>
      <ProcessTable
        processes={filteredProcesses}
        cursor={cursor}
        selected={selected}
        showPreview={showPreview}
      />
      <Box paddingX={1}>
        <Text dimColor>{"─".repeat(70)}</Text>
      </Box>
      {/* Footer */}
      {phase === "confirm" && (
        <Box paddingX={1}>
          <Text color="yellow">
            Kill {pidsToKill.length} process(es)? [y/N]{" "}
          </Text>
          <Text dimColor>
            PIDs: {pidsToKill.join(", ")}
          </Text>
        </Box>
      )}
      {phase === "killing" && (
        <Box paddingX={1}>
          <Spinner label={`Killing ${pidsToKill.length} process(es)...`} />
        </Box>
      )}
      {phase === "done" && <DoneView results={results} />}
      {phase === "list" && (
        <Box paddingX={1}>
          <Text dimColor>
            {selected.size > 0
              ? `${selected.size} selected`
              : "No selection (enter kills highlighted)"}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function DoneView({ results }: { results: KillResult[] }) {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  return (
    <Box flexDirection="column" paddingX={1}>
      {succeeded.length > 0 && (
        <Text color="green">
          Killed: {succeeded.map((r) => r.pid).join(", ")}
        </Text>
      )}
      {failed.length > 0 &&
        failed.map((r) => (
          <Text key={r.pid} color="red">
            Failed PID {r.pid}: {r.error}
          </Text>
        ))}
      <Text dimColor>Press r to refresh, q to quit</Text>
    </Box>
  );
}
