import type {
  Assignment,
  CustomRule,
  LayoutConfig,
  Rule,
  RuleSatisfaction,
  Slot,
  Student,
} from '../types';
import { ZONE_LABEL } from '../types';
import { buildSlotGraph, type SlotGraph } from './layout';
import { BUILTIN_NAME, matchStudents, ruleTitle } from './rules';
import {
  complementOf,
  hasNegativeBehaviorTag,
  isTall,
  isVeryTall,
  needsFront,
} from './semantics';
import { formatPercent } from './utils';

export interface ScoringContext {
  students: Student[];
  studentById: Map<string, Student>;
  slots: Slot[];
  layout: LayoutConfig;
  rules: Rule[];
  complement: Record<string, number>;
  graph: SlotGraph;
}

export interface SeatState {
  slotToStudent: Map<string, string>;
  studentToSlot: Map<string, string>;
}

export function buildContext(
  students: Student[],
  slots: Slot[],
  rules: Rule[],
  layout: LayoutConfig,
  complement: Record<string, number>,
): ScoringContext {
  return {
    students,
    studentById: new Map(students.map((s) => [s.id, s])),
    slots,
    layout,
    rules,
    complement,
    graph: buildSlotGraph(layout),
  };
}

export function makeState(assignment: Assignment): SeatState {
  const slotToStudent = new Map<string, string>();
  const studentToSlot = new Map<string, string>();
  for (const [slotId, studentId] of Object.entries(assignment)) {
    if (!studentId) continue;
    slotToStudent.set(slotId, studentId);
    studentToSlot.set(studentId, slotId);
  }
  return { slotToStudent, studentToSlot };
}

export function stateToAssignment(state: SeatState): Assignment {
  const out: Assignment = {};
  for (const [slotId, studentId] of state.slotToStudent) out[slotId] = studentId;
  return out;
}

interface SatResult {
  sat: number;
  detail: string;
  violations: number;
}

function satOfBuiltin(
  rule: Rule & { kind: 'builtin' },
  state: SeatState,
  ctx: ScoringContext,
): SatResult {
  const byId = ctx.studentById;
  const graph = ctx.graph;

  switch (rule.builtin) {
    case 'height': {
      let considered = 0;
      let good = 0;
      let frontSum = 0;
      let frontCount = 0;
      let backSum = 0;
      let backCount = 0;
      for (const pair of graph.verticalPairs) {
        const a = state.slotToStudent.get(pair.a);
        const b = state.slotToStudent.get(pair.b);
        if (!a || !b) continue;
        const sa = byId.get(a);
        const sb = byId.get(b);
        if (!sa?.height || !sb?.height) continue;
        considered++;
        if (sb.height >= sa.height) good += 1;
        else if (sb.height >= sa.height - 3) good += 0.5;
      }
      for (const [slotId, studentId] of state.slotToStudent) {
        const slot = graph.byId.get(slotId);
        const student = byId.get(studentId);
        if (!slot || !student?.height) continue;
        if (slot.zones.includes('front')) {
          frontSum += student.height;
          frontCount++;
        } else if (slot.zones.includes('back')) {
          backSum += student.height;
          backCount++;
        }
      }
      const sat = considered ? good / considered : 1;
      const fa = frontCount ? Math.round(frontSum / frontCount) : 0;
      const ba = backCount ? Math.round(backSum / backCount) : 0;
      return {
        sat,
        violations: Math.round((1 - sat) * considered),
        detail:
          frontCount && backCount
            ? `前排均高 ${fa}cm · 后排均高 ${ba}cm · ${formatPercent(sat)} 前后有序`
            : '暂无足够身高数据',
      };
    }
    case 'trait': {
      let sum = 0;
      let weight = 0;
      for (const pair of graph.neighborPairs) {
        const sa = state.slotToStudent.get(pair.a);
        const sb = state.slotToStudent.get(pair.b);
        if (!sa || !sb) continue;
        const a = byId.get(sa);
        const b = byId.get(sb);
        if (!a || !b) continue;
        if (!a.traits.length && !b.traits.length) continue;
        sum += complementOf(ctx.complement, sa, sb) * pair.weight;
        weight += pair.weight;
      }
      const sat = weight ? sum / weight : 1;
      return {
        sat,
        violations: 0,
        detail: weight ? `相邻/同桌互补平均 ${formatPercent(sat)}` : '尚未录入特点文本',
      };
    }
    case 'frontNeeds': {
      const need = ctx.students.filter((s) => needsFront(s));
      if (!need.length) return { sat: 1, detail: '暂无特殊前排需求', violations: 0 };
      let sum = 0;
      let placed = 0;
      const rows = ctx.layout.rows;
      for (const student of need) {
        const slotId = state.studentToSlot.get(student.id);
        if (!slotId) continue;
        const slot = graph.byId.get(slotId);
        if (!slot) continue;
        placed++;
        const ratio = rows > 1 ? (slot.row - 1) / (rows - 1) : 0;
        sum += Math.max(0, 1 - ratio * 1.25);
      }
      const sat = need.length ? sum / need.length : 1;
      return {
        sat,
        violations: need.length - placed,
        detail: `${need.length} 人需要前排 · ${placed} 人已落座 · 平均前置度 ${formatPercent(sat)}`,
      };
    }
    case 'tallBack': {
      const tall = ctx.students.filter((s) => isTall(s));
      if (!tall.length) return { sat: 1, detail: '暂无高个学生', violations: 0 };
      let sum = 0;
      const rows = ctx.layout.rows;
      for (const student of tall) {
        const slotId = state.studentToSlot.get(student.id);
        if (!slotId) continue;
        const slot = graph.byId.get(slotId);
        if (!slot) continue;
        const ratio = rows > 1 ? (slot.row - 1) / (rows - 1) : 1;
        sum += Math.min(1, ratio * 1.25);
      }
      const sat = sum / tall.length;
      return {
        sat,
        violations: 0,
        detail: `${tall.length} 名高个学生 · 平均后置度 ${formatPercent(sat)}`,
      };
    }
    case 'avoidCluster': {
      let pairs = 0;
      let conflicts = 0;
      for (const pair of graph.neighborPairs) {
        const sa = state.slotToStudent.get(pair.a);
        const sb = state.slotToStudent.get(pair.b);
        if (!sa || !sb) continue;
        const a = byId.get(sa);
        const b = byId.get(sb);
        if (!a || !b) continue;
        const ta = hasNegativeBehaviorTag(a);
        const tb = hasNegativeBehaviorTag(b);
        if (!ta && !tb) continue;
        pairs++;
        if (ta && tb && ta === tb) conflicts++;
      }
      const sat = pairs ? 1 - conflicts / pairs : 1;
      return {
        sat,
        violations: conflicts,
        detail: pairs ? `相邻负向标签冲突 ${conflicts} 处` : '暂无负向行为标签',
      };
    }
    default:
      return { sat: 1, detail: '', violations: 0 };
  }
}

/** 统计完整双人桌中的性别搭配情况（只统计性别已知的同桌） */
export function genderMixStats(state: SeatState, ctx: ScoringContext) {
  let considered = 0;
  let mixed = 0;
  for (const desk of ctx.graph.desks) {
    const slotIds = desk.slotIds.filter((id) => !ctx.graph.byId.get(id)?.blocked);
    if (slotIds.length < 2) continue;
    const aId = state.slotToStudent.get(slotIds[0]);
    const bId = state.slotToStudent.get(slotIds[1]);
    if (!aId || !bId) continue;
    const a = ctx.studentById.get(aId);
    const b = ctx.studentById.get(bId);
    if (!a || !b || a.gender === 'unknown' || b.gender === 'unknown') continue;
    considered++;
    if (a.gender !== b.gender) mixed++;
  }
  return { considered, mixed };
}

function satOfCustom(
  rule: CustomRule,
  state: SeatState,
  ctx: ScoringContext,
): SatResult {
  if (rule.action === 'genderMix') {
    const { considered, mixed } = genderMixStats(state, ctx);
    if (!considered) {
      return { sat: 1, detail: '当前布局没有可统计的同桌', violations: 0 };
    }
    const ratio = mixed / considered;
    const limit = Math.min(1, Math.max(0, (rule.target.ratio ?? 50) / 100));
    const isMin = rule.target.ratioMode === 'min';
    let sat: number;
    let violations: number;
    if (isMin) {
      sat = limit <= 0 ? 1 : Math.min(1, ratio / limit);
      violations = Math.max(0, Math.round(limit * considered) - mixed);
    } else {
      sat = ratio <= limit ? 1 : Math.max(0, 1 - (ratio - limit) / Math.max(1e-6, 1 - limit));
      violations = Math.max(0, mixed - Math.floor(limit * considered + 1e-9));
    }
    return {
      sat,
      violations,
      detail: `异性同桌 ${mixed} / ${considered} 桌（${formatPercent(ratio)}），${isMin ? '下限' : '上限'} ${Math.round(limit * 100)}%`,
    };
  }

  const matched = matchStudents(rule, ctx.students);
  if (!matched.length) {
    return { sat: 1, detail: '未匹配到学生', violations: 0 };
  }
  const graph = ctx.graph;
  const targetStudent = rule.target.studentId
    ? ctx.studentById.get(rule.target.studentId)
    : undefined;

  if (rule.action === 'pin') {
    const hit = matched.filter((s) => {
      const slotId = state.studentToSlot.get(s.id);
      return slotId && slotId === rule.target.slotId;
    }).length;
    const sat = hit / matched.length;
    return {
      sat,
      detail: `${matched.length} 人匹配 · ${hit} 人已在指定座位`,
      violations: matched.length - hit,
    };
  }

  if (rule.action === 'deskmate') {
    if (!targetStudent) return { sat: 0, detail: '未选择同桌对象', violations: matched.length };
    const targetSlotId = state.studentToSlot.get(targetStudent.id);
    if (!targetSlotId) return { sat: 1, detail: '目标学生尚未落座', violations: 0 };
    let sum = 0;
    for (const student of matched) {
      const slotId = state.studentToSlot.get(student.id);
      if (!slotId) {
        sum += 0;
        continue;
      }
      const slot = graph.byId.get(slotId);
      const targetSlot = graph.byId.get(targetSlotId);
      if (slot && targetSlot && slot.deskId === targetSlot.deskId && slot.id !== targetSlotId) {
        sum += 1;
      } else if (graph.adjacentSet.has([slotId, targetSlotId].sort().join('~'))) {
        sum += 0.4;
      }
    }
    const sat = sum / matched.length;
    return {
      sat,
      detail: `与 ${targetStudent.name} 同桌 ${Math.round(sum)} / ${matched.length} 人`,
      violations: matched.length - Math.round(sum),
    };
  }

  if (rule.action === 'avoidAdjacent') {
    if (!targetStudent) return { sat: 0, detail: '未选择对象', violations: matched.length };
    const targetSlotId = state.studentToSlot.get(targetStudent.id);
    if (!targetSlotId) return { sat: 1, detail: '目标学生尚未落座', violations: 0 };
    let bad = 0;
    for (const student of matched) {
      if (student.id === targetStudent.id) continue;
      const slotId = state.studentToSlot.get(student.id);
      if (!slotId) continue;
      if (graph.adjacentSet.has([slotId, targetSlotId].sort().join('~'))) bad++;
    }
    return {
      sat: matched.length > 1 ? 1 - bad / (matched.length - 1) : 1,
      detail: `与 ${targetStudent.name} 相邻的冲突 ${bad} 处`,
      violations: bad,
    };
  }

  const zone = (rule.target.zone ?? 'front') as keyof typeof ZONE_LABEL;
  let inZone = 0;
  let placed = 0;
  for (const student of matched) {
    const slotId = state.studentToSlot.get(student.id);
    if (!slotId) continue;
    placed++;
    const slot = graph.byId.get(slotId);
    if (!slot) continue;
    const hit = zone === 'front' || zone === 'back' || zone === 'middle'
      ? slot.zones.includes(zone)
      : slot.zones.includes(zone);
    if (hit) inZone++;
  }
  if (rule.action === 'preferZone') {
    const sat = placed ? inZone / placed : 0;
    return {
      sat,
      detail: `${matched.length} 人匹配 · ${inZone} 人已在${ZONE_LABEL[zone]}`,
      violations: placed - inZone,
    };
  }
  const sat = placed ? 1 - inZone / placed : 1;
  return {
    sat,
    detail: `${matched.length} 人匹配 · ${placed - inZone} 人避开了${ZONE_LABEL[zone]}`,
    violations: inZone,
  };
}

export function evaluateRule(
  rule: Rule,
  state: SeatState,
  ctx: ScoringContext,
): SatResult {
  if (rule.kind === 'builtin') return satOfBuiltin(rule, state, ctx);
  return satOfCustom(rule, state, ctx);
}

export function isSoftRule(rule: Rule): boolean {
  if (!rule.enabled) return false;
  if (rule.kind === 'custom' && rule.strength === 'must') return false;
  return true;
}

/** 快速加权得分（0..1），贪心与退火内部使用 */
export function softScore(state: SeatState, ctx: ScoringContext): number {
  let sum = 0;
  let total = 0;
  for (const rule of ctx.rules) {
    if (!isSoftRule(rule)) continue;
    const { sat } = evaluateRule(rule, state, ctx);
    sum += sat * rule.weight;
    total += rule.weight;
  }
  return total ? sum / total : 1;
}

export function analyzeAssignment(
  assignment: Assignment,
  ctx: ScoringContext,
): {
  score: number;
  satisfactions: RuleSatisfaction[];
  reasons: Record<string, string[]>;
} {
  const state = makeState(assignment);
  const satisfactions: RuleSatisfaction[] = [];
  let sum = 0;
  let total = 0;

  for (const rule of ctx.rules) {
    if (!rule.enabled) continue;
    const result = evaluateRule(rule, state, ctx);
    const soft = isSoftRule(rule);
    if (soft) {
      sum += result.sat * rule.weight;
      total += rule.weight;
    }
    satisfactions.push({
      ruleId: rule.id,
      name: ruleTitle(rule),
      kind: rule.kind,
      weight: rule.weight,
      sat: result.sat,
      detail:
        rule.kind === 'custom' && rule.strength === 'must'
          ? `硬约束 · ${result.detail}`
          : result.detail,
      violations: result.violations,
    });
  }

  const score = total ? (sum / total) * 100 : 100;
  return { score, satisfactions, reasons: buildReasons(state, ctx) };
}

function buildReasons(state: SeatState, ctx: ScoringContext): Record<string, string[]> {
  const reasons: Record<string, string[]> = {};
  const graph = ctx.graph;

  for (const [studentId, slotId] of state.studentToSlot) {
    const student = ctx.studentById.get(studentId);
    const slot = graph.byId.get(slotId);
    if (!student || !slot) continue;
    const list: string[] = [];

    if (student.fixedSlotId === slotId) list.push('固定座位');
    const place = [`第 ${slot.row} 排`];
    if (slot.zones.includes('window')) place.push('靠窗');
    else if (slot.zones.includes('door')) place.push('靠门');
    else place.push('中间');
    list.push(place.join(' · '));

    if (needsFront(student)) list.push('有前排需求，已优先安排');
    else if (isVeryTall(student)) list.push('身高超过 190cm，已避开前两排');
    else if (isTall(student)) list.push('个子较高，优先后排');

    // 同桌
    const deskMateId = [...state.slotToStudent.entries()].find(([otherSlot, otherStudent]) => {
      if (otherStudent === studentId) return false;
      const other = graph.byId.get(otherSlot);
      return other && other.deskId === slot.deskId;
    })?.[1];
    if (deskMateId) {
      const mate = ctx.studentById.get(deskMateId);
      const comp = complementOf(ctx.complement, studentId, deskMateId);
      if (mate) {
        list.push(comp >= 0.5 ? `与 ${mate.name} 同桌 · 特点互补` : `与 ${mate.name} 同桌`);
      }
    }

    if (student.height) list.push(`身高 ${student.height}cm`);

    const matchedCustom = ctx.rules.filter(
      (r) =>
        r.kind === 'custom' &&
        r.enabled &&
        matchStudents(r, [student]).length > 0 &&
        r.id !== '',
    );
    for (const r of matchedCustom.slice(0, 1)) {
      list.push(`命中规则「${ruleTitle(r)}」`);
    }

    reasons[studentId] = list.slice(0, 5);
  }
  return reasons;
}

export function previewSwap(
  assignment: Assignment,
  slotA: string,
  slotB: string,
  ctx: ScoringContext,
): { before: number; after: number; delta: number } {
  const before = analyzeAssignment(assignment, ctx).score;
  const next = { ...assignment };
  const a = next[slotA];
  const b = next[slotB];
  if (a) next[slotB] = a;
  else delete next[slotB];
  if (b) next[slotA] = b;
  else delete next[slotA];
  const after = analyzeAssignment(next, ctx).score;
  return { before, after, delta: after - before };
}
