import { useInput } from "ink";
import { useCallback } from "react";

interface KeyBindingsOptions {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleSelect: () => void;
  onConfirm: () => void;
  onQuit: () => void;
  onSearch: () => void;
  onSelectAll: () => void;
  onTogglePreview: () => void;
  onEscape: () => void;
  enabled?: boolean;
}

export function useKeyBindings(options: KeyBindingsOptions) {
  const {
    onMoveUp,
    onMoveDown,
    onToggleSelect,
    onConfirm,
    onQuit,
    onSearch,
    onSelectAll,
    onTogglePreview,
    onEscape,
    enabled = true,
  } = options;

  useInput(
    useCallback(
      (input, key) => {
        if (key.escape) {
          onEscape();
          return;
        }

        if (input === "q") {
          onQuit();
          return;
        }

        if (input === "k" || key.upArrow) {
          onMoveUp();
          return;
        }

        if (input === "j" || key.downArrow) {
          onMoveDown();
          return;
        }

        if (input === " ") {
          onToggleSelect();
          return;
        }

        if (key.return) {
          onConfirm();
          return;
        }

        if (input === "/") {
          onSearch();
          return;
        }

        if (input === "a") {
          onSelectAll();
          return;
        }

        if (key.tab) {
          onTogglePreview();
          return;
        }
      },
      [
        onMoveUp,
        onMoveDown,
        onToggleSelect,
        onConfirm,
        onQuit,
        onSearch,
        onSelectAll,
        onTogglePreview,
        onEscape,
      ],
    ),
    { isActive: enabled },
  );
}
