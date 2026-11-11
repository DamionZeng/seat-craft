/// <reference lib="webworker" />
import { solve } from './solver';
import type { SolveInput } from '../types';

self.onmessage = (event: MessageEvent<{ id: number; input: SolveInput }>) => {
  const { id, input } = event.data;
  try {
    const result = solve(input);
    (self as any).postMessage({ id, result });
  } catch (error) {
    (self as any).postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
