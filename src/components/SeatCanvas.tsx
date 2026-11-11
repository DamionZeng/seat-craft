import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { buildSlots, totalCols } from '../lib/layout';
import { buildContext, previewSwap } from '../lib/scoring';
import { SeatCard, StudentFace } from './SeatCard';
import type { Student } from '../types';
import { ScoreRing, Segmented } from './ui';
import { SlotInspector } from './SlotInspector';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import clsx from 'clsx';

interface SwapGhostItem {
  student: Student;
  x: number;
  y: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
}

interface SwapGhostState {
  token: number;
  hidden: string[];
  items: SwapGhostItem[];
}

export function SeatCanvas() {
  const students = useAppStore((s) => s.students);
  const layout = useAppStore((s) => s.layout);
  const rules = useAppStore((s) => s.rules);
  const assignment = useAppStore((s) => s.assignment);
  const complement = useAppStore((s) => s.complement);
  const manualSlots = useAppStore((s) => s.manualSlots);
  const reasons = useAppStore((s) => s.reasons);
  const selectedStudentId = useAppStore((s) => s.selectedStudentId);
  const selectedSlotId = useAppStore((s) => s.selectedSlotId);
  const selectSlot = useAppStore((s) => s.selectSlot);
  const selectStudent = useAppStore((s) => s.selectStudent);
  const view = useAppStore((s) => s.view);
  const zoom = useAppStore((s) => s.zoom);
  const setZoom = useAppStore((s) => s.setZoom);
  const solving = useAppStore((s) => s.solving);
  const score = useAppStore((s) => s.score);
  const satisfactions = useAppStore((s) => s.satisfactions);
  const conflicts = useAppStore((s) => s.conflicts);
  const warnings = useAppStore((s) => s.warnings);
  const manualSwap = useAppStore((s) => s.manualSwap);
  const assignStudentToSlot = useAppStore((s) => s.assignStudentToSlot);
  const setDrawer = useAppStore((s) => s.setDrawer);
  const setImportOpen = useAppStore((s) => s.setImportOpen);
  const solveNow = useAppStore((s) => s.solveNow);

  const containerRef = useRef<HTMLDivElement>(null);
  const ghostTimer = useRef<number | undefined>(undefined);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<string | null>(null);
  const [swapGhosts, setSwapGhosts] = useState<SwapGhostState | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const slots = useMemo(() => buildSlots(layout), [layout]);
  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const ctx = useMemo(
    () => buildContext(students, slots, rules, layout, complement),
    [students, slots, rules, layout, complement],
  );

  const preview = useMemo(() => {
    if (!activeSlot || !hoverSlot || activeSlot === hoverSlot) return null;
    if (!assignment[activeSlot] && !assignment[hoverSlot]) return null;
    return previewSwap(assignment, activeSlot, hoverSlot, ctx);
  }, [activeSlot, hoverSlot, assignment, ctx]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveSlot(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    setHoverSlot(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const from = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    setActiveSlot(null);
    setHoverSlot(null);
    if (!to || from === to || slotById.get(to)?.blocked || slotById.get(from)?.blocked) return;

    // 测量两个座位的位置，用于播放卡片互换动画
    const fromStudent = studentById.get(assignment[from] ?? '');
    const toStudent = studentById.get(assignment[to] ?? '');
    const mapRect = document.getElementById('seat-map')?.getBoundingClientRect();
    const fromRect = document.getElementById(`seat-${from}`)?.getBoundingClientRect();
    const toRect = document.getElementById(`seat-${to}`)?.getBoundingClientRect();
    if (fromStudent && mapRect && fromRect && toRect) {
      const makeGhost = (student: Student, origin: DOMRect, target: DOMRect): SwapGhostItem => ({
        student,
        x: origin.left - mapRect.left,
        y: origin.top - mapRect.top,
        width: origin.width,
        height: origin.height,
        dx: target.left - origin.left,
        dy: target.top - origin.top,
      });
      const items = [makeGhost(fromStudent, fromRect, toRect)];
      if (toStudent) items.push(makeGhost(toStudent, toRect, fromRect));
      if (ghostTimer.current) window.clearTimeout(ghostTimer.current);
      setSwapGhosts({ token: Date.now(), hidden: [from, to], items });
      // 兜底清理，避免动画被中断后残影不消失
      ghostTimer.current = window.setTimeout(() => setSwapGhosts(null), 600);
    }

    manualSwap(from, to);
  };

  const cols = totalCols(layout);
  const double = layout.deskType === 'double';
  const rows = layout.rows;
  const groups = layout.groups;

  const chromeX = (groups - 1) * 22 + (double ? groups * 18 : 0);
  const widthSeat = (Math.max(320, size.w) - 118 - chromeX) / cols;
  const heightSeat = ((Math.max(320, size.h) - 158 - rows * 12) / rows) / 0.76;
  const seatW =
    zoom === 'actual'
      ? 146
      : Math.max(54, Math.min(146, Math.min(widthSeat, heightSeat), 146));
  const seatH = Math.round(seatW * 0.76);
  const compact = seatW < 86;

  const displayRows = useMemo(() => {
    const list = [];
    for (let row = 1; row <= rows; row++) {
      const rowSlots = slots.filter((s) => s.row === row);
      const groupList: string[][] = [];
      for (let g = 1; g <= groups; g++) {
        const ids = rowSlots
          .filter((s) => s.group === g)
          .sort((a, b) => a.indexInGroup - b.indexInGroup)
          .map((s) => s.id);
        groupList.push(ids);
      }
      list.push({ row, groups: groupList });
    }
    if (view === 'teacher') {
      list.reverse();
      for (const item of list) {
        item.groups.reverse();
        item.groups = item.groups.map((g) => [...g].reverse());
      }
    }
    return list;
  }, [slots, rows, groups, view]);

  const activeStudent = activeSlot ? studentById.get(assignment[activeSlot] ?? '') : undefined;
  const unmet = satisfactions.filter((s) => s.sat < 0.999 && s.weight > 0).length;

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
  }, [conflicts, warnings]);

  const showNotices = !dismissed && (conflicts.length > 0 || warnings.length > 0);

  if (!students.length) {
    return (
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <Empty className="max-w-[400px] rounded-[24px] border border-line bg-card/70 px-10 py-12 backdrop-blur-md">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-14 rounded-2xl bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
            >
              <Sparkles className="size-6" />
            </EmptyMedia>
            <EmptyTitle className="mt-1 text-[15px]">先导入学生名单</EmptyTitle>
            <EmptyDescription className="text-[12px] leading-relaxed">
              支持 Excel / CSV 文件，也可以直接从表格复制粘贴。导入后即可智能排座。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => setImportOpen(true)}
              className="gap-1.5 rounded-[10px] px-4 text-[12.5px] text-primary-foreground shadow-[0_6px_16px_rgba(61,90,254,0.26)] [background:linear-gradient(135deg,#3D5AFE,#5B7CFA)]"
            >
              <Sparkles data-icon="inline-start" />
              导入名单
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 overflow-hidden" ref={containerRef}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(60,64,74,0.10) 1px, transparent 0)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(circle at 50% 45%, #000 35%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 45%, #000 35%, transparent 78%)',
        }}
      />

      <div
        className={clsx(
          'scroll-thin relative flex flex-1 items-center justify-center overflow-auto px-10 py-6',
          zoom === 'actual' && 'items-start',
        )}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveSlot(null);
            setHoverSlot(null);
          }}
        >
          <LayoutGroup>
            <div
              id="seat-map"
              className="relative flex flex-col items-center rounded-[26px] px-10 pb-9 pt-6"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.38) 100%)',
                border: '1px solid rgba(230,226,216,0.9)',
                boxShadow:
                  '0 24px 60px rgba(30,34,45,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
                ['--seat-w' as any]: `${seatW}px`,
                ['--seat-h' as any]: `${seatH}px`,
              }}
            >
              {view === 'student' && <Podium />}

              <div className="mt-1 flex flex-col items-center gap-[12px]">
                {displayRows.map(({ row, groups: groupIds }, rowIndex) => (
                  <motion.div
                    key={row}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.34,
                      delay: Math.min(rowIndex * 0.03, 0.3),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="relative flex items-center gap-[22px]"
                  >
                    <span className="absolute -left-7 flex size-[18px] items-center justify-center rounded-full bg-[#f1eee6] text-[9px] font-medium tabular-nums text-muted-foreground">
                      {row}
                    </span>
                    {groupIds.map((ids, index) => (
                      <div
                        key={`${row}-${index}`}
                        className={clsx('flex gap-2', double ? 'desk-group' : 'desk-group-single')}
                      >
                        {ids.map((slotId) => {
                          const slot = slotById.get(slotId);
                          if (!slot) return null;
                          const studentId = assignment[slotId];
                          const student = studentId ? studentById.get(studentId) : undefined;
                          return (
                            <SeatCard
                              key={slotId}
                              slot={slot}
                              student={student}
                              compact={compact}
                              selected={selectedSlotId === slotId}
                              highlighted={!!student && student.id === selectedStudentId}
                              manual={!!manualSlots[slotId]}
                              hidden={!!swapGhosts?.hidden.includes(slotId)}
                              reasons={student ? reasons[student.id] : undefined}
                              onDropStudent={(studentId) => assignStudentToSlot(studentId, slotId)}
                              onSelect={() => {
                                selectSlot(slotId);
                                selectStudent(student ? student.id : null);
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </motion.div>
                ))}
              </div>

              {/* 交换动画：两张卡片从原座位滑向对方座位 */}
              {swapGhosts?.items.map((item) => (
                <motion.div
                  key={`${swapGhosts.token}-${item.student.id}`}
                  initial={{ x: 0, y: 0 }}
                  animate={{ x: item.dx, y: item.dy }}
                  transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.9 }}
                  className="pointer-events-none absolute z-40 flex flex-col justify-center overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_16px_40px_rgba(16,24,40,0.22)]"
                  style={{ left: item.x, top: item.y, width: item.width, height: item.height }}
                >
                  <StudentFace student={item.student} compact={compact} />
                </motion.div>
              ))}

              {view === 'teacher' && <Podium />}

              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[9.5px] tracking-[0.14em] text-[#a9a396]">
                {layout.deskType === 'double' ? '双人桌' : '单人桌'} · {groups} 组 · {rows} 排 ·{' '}
                {slots.filter((s) => !s.blocked).length} 座
              </div>
            </div>
          </LayoutGroup>

          <DragOverlay dropAnimation={null}>
            {activeStudent && (
              <motion.div
                initial={{ scale: 1, rotate: 0 }}
                animate={{ scale: 1.06, rotate: 2.2 }}
                className="flex flex-col justify-center rounded-[14px] border border-white/60 bg-white pl-[10px] pr-2 shadow-[0_18px_40px_rgba(16,24,40,0.24)]"
                style={{ width: seatW, height: seatH, cursor: 'grabbing' }}
              >
                <span
                  className="absolute inset-y-0 left-0 w-[3px] rounded-l-[14px]"
                  style={{
                    background: activeStudent.gender === 'male' ? '#5B8DEF' : '#E8829B',
                  }}
                />
                <span className={clsx('truncate font-semibold', compact ? 'text-[11.5px]' : 'text-[13.5px]')}>
                  {activeStudent.name}
                </span>
                <span className="mt-0.5 text-[9.5px] text-muted-foreground">
                  {activeStudent.height ? `${activeStudent.height}cm` : '拖动中'}
                </span>
              </motion.div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* 左上：布局信息 */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
        <div className="glass flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-[0_2px_10px_rgba(16,24,40,0.05)]">
          <span className="font-medium text-ink">
            {layout.deskType === 'double' ? '双人桌' : '单人桌'}
          </span>
          <span className="h-2.5 w-px bg-line" />
          {groups} 组 × {rows} 排
          <span className="h-2.5 w-px bg-line" />
          {view === 'teacher' ? '讲台视角' : '学生视角'}
        </div>
        <AnimatePresence>
          {preview && Math.abs(preview.delta) >= 0.05 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={clsx(
                'rounded-[10px] px-2.5 py-1.5 text-[11px] font-medium shadow-sm',
                preview.delta >= 0
                  ? 'bg-ok-soft text-[#27835f]'
                  : 'bg-danger-soft text-[#b34a43]',
              )}
            >
              交换后满足度 {preview.delta >= 0 ? '+' : ''}
              {preview.delta.toFixed(1)}%
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 右上：满足度 */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -1 }}
        className="glass absolute right-4 top-4 z-10 flex items-center gap-2.5 rounded-[14px] py-2 pl-2.5 pr-3.5 text-left shadow-[0_2px_12px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_12px_32px_rgba(16,24,40,0.13)]"
        onClick={() => setDrawer('rules')}
        title="查看规则满足度"
      >
        <ScoreRing value={score} size={56} stroke={5.5} />
        <div>
          <div className="text-[11px] font-semibold">综合满足度</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {unmet ? `${unmet} 条规则待优化` : '全部规则已满足'}
          </div>
        </div>
        <ArrowUpRight className="ml-1 size-3 text-muted-foreground" />
      </motion.button>

      {/* 左下：缩放 */}
      <div className="absolute bottom-4 left-4 z-10 hidden items-center gap-2 rounded-[12px] border border-line/80 bg-card/80 px-2 py-1.5 shadow-[0_2px_10px_rgba(16,24,40,0.06)] backdrop-blur-md lg:flex">
        <span className="pl-0.5 text-[10.5px] text-muted-foreground">缩放</span>
        <Segmented
          value={zoom}
          onChange={setZoom}
          options={[
            { value: 'fit', label: '适应' },
            { value: 'actual', label: '100%' },
          ]}
        />
      </div>

      {/* 底部提示 */}
      <AnimatePresence>
        {showNotices && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="absolute bottom-4 left-1/2 z-20 w-[min(620px,calc(100%-32px))] -translate-x-1/2"
          >
            <Alert
              className={clsx(
                'rounded-[14px] px-4 py-3 shadow-[0_12px_36px_rgba(16,24,40,0.14)]',
                conflicts.length
                  ? 'border-[#f4cdca] bg-[#fff6f5]'
                  : 'border-[#f3e0c0] bg-[#fffaef]',
              )}
            >
              {conflicts.length ? (
                <TriangleAlert className="mt-0.5 shrink-0 text-danger" />
              ) : (
                <AlertTriangle className="mt-0.5 shrink-0 text-warn" />
              )}
              <AlertTitle className="text-[12px] font-semibold text-ink">
                {conflicts.length ? '规则冲突，暂未生成结果' : '排座完成，但有提示'}
              </AlertTitle>
              <AlertDescription className="mt-1 text-[11.5px] leading-relaxed text-[#6a6152]">
                <ul className="flex flex-col gap-0.5">
                  {(conflicts.length ? conflicts : warnings).slice(0, 3).map((item, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-muted-foreground">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
              <button
                className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-ink/5 hover:text-ink"
                onClick={() => setDismissed(true)}
                aria-label="关闭提示"
              >
                <X className="size-3" />
              </button>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {!Object.keys(assignment).length && !solving && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => solveNow()}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/25 bg-card/90 px-4 py-2 text-[12px] font-medium text-primary shadow-[0_8px_22px_rgba(61,90,254,0.16)] backdrop-blur"
          >
            <Sparkles className="size-3.5" />
            点击「智能排座」生成座位表
          </motion.button>
        </div>
      )}

      <SlotInspector />

      <AnimatePresence>
        {solving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(246,245,241,0.5)] backdrop-blur-[2px]"
          >
            <div className="scan-line" />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative flex flex-col items-center gap-3 rounded-[18px] border border-line bg-card/95 px-9 py-7 shadow-[0_24px_60px_rgba(16,24,40,0.18)]"
            >
              <span className="relative grid size-10 place-items-center rounded-full bg-primary-soft">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
                <Loader2 className="size-5 animate-spin text-primary" />
              </span>
              <div className="text-[13px] font-medium">正在计算最优座位…</div>
              <div className="text-[11px] text-muted-foreground">贪心初始解 → 模拟退火优化 · 硬约束优先</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Podium() {
  return (
    <div className="my-2 flex w-full max-w-[420px] flex-col items-center">
      <div className="podium flex h-[42px] w-full items-center justify-center gap-2 rounded-[12px]">
        <span className="text-[10px] tracking-[0.5em] text-white/90">讲 台</span>
      </div>
    </div>
  );
}
