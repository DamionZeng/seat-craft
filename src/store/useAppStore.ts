import { create } from 'zustand';
import type {
  Assignment,
  LayoutConfig,
  Rule,
  RuleSatisfaction,
  SolveInput,
  SolveResult,
  Student,
  TagCluster,
} from '../types';
import { buildSlots } from '../lib/layout';
import { analyzeAssignment, buildContext } from '../lib/scoring';
import { solve as solveSync } from '../lib/solver';
import {
  buildComplementMatrix,
  buildLocalClusters,
  enrichTraits,
  localTraitsFromRaw,
} from '../lib/semantics';
import { DEFAULT_RULES } from '../lib/rules';
import {
  localRepository,
  loadVersions,
  saveVersions,
  type PersistedState,
  type VersionSnapshot,
} from '../lib/repository';
import { DEFAULT_AI_SETTINGS, analyzeWithAi, type AiSettings } from '../lib/semantic/ai';
import { uid } from '../lib/utils';

export type DrawerTab = 'rules' | 'layout' | null;

export const MAX_VERSIONS = 20;

export interface StudentEditorState {
  open: boolean;
  studentId?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'danger';
}

interface AppStore {
  className: string;
  students: Student[];
  layout: LayoutConfig;
  rules: Rule[];
  assignment: Assignment;
  score: number;
  satisfactions: RuleSatisfaction[];
  reasons: Record<string, string[]>;
  manualSlots: Record<string, true>;
  complement: Record<string, number>;
  clusters: TagCluster[];
  semanticMode: 'local' | 'ai';
  aiSettings: AiSettings;
  aiBusy: boolean;
  aiError: string | null;

  solving: boolean;
  lastSeed: number;
  conflicts: string[];
  warnings: string[];

  past: Assignment[];
  future: Assignment[];

  view: 'teacher' | 'student';
  zoom: 'fit' | 'actual';

  versions: VersionSnapshot[];
  versionsOpen: boolean;

  drawer: DrawerTab;
  importOpen: boolean;
  exportOpen: boolean;
  settingsOpen: boolean;
  studentEditor: StudentEditorState;
  shortcutOpen: boolean;
  selectedStudentId: string | null;
  selectedSlotId: string | null;
  toasts: ToastMessage[];

  setClassName: (name: string) => void;
  setStudents: (students: Student[]) => void;
  importStudents: (students: Student[], mode: 'append' | 'replace') => void;
  upsertStudent: (student: Student) => void;
  deleteStudent: (id: string) => void;
  setLayout: (patch: Partial<LayoutConfig>) => void;
  applyPreset: (rows: number, groups: number, deskType: 'single' | 'double') => void;
  toggleBlockedSlot: (slotId: string) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  addCustomRule: (rule: Rule) => void;
  removeRule: (id: string) => void;
  resetRules: () => void;
  solveNow: (seed?: number) => Promise<void>;
  manualSwap: (slotA: string, slotB: string) => void;
  clearSlot: (slotId: string) => void;
  assignStudentToSlot: (studentId: string, slotId: string) => void;
  toggleFixStudent: (studentId: string, slotId: string) => void;
  undo: () => void;
  redo: () => void;
  setView: (view: 'teacher' | 'student') => void;
  setZoom: (zoom: 'fit' | 'actual') => void;
  saveVersion: (name?: string) => void;
  restoreVersion: (id: string) => void;
  deleteVersion: (id: string) => void;
  setVersionsOpen: (open: boolean) => void;
  setDrawer: (drawer: DrawerTab) => void;
  setImportOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  openStudentEditor: (studentId?: string) => void;
  closeStudentEditor: () => void;
  setShortcutOpen: (open: boolean) => void;
  selectStudent: (id: string | null) => void;
  selectSlot: (slotId: string | null) => void;
  setAiSettings: (patch: Partial<AiSettings>) => void;
  applyAiSemantics: () => Promise<void>;
  notify: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: string) => void;
}

let requestSeq = 0;
let worker: Worker | null = null;
let workerSeq = 0;
const pending = new Map<number, { resolve: (r: SolveResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../lib/solver.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; result?: SolveResult; error?: string }>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.result) entry.resolve(event.data.result);
      else entry.reject(new Error(event.data.error ?? '求解失败'));
    };
    worker.onerror = () => {
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

async function runSolver(input: SolveInput): Promise<SolveResult> {
  const w = getWorker();
  if (!w) return solveSync(input);
  return new Promise<SolveResult>((resolve, reject) => {
    const id = ++workerSeq;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, input });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve(solveSync(input));
      }
    }, 4000);
  });
}

const persisted = localRepository.load();

const initial = persisted
  ? {
      className: persisted.className,
      students: persisted.students,
      layout: persisted.layout,
      rules: persisted.rules,
      assignment: persisted.assignment,
      aiSettings: { ...DEFAULT_AI_SETTINGS, ...persisted.aiSettings },
      view: persisted.view,
    }
  : {
      className: '未命名班级',
      students: [] as Student[],
      layout: {
        rows: 5,
        groups: 4,
        deskType: 'double',
        podiumSide: 'top',
        blocked: [],
      } as LayoutConfig,
      rules: DEFAULT_RULES.map((rule) => ({ ...rule })),
      assignment: {} as Assignment,
      aiSettings: DEFAULT_AI_SETTINGS,
      view: 'teacher' as const,
    };

function analyze(
  students: Student[],
  layout: LayoutConfig,
  rules: Rule[],
  assignment: Assignment,
) {
  const complement = buildComplementMatrix(students);
  const ctx = buildContext(students, buildSlots(layout), rules, layout, complement);
  const result = analyzeAssignment(assignment, ctx);
  return { ...result, complement };
}

const initialAnalysis = analyze(
  initial.students,
  initial.layout,
  initial.rules,
  initial.assignment,
);

const initialClusters = buildLocalClusters(initial.students);

export const useAppStore = create<AppStore>()((set, get) => ({
  className: initial.className,
  students: initial.students,
  layout: initial.layout,
  rules: initial.rules,
  assignment: initial.assignment,
  score: initialAnalysis.score,
  satisfactions: initialAnalysis.satisfactions,
  reasons: initialAnalysis.reasons,
  manualSlots: {},
  complement: initialAnalysis.complement,
  clusters: initialClusters,
  semanticMode: 'local',
  aiSettings: initial.aiSettings,
  aiBusy: false,
  aiError: null,

  solving: false,
  lastSeed: 20261110,
  conflicts: [],
  warnings: [],

  past: [],
  future: [],

  view: initial.view,
  zoom: 'fit',

  versions: loadVersions(),
  versionsOpen: false,

  drawer: null,
  importOpen: false,
  exportOpen: false,
  settingsOpen: false,
  studentEditor: { open: false },
  shortcutOpen: false,
  selectedStudentId: null,
  selectedSlotId: null,
  toasts: [],

  setClassName: (name) => set({ className: name }),

  setStudents: (students) => {
    const state = get();
    const ids = new Set(students.map((s) => s.id));
    const assignment = Object.fromEntries(
      Object.entries(state.assignment).filter(([, studentId]) => ids.has(studentId)),
    );
    const analysis = analyze(students, state.layout, state.rules, assignment);
    set({
      students,
      assignment,
      complement: analysis.complement,
      clusters: buildLocalClusters(students),
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  importStudents: (incoming, mode) => {
    const state = get();
    const students = mode === 'replace' ? incoming : [...state.students, ...incoming];
    const ids = new Set(students.map((s) => s.id));
    const assignment =
      mode === 'replace'
        ? {}
        : Object.fromEntries(
            Object.entries(state.assignment).filter(([, studentId]) => ids.has(studentId)),
          );
    const analysis = analyze(students, state.layout, state.rules, assignment);
    set({
      students,
      assignment,
      complement: analysis.complement,
      clusters: buildLocalClusters(students),
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      importOpen: false,
      manualSlots: mode === 'replace' ? {} : state.manualSlots,
    });
    get().notify(`已导入 ${incoming.length} 名学生`, 'success');
  },

  upsertStudent: (student) => {
    const state = get();
    const exists = state.students.some((s) => s.id === student.id);
    const students = exists
      ? state.students.map((s) => (s.id === student.id ? student : s))
      : [...state.students, student];
    const analysis = analyze(students, state.layout, state.rules, state.assignment);
    set({
      students,
      complement: analysis.complement,
      clusters: buildLocalClusters(students),
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      studentEditor: { open: false },
    });
  },

  deleteStudent: (id) => {
    const state = get();
    const students = state.students.filter((s) => s.id !== id);
    const assignment = Object.fromEntries(
      Object.entries(state.assignment).filter(([, studentId]) => studentId !== id),
    );
    const analysis = analyze(students, state.layout, state.rules, assignment);
    set({
      students,
      assignment,
      complement: analysis.complement,
      clusters: buildLocalClusters(students),
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  setLayout: (patch) => {
    const state = get();
    const layout = { ...state.layout, ...patch };
    const slots = buildSlots(layout);
    const valid = new Set(slots.filter((s) => !s.blocked).map((s) => s.id));
    const assignment = Object.fromEntries(
      Object.entries(state.assignment).filter(([slotId]) => valid.has(slotId)),
    );
    const analysis = analyze(state.students, layout, state.rules, assignment);
    set({
      layout,
      assignment,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      manualSlots: {},
    });
  },

  applyPreset: (rows, groups, deskType) => {
    get().setLayout({ rows, groups, deskType, blocked: [] });
  },

  toggleBlockedSlot: (slotId) => {
    const state = get();
    const blocked = state.layout.blocked.includes(slotId)
      ? state.layout.blocked.filter((id) => id !== slotId)
      : [...state.layout.blocked, slotId];
    const assignment = { ...state.assignment };
    delete assignment[slotId];
    const layout = { ...state.layout, blocked };
    const analysis = analyze(state.students, layout, state.rules, assignment);
    set({
      layout,
      assignment,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  updateRule: (id, patch) => {
    const state = get();
    const rules = state.rules.map((r) => (r.id === id ? ({ ...r, ...patch } as Rule) : r));
    const analysis = analyze(state.students, state.layout, rules, state.assignment);
    set({
      rules,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  addCustomRule: (rule) => {
    const state = get();
    const rules = [...state.rules, rule];
    const analysis = analyze(state.students, state.layout, rules, state.assignment);
    set({
      rules,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  removeRule: (id) => {
    const state = get();
    const rules = state.rules.filter((r) => r.id !== id);
    const analysis = analyze(state.students, state.layout, rules, state.assignment);
    set({
      rules,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  resetRules: () => {
    const state = get();
    const rules = DEFAULT_RULES.map((r) => ({ ...r }));
    const analysis = analyze(state.students, state.layout, rules, state.assignment);
    set({
      rules,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  solveNow: async (seed) => {
    const state = get();
    if (!state.students.length) {
      get().notify('请先导入学生名单', 'warn');
      return;
    }
    const requestId = ++requestSeq;
    const solveSeed = seed ?? Math.floor(Math.random() * 1_000_000_000);
    set({ solving: true, conflicts: [], warnings: [], lastSeed: solveSeed });
    const complement = buildComplementMatrix(state.students);
    const input: SolveInput = {
      students: state.students,
      slots: buildSlots(state.layout),
      rules: state.rules,
      layout: state.layout,
      complement,
      seed: solveSeed,
    };
    try {
      const result = await runSolver(input);
      if (requestId !== requestSeq) return;
      if (!result.ok) {
        set({ solving: false, conflicts: result.conflicts, warnings: result.warnings });
        get().notify(result.conflicts[0] ?? '排座失败', 'danger');
        return;
      }
      set({
        solving: false,
        assignment: result.assignment,
        score: result.score,
        satisfactions: result.satisfactions,
        reasons: result.reasons,
        warnings: result.warnings,
        complement,
        past: [...state.past.slice(-49), state.assignment],
        future: [],
        manualSlots: {},
        selectedSlotId: null,
      });
      get().notify(
        `排座完成 · 综合满足度 ${Math.round(result.score)}% · ${Math.round(result.ms)}ms`,
        'success',
      );
    } catch (error) {
      if (requestId !== requestSeq) return;
      try {
        const result = solveSync(input);
        set({
          solving: false,
          assignment: result.assignment,
          score: result.score,
          satisfactions: result.satisfactions,
          reasons: result.reasons,
          warnings: result.warnings,
          complement,
          past: [...state.past.slice(-49), state.assignment],
          future: [],
        });
      } catch (e) {
        set({ solving: false });
        get().notify('排座引擎异常，请检查学生数据', 'danger');
      }
    }
  },

  manualSwap: (slotA, slotB) => {
    if (slotA === slotB) return;
    const state = get();
    const assignment = { ...state.assignment };
    const a = assignment[slotA];
    const b = assignment[slotB];
    if (a) assignment[slotB] = a;
    else delete assignment[slotB];
    if (b) assignment[slotA] = b;
    else delete assignment[slotA];
    const analysis = analyze(state.students, state.layout, state.rules, assignment);
    set({
      assignment,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      past: [...state.past.slice(-49), state.assignment],
      future: [],
      manualSlots: { ...state.manualSlots, [slotA]: true, [slotB]: true },
    });
  },

  clearSlot: (slotId) => {
    const state = get();
    if (!state.assignment[slotId]) return;
    const assignment = { ...state.assignment };
    delete assignment[slotId];
    const analysis = analyze(state.students, state.layout, state.rules, assignment);
    set({
      assignment,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      past: [...state.past.slice(-49), state.assignment],
      future: [],
      manualSlots: { ...state.manualSlots, [slotId]: true },
    });
  },

  assignStudentToSlot: (studentId, slotId) => {
    const state = get();
    const slot = buildSlots(state.layout).find((s) => s.id === slotId);
    if (!slot || slot.blocked) return;
    if (state.assignment[slotId]) return;
    if (Object.values(state.assignment).includes(studentId)) return;
    const assignment = { ...state.assignment, [slotId]: studentId };
    const analysis = analyze(state.students, state.layout, state.rules, assignment);
    set({
      assignment,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      past: [...state.past.slice(-49), state.assignment],
      future: [],
      manualSlots: { ...state.manualSlots, [slotId]: true },
    });
  },

  toggleFixStudent: (studentId, slotId) => {
    const state = get();
    const students = state.students.map((s) =>
      s.id === studentId
        ? { ...s, fixedSlotId: s.fixedSlotId === slotId ? undefined : slotId }
        : s,
    );
    set({ students });
    const analysis = analyze(students, state.layout, state.rules, state.assignment);
    set({
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  undo: () => {
    const state = get();
    if (!state.past.length) return;
    const past = [...state.past];
    const previous = past.pop()!;
    const analysis = analyze(state.students, state.layout, state.rules, previous);
    set({
      assignment: previous,
      past,
      future: [state.assignment, ...state.future].slice(0, 50),
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  redo: () => {
    const state = get();
    if (!state.future.length) return;
    const [next, ...rest] = state.future;
    const analysis = analyze(state.students, state.layout, state.rules, next);
    set({
      assignment: next,
      past: [...state.past, state.assignment].slice(-50),
      future: rest,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
    });
  },

  setView: (view) => set({ view }),
  setZoom: (zoom) => set({ zoom }),
  setVersionsOpen: (versionsOpen) => set({ versionsOpen }),

  saveVersion: (name) => {
    const state = get();
    if (!state.students.length) {
      get().notify('当前没有可保存的名单', 'warn');
      return;
    }
    const snapshot: VersionSnapshot = {
      id: uid('ver'),
      name: name?.trim() || `版本 ${state.versions.length + 1}`,
      createdAt: Date.now(),
      className: state.className,
      students: JSON.parse(JSON.stringify(state.students)),
      layout: JSON.parse(JSON.stringify(state.layout)),
      rules: JSON.parse(JSON.stringify(state.rules)),
      assignment: JSON.parse(JSON.stringify(state.assignment)),
      score: state.score,
    };
    const versions = [snapshot, ...state.versions].slice(0, MAX_VERSIONS);
    set({ versions });
    saveVersions(versions);
    get().notify(
      versions.length === state.versions.length
        ? `已保存「${snapshot.name}」，最多保留 ${MAX_VERSIONS} 个版本，已移除最早的版本`
        : `已保存版本「${snapshot.name}」`,
      'success',
    );
  },

  restoreVersion: (id) => {
    const state = get();
    const version = state.versions.find((v) => v.id === id);
    if (!version) return;
    const analysis = analyze(version.students, version.layout, version.rules, version.assignment);
    set({
      className: version.className,
      students: version.students,
      layout: version.layout,
      rules: version.rules,
      assignment: version.assignment,
      score: analysis.score,
      satisfactions: analysis.satisfactions,
      reasons: analysis.reasons,
      complement: analysis.complement,
      clusters: buildLocalClusters(version.students),
      past: [],
      future: [],
      manualSlots: {},
      selectedSlotId: null,
      selectedStudentId: null,
      conflicts: [],
      warnings: [],
      versionsOpen: false,
    });
    get().notify(`已回退到「${version.name}」`, 'success');
  },

  deleteVersion: (id) => {
    const state = get();
    const target = state.versions.find((v) => v.id === id);
    if (!target) return;
    const versions = state.versions.filter((v) => v.id !== id);
    set({ versions });
    saveVersions(versions);
    get().notify(`已删除版本「${target.name}」`, 'info');
  },
  setDrawer: (drawer) => set({ drawer }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  openStudentEditor: (studentId) => set({ studentEditor: { open: true, studentId } }),
  closeStudentEditor: () => set({ studentEditor: { open: false } }),
  setShortcutOpen: (shortcutOpen) => set({ shortcutOpen }),
  selectStudent: (selectedStudentId) => set({ selectedStudentId }),
  selectSlot: (selectedSlotId) => set({ selectedSlotId }),

  setAiSettings: (patch) => set({ aiSettings: { ...get().aiSettings, ...patch } }),

  applyAiSemantics: async () => {
    const state = get();
    if (!state.aiSettings.apiKey) {
      set({ aiError: '请先在设置中填入硅基流动 API Key' });
      return;
    }
    set({ aiBusy: true, aiError: null });
    try {
      const result = await analyzeWithAi(state.students, state.aiSettings);
      const analysis = analyze(result.students, state.layout, state.rules, state.assignment);
      set({
        students: result.students,
        complement: analysis.complement,
        clusters: result.clusters.length ? result.clusters : buildLocalClusters(result.students),
        semanticMode: 'ai',
        score: analysis.score,
        satisfactions: analysis.satisfactions,
        reasons: analysis.reasons,
        aiBusy: false,
      });
      get().notify('AI 语义增强完成', 'success');
    } catch (error) {
      set({
        aiBusy: false,
        aiError: error instanceof Error ? error.message : 'AI 服务不可用',
      });
      get().notify('AI 不可用，已继续使用本地语义模式', 'warn');
    }
  },

  notify: (text, tone = 'info') => {
    const toast: ToastMessage = { id: uid('toast'), text, tone };
    set({ toasts: [...get().toasts, toast] });
    setTimeout(() => get().dismissToast(toast.id), 4200);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

let saveTimer: number | undefined;

export function initPersistence() {
  useAppStore.subscribe((state) => {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const payload: PersistedState = {
        version: 1,
        className: state.className,
        students: state.students,
        layout: state.layout,
        rules: state.rules,
        assignment: state.assignment,
        aiSettings: state.aiSettings,
        view: state.view,
        savedAt: Date.now(),
      };
      localRepository.save(payload);
    }, 400);
  });
}
