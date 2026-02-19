import { Box, Text, useStdout } from "ink";
import { ProcessRow } from "./ProcessRow.js";
import { DetailPane } from "./DetailPane.js";
import type { ProcessInfo } from "../lib/types.js";

interface ProcessTableProps {
  processes: ProcessInfo[];
  cursor: number;
  selected: Set<number>;
  showPreview: boolean;
}

export function ProcessTable({
  processes,
  cursor,
  selected,
  showPreview,
}: ProcessTableProps) {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 24;
  // Reserve lines for header (4) + footer (2) + table header (1) + borders (2)
  const visibleRows = Math.max(3, termHeight - 9);

  // Calculate scroll window
  let scrollStart = 0;
  if (processes.length > visibleRows) {
    scrollStart = Math.max(0, Math.min(cursor - Math.floor(visibleRows / 2), processes.length - visibleRows));
  }
  const visibleProcesses = processes.slice(scrollStart, scrollStart + visibleRows);

  const highlightedProcess = processes[cursor] ?? null;

  return (
    <Box>
      <Box flexDirection="column" flexGrow={1}>
        {/* Table header */}
        <Box paddingX={1}>
          <Text dimColor bold>
            {"  "}
            {"PID".padEnd(8)}
            {"CPU%".padStart(5)}
            {"  "}
            {"MEM".padStart(5)}
            {"  "}
            {"ELAPSED".padStart(12)}
            {"  "}
            {"COMMAND"}
          </Text>
        </Box>
        <Box paddingX={1}>
          <Text dimColor>{"─".repeat(70)}</Text>
        </Box>
        {/* Process rows */}
        {visibleProcesses.map((proc) => (
          <Box key={proc.pid} paddingX={1}>
            <ProcessRow
              process={proc}
              selected={selected.has(proc.pid)}
              highlighted={proc.pid === highlightedProcess?.pid}
            />
          </Box>
        ))}
        {/* Scroll indicator */}
        {processes.length > visibleRows && (
          <Box paddingX={1} justifyContent="flex-end">
            <Text dimColor>
              {scrollStart + 1}-{Math.min(scrollStart + visibleRows, processes.length)}/{processes.length}
            </Text>
          </Box>
        )}
      </Box>
      {showPreview && <DetailPane process={highlightedProcess} />}
    </Box>
  );
}
