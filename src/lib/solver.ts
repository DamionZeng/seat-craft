import type {
  Assignment,
  CustomRule,
  LayoutConfig,
  Rule,
  SolveInput,
  SolveResult,
  Student,
  Zone,
} from '../types';
import { buildSlotGraph, isAdjacent, type SlotGraph } from './layout';
import { matchStudents, ruleTitle } from './rules';
import {
  analyzeAssignment,
  buildContext,
  genderMixStats,
  isSoftRule,
  makeState,
  softScore,
  stateToAssignment,
  type ScoringContext,
  type SeatState,
} from './scoring';
import { isVeryTall } from './semantics';
import { clamp, mulberry32 } from './utils';

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  groups(ids: string[]): string[][] {
    const map = new Map<string, string[]>();
    for (const id of ids) {
      const root = this.find(id);
      const list = map.get(root) ?? [];
      list.push(id);
      map.set(root, list);
    }
    return [...map.values()];
  }
}

interface HardContext {
  pinned: Map<string, string>; // studentId -> slotId
  forbiddenZones: Map<string, Set<Zone>>;
  mustAvoid: Map<string, Set<string>>; // studentId -> partner studentIds
  mustPairs: [string, string][];
  graph: SlotGraph;
}

export function solve(input: SolveInput): SolveResult {
  const started = performance.now();
  const { students, slots, rules, layout, complement, seed } = input;
  const ctx = buildContext(students, slots, rules, layout, complement);
  const graph = ctx.graph;
  let usableSlots = graph.slots.filter((s) => !s.blocked);
  const conflicts: string[] = [];
  const warnings: string[] = [];

  if (!students.length) {
    return emptyResult(seed, ['当前班级还没有学生']);
  }
  if (usableSlots.length < students.length) {
    return emptyResult(seed, [
      `可用座位不足：学生 ${students.length} 人，可用座位 ${usableSlots.length} 个`,
    ]);
  }

  const pinned = new Map<string, string>();
  const pinnedSlots = new Map<string, string>();
  const forbiddenZones = new Map<string, Set<Zone>>();
  const mustAvoidMap = new Map<string, Set<string>>();
  const mustPairs: [string, string][] = [];
  const studentById = new Map(students.map((s) => [s.id, s]));

  // 男女同桌比例的硬约束（must 规则取交集）
  let mixMin: number | undefined;
  let mixMax: number | undefined;
  for (const rule of rules) {
    if (
      rule.kind !== 'custom' ||
      !rule.enabled ||
      rule.strength !== 'must' ||
      rule.action !== 'genderMix'
    ) {
      continue;
    }
    const limit = Math.min(1, Math.max(0, (rule.target.ratio ?? 50) / 100));
    if (rule.target.ratioMode === 'min') mixMin = Math.max(mixMin ?? 0, limit);
    else mixMax = Math.min(mixMax ?? 1, limit);
  }
  const hasMixConstraint = mixMin !== undefined || mixMax !== undefined;
  if (mixMin !== undefined && mixMax !== undefined && mixMin > mixMax) {
    conflicts.push(
      `男女同桌比例规则冲突：下限 ${Math.round(mixMin * 100)}% 高于上限 ${Math.round(mixMax * 100)}%`,
    );
  }

  const addPin = (studentId: string, slotId: string, source: string) => {
    const existingSlot = pinned.get(studentId);
    if (existingSlot && existingSlot !== slotId) {
      conflicts.push(`${studentById.get(studentId)?.name ?? '学生'} 被多条规则固定到了不同座位（${source}）`);
      return;
    }
    const occupant = pinnedSlots.get(slotId);
    if (occupant && occupant !== studentId) {
      conflicts.push(
        `座位冲突：${studentById.get(occupant)?.name ?? '某学生'} 与 ${studentById.get(studentId)?.name ?? '某学生'} 都要固定在同一个座位（${source}）`,
      );
      return;
    }
    if (!graph.byId.has(slotId) || graph.byId.get(slotId)?.blocked) {
      conflicts.push(`固定座位无效或被设为禁区（${source}）`);
      return;
    }
    pinned.set(studentId, slotId);
    pinnedSlots.set(slotId, studentId);
  };

  for (const student of students) {
    if (student.fixedSlotId) addPin(student.id, student.fixedSlotId, '手动固定');
  }

  const addAvoid = (a: string, b: string) => {
    if (a === b) return;
    const setA = mustAvoidMap.get(a) ?? new Set<string>();
    setA.add(b);
    mustAvoidMap.set(a, setA);
    const setB = mustAvoidMap.get(b) ?? new Set<string>();
    setB.add(a);
    mustAvoidMap.set(b, setB);
  };

  for (const rule of rules) {
    if (rule.kind !== 'custom' || !rule.enabled || rule.strength !== 'must') continue;
    const matched = matchStudents(rule, students);
    if (rule.action === 'pin') {
      if (matched.length === 0) {
        warnings.push(`规则「${ruleTitle(rule)}」未匹配到学生`);
        continue;
      }
      if (matched.length > 1) {
        warnings.push(`规则「${ruleTitle(rule)}」匹配到 ${matched.length} 人，仅固定第一位`);
      }
      if (rule.target.slotId) addPin(matched[0].id, rule.target.slotId, ruleTitle(rule));
      else warnings.push(`规则「${ruleTitle(rule)}」未指定座位`);
    } else if (rule.action === 'forbidZone') {
      const zone = rule.target.zone;
      if (!zone) continue;
      for (const student of matched) {
        const set = forbiddenZones.get(student.id) ?? new Set<Zone>();
        set.add(zone);
        forbiddenZones.set(student.id, set);
      }
    } else if (rule.action === 'avoidAdjacent') {
      const target = rule.target.studentId ? studentById.get(rule.target.studentId) : undefined;
      if (!target) {
        warnings.push(`规则「${ruleTitle(rule)}」未选择对象，已跳过`);
        continue;
      }
      for (const student of matched) addAvoid(student.id, target.id);
    } else if (rule.action === 'deskmate') {
      const target = rule.target.studentId ? studentById.get(rule.target.studentId) : undefined;
      if (!target) {
        warnings.push(`规则「${ruleTitle(rule)}」未选择同桌对象，已跳过`);
        continue;
      }
      if (layout.deskType !== 'double') {
        conflicts.push(
          `当前布局为单人桌，无法满足「${ruleTitle(rule)}」的必须同桌要求 — 请切换为双人桌布局或把强度降为「强烈」`,
        );
        continue;
      }
      for (const student of matched) {
        if (student.id === target.id) continue;
        mustPairs.push([student.id, target.id]);
      }
    }
  }

  // 同桌约束合并（同桌链）
  const uf = new UnionFind();
  for (const [a, b] of mustPairs) uf.union(a, b);
  const mustGroups = uf.groups(students.map((s) => s.id)).filter((g) => g.length > 1);
  for (const group of mustGroups) {
    if (group.length > 2) {
      conflicts.push(
        `同桌链包含 ${group.length} 人（${group.map((id) => studentById.get(id)?.name).join('、')}），双人桌无法满足`,
      );
    }
  }

  if (conflicts.length) {
    return {
      ok: false,
      conflicts: [...new Set(conflicts)],
      warnings,
      assignment: {},
      score: 0,
      satisfactions: [],
      reasons: {},
      iterations: 0,
      ms: performance.now() - started,
      seed,
    };
  }

  const state: SeatState = { slotToStudent: new Map(), studentToSlot: new Map() };
  const place = (studentId: string, slotId: string) => {
    const occupant = state.slotToStudent.get(slotId);
    if (occupant) state.studentToSlot.delete(occupant);
    const oldSlot = state.studentToSlot.get(studentId);
    if (oldSlot) state.slotToStudent.delete(oldSlot);
    state.slotToStudent.set(slotId, studentId);
    state.studentToSlot.set(studentId, slotId);
  };
  const deskPartnerSlot = (slotId: string): string | null => {
    const slot = graph.byId.get(slotId);
    if (!slot) return null;
    const partner = graph.slots.find(
      (s) => s.deskId === slot.deskId && s.id !== slotId && !s.blocked,
    );
    return partner?.id ?? null;
  };

  // 当前方案对男女同桌比例硬约束的违反程度（0 表示满足）
  const mixViolation = (): number => {
    if (!hasMixConstraint) return 0;
    const { considered, mixed } = genderMixStats(state, ctx);
    if (!considered) return 0;
    const ratio = mixed / considered;
    let v = 0;
    if (mixMax !== undefined) v += Math.max(0, ratio - mixMax);
    if (mixMin !== undefined) v += Math.max(0, mixMin - ratio);
    return v;
  };

  // 1) 落固定座位
  for (const [studentId, slotId] of pinned) place(studentId, slotId);

  // 2) 同桌组：已固定一人则补齐另一人
  for (const group of mustGroups) {
    const placed = group.filter((id) => state.studentToSlot.has(id));
    const unplaced = group.filter((id) => !state.studentToSlot.has(id));
    if (placed.length === 1 && unplaced.length === 1) {
      const slot = deskPartnerSlot(state.studentToSlot.get(placed[0])!);
      if (!slot || state.slotToStudent.has(slot)) {
        conflicts.push(
          `无法为 ${studentById.get(placed[0])?.name} 与 ${studentById.get(unplaced[0])?.name} 安排同桌（目标桌位已被占用）`,
        );
      } else {
        place(unplaced[0], slot);
      }
    } else if (placed.length === 2) {
      const a = graph.byId.get(state.studentToSlot.get(group[0])!);
      const b = graph.byId.get(state.studentToSlot.get(group[1])!);
      if (!a || !b || a.deskId !== b.deskId) {
        conflicts.push(`同桌约束与固定座位冲突：${studentById.get(group[0])?.name} 与 ${studentById.get(group[1])?.name} 无法同桌`);
      }
    }
  }

  if (conflicts.length) {
    return {
      ok: false,
      conflicts: [...new Set(conflicts)],
      warnings,
      assignment: {},
      score: 0,
      satisfactions: [],
      reasons: {},
      iterations: 0,
      ms: performance.now() - started,
      seed,
    };
  }

  // 3) 贪心初始解
  const rng = mulberry32(seed);
  const groupKey = (studentId: string) => mustGroups.find((g) => g.includes(studentId)) ?? [studentId];
  const seenGroup = new Set<string>();
  const pendingGroups: string[][] = [];
  for (const student of students) {
    if (state.studentToSlot.has(student.id)) continue;
    const group = groupKey(student.id);
    const key = group.slice().sort().join(',');
    if (seenGroup.has(key)) continue;
    if (group.every((id) => state.studentToSlot.has(id))) continue;
    seenGroup.add(key);
    pendingGroups.push(group);
  }

  const priorityOf = (student: Student) => {
    let p = 40 - student.id.length; // 稳定扰动
    if (student.fixedSlotId) p += 100;
    if (student.height) p += Math.max(0, 190 - student.height) / 10;
    p += student.traits.length * 2;
    return p;
  };
  pendingGroups.sort((a, b) => {
    const pa = Math.max(...a.map((id) => priorityOf(studentById.get(id)!)));
    const pb = Math.max(...b.map((id) => priorityOf(studentById.get(id)!)));
    return pb - pa;
  });

  const hardInvalid = (studentId: string, slotId: string, ignoreStudent?: string): boolean => {
    const student = studentById.get(studentId);
    const slot = graph.byId.get(slotId);
    if (!student || !slot || slot.blocked) return true;
    if (isVeryTall(student) && slot.row <= 2) return true;
    const zones = forbiddenZones.get(studentId);
    if (zones && slot.zones.some((z) => zones.has(z))) return true;
    const partners = mustAvoidMap.get(studentId);
    if (partners) {
      for (const partnerId of partners) {
        if (partnerId === ignoreStudent) continue;
        const partnerSlot = state.studentToSlot.get(partnerId);
        if (partnerSlot && isAdjacent(graph, slotId, partnerSlot)) return true;
      }
    }
    return false;
  };

  // 座位多于学生时，只使用最靠前的座位，保证空位集中在后排
  if (students.length < usableSlots.length) {
    const ordered = [...usableSlots].sort((a, b) => a.row - b.row || a.col - b.col);
    const keep = new Set(ordered.slice(0, students.length).map((s) => s.id));
    for (const slotId of pinned.values()) keep.add(slotId);
    if (keep.size > students.length) {
      const removable = ordered.filter((s) => keep.has(s.id) && !pinnedSlots.has(s.id)).reverse();
      for (const slot of removable) {
        if (keep.size <= students.length) break;
        keep.delete(slot.id);
      }
    }
    const compact = usableSlots.filter((s) => keep.has(s.id));
    const zones: Zone[] = ['front', 'middle', 'back', 'window', 'door'];
    const capacityOk = zones.every((zone) => {
      const affected = students.filter((student) =>
        forbiddenZones.get(student.id)?.has(zone),
      ).length;
      return affected <= compact.filter((slot) => !slot.zones.includes(zone)).length;
    });
    const feasible =
      capacityOk &&
      students.every((student) =>
        compact.some(
          (slot) =>
            !(isVeryTall(student) && slot.row <= 2) &&
            ![...(forbiddenZones.get(student.id) ?? [])].some((z) => slot.zones.includes(z)),
        ),
      );
    if (feasible) usableSlots = compact;
  }

  const freeSlots = () =>
    usableSlots.filter((s) => !state.slotToStudent.has(s.id));

  for (const group of pendingGroups) {
    const members = group.map((id) => studentById.get(id)!).filter(Boolean);
    if (members.length === 1) {
      const student = members[0];
      let candidates = freeSlots().filter((s) => !hardInvalid(student.id, s.id));
      if (!candidates.length) candidates = freeSlots();
      let bestSlot: string | null = null;
      let bestScore = -Infinity;
      for (const slot of candidates) {
        place(student.id, slot.id);
        const score = softScore(state, ctx) + rng() * 0.002;
        if (score > bestScore) {
          bestScore = score;
          bestSlot = slot.id;
        }
        state.studentToSlot.delete(student.id);
        state.slotToStudent.delete(slot.id);
      }
      if (bestSlot) place(student.id, bestSlot);
    } else if (members.length === 2) {
      const [a, b] = members;
      const desks = new Map<string, { slots: string[] }>();
      for (const slot of freeSlots()) {
        if (hardInvalid(a.id, slot.id) && hardInvalid(b.id, slot.id)) continue;
        const entry = desks.get(slot.deskId) ?? { slots: [] };
        entry.slots.push(slot.id);
        desks.set(slot.deskId, entry);
      }
      let best: { slots: string[]; score: number } | null = null;
      for (const desk of desks.values()) {
        if (desk.slots.length < 2) continue;
        const [s1, s2] = desk.slots;
        for (const [pa, pb] of [
          [s1, s2],
          [s2, s1],
        ]) {
          if (hardInvalid(a.id, pa) || hardInvalid(b.id, pb)) continue;
          place(a.id, pa);
          place(b.id, pb);
          const score = softScore(state, ctx) + rng() * 0.002;
          if (!best || score > best.score) best = { slots: [pa, pb], score };
          state.studentToSlot.delete(a.id);
          state.studentToSlot.delete(b.id);
          state.slotToStudent.delete(pa);
          state.slotToStudent.delete(pb);
        }
      }
      if (best) {
        place(a.id, best.slots[0]);
        place(b.id, best.slots[1]);
      } else {
        warnings.push(`无法为 ${a.name} 与 ${b.name} 找到合适的同桌座位`);
        const fallback = freeSlots();
        if (fallback[0]) place(a.id, fallback[0].id);
        if (fallback[1]) place(b.id, fallback[1].id);
      }
    }
  }

  // 4) 模拟退火局部优化
  const iterations = input.maxIterations ?? 6000;
  const budget = input.timeBudget ?? 750;
  const occupied = usableSlots.map((s) => s.id).filter((id) => state.slotToStudent.has(id));
  const pinnedStudents = new Set(pinned.keys());
  const mustPairStudents = new Set(mustPairs.flat());

  const swapAllowed = (slotA: string, slotB: string): boolean => {
    const aId = state.slotToStudent.get(slotA);
    const bId = state.slotToStudent.get(slotB);
    if (!aId || !bId || aId === bId) return false;
    if (pinnedStudents.has(aId) || pinnedStudents.has(bId)) return false;
    if (mustPairStudents.has(aId) || mustPairStudents.has(bId)) return false;
    // 交换后位置合法性
    if (hardInvalid(aId, slotB, bId)) return false;
    if (hardInvalid(bId, slotA, aId)) return false;
    // 互相之间的禁邻
    if (mustAvoidMap.get(aId)?.has(bId)) {
      // 交换后仍然相邻，禁止
      if (isAdjacent(graph, slotB, slotA)) return false;
    }
    return true;
  };

  // 男女同桌比例硬约束：先做局部交换修复，让初始解进入可行区间
  if (hasMixConstraint) {
    let guard = 0;
    while (mixViolation() > 1e-9 && guard++ < 4000 && occupied.length > 1) {
      const iA = Math.floor(rng() * occupied.length);
      const iB = Math.floor(rng() * occupied.length);
      if (iA === iB) continue;
      const slotA = occupied[iA];
      const slotB = occupied[iB];
      if (!swapAllowed(slotA, slotB)) continue;
      const aId = state.slotToStudent.get(slotA)!;
      const bId = state.slotToStudent.get(slotB)!;
      const before = mixViolation();
      state.slotToStudent.set(slotA, bId);
      state.slotToStudent.set(slotB, aId);
      state.studentToSlot.set(aId, slotB);
      state.studentToSlot.set(bId, slotA);
      if (mixViolation() < before - 1e-12) continue;
      state.slotToStudent.set(slotA, aId);
      state.slotToStudent.set(slotB, bId);
      state.studentToSlot.set(aId, slotA);
      state.studentToSlot.set(bId, slotB);
    }
  }

  let currentScore = softScore(state, ctx);
  let bestAssignment = stateToAssignment(state);
  let bestScore = currentScore;
  let temperature = 0.03;
  const cooling = Math.pow(0.0005 / temperature, 1 / iterations);
  let done = 0;

  for (let i = 0; i < iterations; i++) {
    if ((i & 127) === 0 && performance.now() - started > budget) break;
    done = i + 1;
    const iA = Math.floor(rng() * occupied.length);
    const iB = Math.floor(rng() * occupied.length);
    if (iA === iB) continue;
    const slotA = occupied[iA];
    const slotB = occupied[iB];
    if (!swapAllowed(slotA, slotB)) continue;
    const aId = state.slotToStudent.get(slotA)!;
    const bId = state.slotToStudent.get(slotB)!;
    const mixBefore = hasMixConstraint ? mixViolation() : 0;
    state.slotToStudent.set(slotA, bId);
    state.slotToStudent.set(slotB, aId);
    state.studentToSlot.set(aId, slotB);
    state.studentToSlot.set(bId, slotA);
    const mixOk = !hasMixConstraint || mixViolation() <= mixBefore + 1e-9;
    const nextScore = softScore(state, ctx);
    const delta = nextScore - currentScore;
    if (mixOk && (delta >= 0 || rng() < Math.exp(delta / temperature))) {
      currentScore = nextScore;
      if (nextScore > bestScore + 1e-9) {
        bestScore = nextScore;
        bestAssignment = stateToAssignment(state);
      }
    } else {
      state.slotToStudent.set(slotA, aId);
      state.slotToStudent.set(slotB, bId);
      state.studentToSlot.set(aId, slotA);
      state.studentToSlot.set(bId, slotB);
    }
    temperature = clamp(temperature * cooling, 0.0005, 0.03);
  }

  // 空位后置：座位多于学生时，在同一列内整体前移，让空位集中到后排
  const compactEmptySeats = () => {
    if (students.length >= usableSlots.length) return;
    const movable = (id: string) => !pinnedStudents.has(id) && !mustPairStudents.has(id);
    const cols = [...new Set(usableSlots.map((s) => s.col))];
    for (const col of cols) {
      const column = usableSlots
        .filter((s) => s.col === col)
        .sort((a, b) => a.row - b.row);
      const occupied = column.filter((s) => state.slotToStudent.has(s.id));
      if (occupied.length === column.length) continue;
      const moves = occupied
        .map((slot, i) => ({
          studentId: state.slotToStudent.get(slot.id)!,
          from: slot.id,
          to: column[i].id,
        }))
        .filter((m) => m.from !== m.to);
      if (!moves.length) continue;
      if (moves.some((m) => !movable(m.studentId))) continue;
      const before = softScore(state, ctx);
      const mixBefore = mixViolation();
      for (const m of moves) {
        state.slotToStudent.delete(m.from);
        state.studentToSlot.delete(m.studentId);
      }
      for (const m of moves) {
        state.slotToStudent.set(m.to, m.studentId);
        state.studentToSlot.set(m.studentId, m.to);
      }
      const invalid = moves.some((m) => hardInvalid(m.studentId, m.to));
      const after = softScore(state, ctx);
      if (invalid || after < before - 1e-9 || mixViolation() > mixBefore + 1e-9) {
        for (const m of moves) {
          state.slotToStudent.delete(m.to);
          state.studentToSlot.delete(m.studentId);
        }
        for (const m of moves) {
          state.slotToStudent.set(m.from, m.studentId);
          state.studentToSlot.set(m.studentId, m.from);
        }
      }
    }
  };

  // 恢复到历史最优
  const finalState = makeState(bestAssignment);
  state.slotToStudent = finalState.slotToStudent;
  state.studentToSlot = finalState.studentToSlot;

  compactEmptySeats();
  const finalAssignment = stateToAssignment(state);
  const analysis = analyzeAssignment(finalAssignment, ctx);

  for (const sat of analysis.satisfactions) {
    if (sat.kind === 'custom' && sat.sat < 0.999) {
      const rule = rules.find((r) => r.id === sat.ruleId);
      if (rule?.kind === 'custom' && rule.strength === 'must') {
        warnings.push(`硬约束「${sat.name}」仍有 ${Math.round((1 - sat.sat) * 100)}% 未满足，可尝试再排一次或调整规则`);
      }
    }
  }

  return {
    ok: true,
    conflicts: [],
    warnings: [...new Set(warnings)],
    assignment: finalAssignment,
    score: analysis.score,
    satisfactions: analysis.satisfactions,
    reasons: analysis.reasons,
    iterations: done,
    ms: performance.now() - started,
    seed,
  };
}

function emptyResult(seed: number, conflicts: string[]): SolveResult {
  return {
    ok: false,
    conflicts,
    warnings: [],
    assignment: {},
    score: 0,
    satisfactions: [],
    reasons: {},
    iterations: 0,
    ms: 0,
    seed,
  };
}
