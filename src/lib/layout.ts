import type { Desk, LayoutConfig, Slot, Zone } from '../types';

export function totalCols(layout: LayoutConfig): number {
  return layout.deskType === 'double' ? layout.groups * 2 : layout.groups;
}

export function buildSlots(layout: LayoutConfig): Slot[] {
  const colsPerGroup = layout.deskType === 'double' ? 2 : 1;
  const cols = layout.groups * colsPerGroup;
  const frontRows = Math.max(1, Math.ceil(layout.rows / 3));
  const backStart = layout.rows - frontRows + 1;
  const blocked = new Set(layout.blocked);
  const slots: Slot[] = [];

  for (let row = 1; row <= layout.rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const group = Math.ceil(col / colsPerGroup);
      const indexInGroup = (col - 1) % colsPerGroup;
      const zones: Zone[] = [];
      if (row <= frontRows) zones.push('front');
      else if (row >= backStart) zones.push('back');
      else zones.push('middle');
      if (col === 1) zones.push('window');
      if (col === cols) zones.push('door');

      const id = `r${row}c${col}`;
      slots.push({
        id,
        row,
        col,
        group,
        indexInGroup,
        deskId: `r${row}g${group}`,
        zones,
        blocked: blocked.has(id),
      });
    }
  }
  return slots;
}

export function buildDesks(layout: LayoutConfig): Desk[] {
  const slots = buildSlots(layout);
  const map = new Map<string, Desk>();
  for (const slot of slots) {
    let desk = map.get(slot.deskId);
    if (!desk) {
      desk = { id: slot.deskId, row: slot.row, group: slot.group, slotIds: [] };
      map.set(slot.deskId, desk);
    }
    desk.slotIds.push(slot.id);
  }
  return [...map.values()];
}

export interface NeighborPair {
  a: string;
  b: string;
  /** 1 = 同桌 / 0.6 = 前后左右相邻 */
  weight: number;
}

export interface SlotGraph {
  byId: Map<string, Slot>;
  slots: Slot[];
  /** 全部相邻对（含同桌），用于特点互补 / 避免聚集 */
  neighborPairs: NeighborPair[];
  /** 同桌（双人桌）或单桌时的左右相邻，用于性别搭配 */
  deskPairs: NeighborPair[];
  /** 前后相邻对，用于身高排序 */
  verticalPairs: NeighborPair[];
  /** 紧邻关系集合，用于"不与某人相邻" */
  adjacentSet: Set<string>;
  desks: Desk[];
}

function adjacencyKey(a: string, b: string) {
  return a < b ? `${a}~${b}` : `${b}~${a}`;
}

export function buildSlotGraph(layout: LayoutConfig): SlotGraph {
  const slots = buildSlots(layout);
  const byId = new Map(slots.map((s) => [s.id, s]));
  const usable = slots.filter((s) => !s.blocked);
  const neighborPairs: NeighborPair[] = [];
  const deskPairs: NeighborPair[] = [];
  const verticalPairs: NeighborPair[] = [];
  const adjacentSet = new Set<string>();
  const seen = new Set<string>();

  const push = (target: NeighborPair[], a: Slot, b: Slot, weight: number) => {
    const key = adjacencyKey(a.id, b.id);
    target.push({ a: a.id, b: b.id, weight });
    if (weight >= 0.6) adjacentSet.add(key);
    if (!seen.has(key)) {
      seen.add(key);
      neighborPairs.push({ a: a.id, b: b.id, weight });
    }
  };

  for (const slot of usable) {
    const sameDesk = usable.find(
      (s) => s.id !== slot.id && s.deskId === slot.deskId,
    );
    if (sameDesk && slot.id < sameDesk.id) {
      push(deskPairs, slot, sameDesk, 1);
      push(neighborPairs, slot, sameDesk, 1);
      adjacentSet.add(adjacencyKey(slot.id, sameDesk.id));
    }

    const right = byId.get(`r${slot.row}c${slot.col + 1}`);
    if (right && !right.blocked && right.group !== slot.group) {
      push(neighborPairs, slot, right, 0.6);
      if (layout.deskType === 'single') push(deskPairs, slot, right, 0.6);
    }

    const back = byId.get(`r${slot.row + 1}c${slot.col}`);
    if (back && !back.blocked) {
      push(verticalPairs, slot, back, 0.6);
      push(neighborPairs, slot, back, 0.6);
    }
  }

  return {
    byId,
    slots,
    neighborPairs,
    deskPairs,
    verticalPairs,
    adjacentSet,
    desks: buildDesks(layout),
  };
}

export function isAdjacent(graph: SlotGraph, a: string, b: string): boolean {
  return graph.adjacentSet.has(adjacencyKey(a, b));
}

export function isDeskPair(graph: SlotGraph, a: string, b: string): boolean {
  const sa = graph.byId.get(a);
  const sb = graph.byId.get(b);
  if (!sa || !sb) return false;
  return sa.deskId === sb.deskId;
}
