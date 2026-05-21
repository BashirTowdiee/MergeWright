import React from "react";
import { Box, Text } from "ink";
import { formatStatusLegend } from "./status.js";

export interface AppChromeProps {
  branch?: string;
  mode: string;
  layoutSummary: string;
  focusBreadcrumb: string;
  notice: string;
  helpLine: string;
  children: React.ReactNode;
}

export function AppChrome({ branch, mode, layoutSummary, focusBreadcrumb, notice, helpLine, children }: AppChromeProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text bold>MergeWright</Text>
          <Text>  Branch: {branch ?? "unknown"}</Text>
          <Text>  Mode: {mode}</Text>
        </Box>
        <Text dimColor>{layoutSummary}</Text>
        <Text dimColor>{focusBreadcrumb}</Text>
      </Box>
      {children}
      <Box marginTop={1}>
        <Text>{notice}</Text>
      </Box>
      <Box>
        <Text dimColor>Status: {formatStatusLegend()}</Text>
      </Box>
      <Box>
        <Text dimColor>{helpLine}</Text>
      </Box>
    </Box>
  );
}
