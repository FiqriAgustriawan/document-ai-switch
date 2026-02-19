import { useState, useCallback } from 'react';

export function useUndoRedo(initialState: string) {
  const [history, setHistory] = useState<string[]>([initialState]);
  const [index, setIndex] = useState(0);

  const setState = useCallback((newState: string) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, index + 1);
      newHistory.push(newState);
      return newHistory;
    });
    setIndex((prev) => prev + 1);
  }, [index]);

  const undo = useCallback(() => {
    setIndex((prev) => {
      if (prev > 0) return prev - 1;
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setIndex((prev) => {
      if (prev < history.length - 1) return prev + 1;
      return prev;
    });
  }, [history.length]);

  return {
    state: history[index],
    setState,
    undo,
    redo,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
  };
}
