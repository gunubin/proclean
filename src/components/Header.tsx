import { Box, Text } from "ink";
import type { Mode } from "../lib/types.js";

interface HeaderProps {
  mode: Mode;
  processCount: number;
  selectedCount: number;
  searchMode: boolean;
  searchQuery: string;
}

export function Header({
  mode,
  processCount,
  selectedCount,
  searchMode,
  searchQuery,
}: HeaderProps) {
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" paddingX={1}>
        <Box gap={1}>
          <Text bold color="cyan">
            proclean
          </Text>
          <Text color={mode === "dev" ? "yellow" : "red"}>
            [{mode}]
          </Text>
          <Text dimColor>
            {processCount} processes
          </Text>
        </Box>
        <Box gap={1}>
          {selectedCount > 0 && (
            <Text color="green">{selectedCount} selected</Text>
          )}
          <Text dimColor>q:quit</Text>
        </Box>
      </Box>
      {searchMode ? (
        <Box paddingX={1}>
          <Text color="yellow">/</Text>
          <Text>{searchQuery}</Text>
          <Text color="yellow">▌</Text>
        </Box>
      ) : (
        <Box paddingX={1} gap={2}>
          <Text dimColor>/:search</Text>
          <Text dimColor>space:select</Text>
          <Text dimColor>enter:kill</Text>
          <Text dimColor>a:all</Text>
          <Text dimColor>tab:preview</Text>
        </Box>
      )}
    </Box>
  );
}
