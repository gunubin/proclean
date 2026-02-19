import { Box, Text } from "ink";
import type { ProcessInfo } from "../lib/types.js";

interface ProcessRowProps {
  process: ProcessInfo;
  selected: boolean;
  highlighted: boolean;
}

function formatMem(rssKb: number): string {
  const mb = rssKb / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}G`;
  return `${Math.round(mb)}M`;
}

function truncateCommand(cmd: string, maxLen: number): string {
  if (cmd.length <= maxLen) return cmd;
  return cmd.slice(0, maxLen - 3) + "...";
}

export function ProcessRow({ process: proc, selected, highlighted }: ProcessRowProps) {
  const indicator = selected ? "●" : "○";
  const cursor = highlighted ? ">" : " ";
  const cpuColor = proc.cpu > 5 ? "red" : proc.cpu > 1 ? "yellow" : undefined;
  const indicatorColor = selected ? "green" : "gray";

  const line = `${cursor}${indicator} ${String(proc.pid).padEnd(7)} ${proc.cpu.toFixed(1).padStart(5)}  ${formatMem(proc.rss).padStart(5)}  ${proc.elapsed.padStart(12)}  ${truncateCommand(proc.command, 45)}`;

  if (highlighted) {
    return (
      <Box>
        <Text color="cyan" bold inverse>
          {line}
        </Text>
      </Box>
    );
  }

  return (
    <Box gap={0}>
      <Text>{cursor}</Text>
      <Text color={indicatorColor}>{indicator}</Text>
      <Text> {String(proc.pid).padEnd(7)} </Text>
      <Text color={cpuColor}>{proc.cpu.toFixed(1).padStart(5)}</Text>
      <Text>  {formatMem(proc.rss).padStart(5)}  </Text>
      <Text dimColor>{proc.elapsed.padStart(12)}</Text>
      <Text>  {truncateCommand(proc.command, 45)}</Text>
    </Box>
  );
}
