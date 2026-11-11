import type { Assignment, LayoutConfig, Rule, Student } from '../types';
import type { AiSettings } from '../lib/semantic/ai';

export interface PersistedState {
  version: 1;
  className: string;
  students: Student[];
  layout: LayoutConfig;
  rules: Rule[];
  assignment: Assignment;
  aiSettings: AiSettings;
  view: 'teacher' | 'student';
  savedAt: number;
}

const KEY = 'seatcraft.state.v1';
const VERSIONS_KEY = 'seatcraft.versions.v1';

/** 手动保存的方案快照 */
export interface VersionSnapshot {
  id: string;
  name: string;
  createdAt: number;
  className: string;
  students: Student[];
  layout: LayoutConfig;
  rules: Rule[];
  assignment: Assignment;
  score: number;
}

function isVersionList(value: unknown): value is VersionSnapshot[] {
  return Array.isArray(value) && value.every((v) => !!v && typeof v.id === 'string');
}

export function loadVersions(): VersionSnapshot[] {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!isVersionList(parsed)) return [];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveVersions(versions: VersionSnapshot[]): void {
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
  } catch {
    // 容量不足时静默失败，不阻断操作
  }
}

/** 仓储接口：Web 预览用 localStorage，桌面端可替换为 SQLite 实现 */
export interface SeatRepository {
  load(): PersistedState | null;
  save(state: PersistedState): void;
  clear(): void;
}

export const localRepository: SeatRepository = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedState;
      if (!parsed || parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    } catch {
      // 容量不足时静默失败，不阻断操作
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
