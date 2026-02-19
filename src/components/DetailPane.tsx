import { Box, Text } from "ink";
import type { ProcessInfo } from "../lib/types.js";

interface DetailPaneProps {
  process: ProcessInfo | null;
}

function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    lines.push(text.slice(i, i + width));
  }
  return lines.length > 0 ? lines : [""];
}

export function DetailPane({ process: proc }: DetailPaneProps) {
  if (!proc) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        width={35}
      >
        <Text dimColor>No process selected</Text>
      </Box>
    );
  }

  const cmdLines = wrapText(proc.command, 30);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
      width={35}
    >
      <Box>
        <Text dimColor>PID: </Text>
        <Text bold>{proc.pid}</Text>
      </Box>
      <Box>
        <Text dimColor>PPID: </Text>
        <Text>{proc.ppid}</Text>
      </Box>
      <Box>
        <Text dimColor>CPU: </Text>
        <Text color={proc.cpu > 5 ? "red" : undefined}>{proc.cpu}%</Text>
      </Box>
      <Box>
        <Text dimColor>MEM: </Text>
        <Text>{Math.round(proc.rss / 1024)}MB</Text>
      </Box>
      <Box>
        <Text dimColor>Elapsed: </Text>
        <Text>{proc.elapsed}</Text>
      </Box>
      <Text> </Text>
      <Text dimColor>Command:</Text>
      {cmdLines.map((line, i) => (
        <Text key={i} color="white">
          {line}
        </Text>
      ))}
    </Box>
  );
}
