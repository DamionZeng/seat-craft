import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, MapPin, Pencil, Trash2, X, Check, Info } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { CATEGORY_LABEL, GENDER_LABEL, ZONE_LABEL } from '../types';
import { buildSlots } from '../lib/layout';

const CATEGORY_STYLE: Record<string, string> = {
  behavior: 'bg-warn-soft text-[#a9761f]',
  study: 'bg-primary-soft text-[#3446c9]',
  personality: 'bg-ok-soft text-[#2c8463]',
  other: 'bg-[#f1efe8] text-muted-foreground',
};

export function SlotInspector() {
  const selectedSlotId = useAppStore((s) => s.selectedSlotId);
  const selectSlot = useAppStore((s) => s.selectSlot);
  const layout = useAppStore((s) => s.layout);
  const assignment = useAppStore((s) => s.assignment);
  const students = useAppStore((s) => s.students);
  const reasons = useAppStore((s) => s.reasons);
  const manualSlots = useAppStore((s) => s.manualSlots);
  const clearSlot = useAppStore((s) => s.clearSlot);
  const toggleFixStudent = useAppStore((s) => s.toggleFixStudent);
  const toggleBlockedSlot = useAppStore((s) => s.toggleBlockedSlot);
  const openStudentEditor = useAppStore((s) => s.openStudentEditor);
  const assignStudentToSlot = useAppStore((s) => s.assignStudentToSlot);

  const slot = selectedSlotId
    ? buildSlots(layout).find((s) => s.id === selectedSlotId)
    : undefined;
  const studentId = selectedSlotId ? assignment[selectedSlotId] : undefined;
  const student = studentId ? students.find((s) => s.id === studentId) : undefined;

  const [query, setQuery] = useState('');
  useEffect(() => {
    setQuery('');
  }, [selectedSlotId]);

  const unseated = useMemo(() => {
    const seated = new Set(Object.values(assignment));
    const q = query.trim();
    return students.filter(
      (s) => !seated.has(s.id) && (!q || s.name.includes(q) || s.studentNo.includes(q)),
    );
  }, [students, assignment, query]);

  return (
    <AnimatePresence>
      {slot && (
        <motion.div
          key="inspector"
          initial={{ opacity: 0, x: 18, y: 6 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          className="scroll-thin absolute bottom-4 right-4 z-20 max-h-[calc(100%-2rem)] w-[300px] overflow-y-auto rounded-[16px] border border-line bg-white/95 shadow-[0_20px_50px_rgba(16,24,40,0.18)] backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <div className="text-[12.5px] font-semibold">
                第 {slot.row} 排 · 第 {slot.col} 座
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                {slot.zones
                  .filter((z) => z === 'window' || z === 'door' || z === 'front' || z === 'back')
                  .map((z) => ZONE_LABEL[z])
                  .join(' · ')}
                {manualSlots[slot.id] && (
                  <span className="rounded-[4px] bg-warm-soft px-1 text-[9px] font-medium text-[#a9761f]">
                    已手动
                  </span>
                )}
              </div>
            </div>
            <button className="icon-btn h-6 w-6" onClick={() => selectSlot(null)} aria-label="关闭">
              <X size={13} />
            </button>
          </div>

          {slot.blocked ? (
            <div className="px-4 py-5">
              <div className="flex items-center gap-2 text-[12.5px] font-medium">
                <Ban size={15} className="text-muted-foreground" /> 该座位被设为禁区
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                禁区不会参与排座，也不能拖入学生。适合讲台旁、储物柜旁等不能坐人的位置。
              </p>
              <button
                className="btn btn-soft mt-3 w-full"
                onClick={() => toggleBlockedSlot(slot.id)}
              >
                取消禁区
              </button>
            </div>
          ) : student ? (
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="grid h-9 w-9 place-items-center rounded-[10px] text-[13px] font-semibold"
                  style={{
                    background:
                      student.gender === 'male'
                        ? 'rgba(91,141,239,0.14)'
                        : student.gender === 'female'
                          ? 'rgba(232,130,155,0.14)'
                          : 'rgba(108,114,128,0.12)',
                    color:
                      student.gender === 'male'
                        ? '#3c6fd1'
                        : student.gender === 'female'
                          ? '#c95a77'
                          : '#6c7280',
                  }}
                >
                  {student.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-semibold">{student.name}</span>
                    {student.fixedSlotId === slot.id && (
                      <MapPin size={11} className="text-primary" />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                    <span className="tabular-nums">{student.studentNo}</span>
                    <span className="h-0.5 w-0.5 rounded-full bg-line-strong" />
                    <span>{GENDER_LABEL[student.gender]}</span>
                    {student.height && (
                      <>
                        <span className="h-0.5 w-0.5 rounded-full bg-line-strong" />
                        <span className="tabular-nums text-[#b0722a]">{student.height}cm</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  className="icon-btn h-7 w-7"
                  title="编辑学生"
                  onClick={() => openStudentEditor(student.id)}
                >
                  <Pencil size={13} />
                </button>
              </div>

              {student.traits.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {[...new Map(student.traits.map((t) => [t.text, t])).values()].map((trait) => (
                    <span
                      key={trait.id}
                      className={`tag-chip ${CATEGORY_STYLE[trait.category]}`}
                      title={CATEGORY_LABEL[trait.category]}
                    >
                      {trait.text}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 rounded-[10px] bg-surface-warm px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.04em] text-muted-foreground">
                  <Info size={11} /> 安排理由
                </div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {(reasons[student.id] ?? ['尚未生成排座结果']).map((reason, index) => (
                    <li key={index} className="flex items-start gap-1.5 text-[11px] leading-snug">
                      <Check size={11} className="mt-[1px] shrink-0 text-ok" />
                      <span className="text-[#4b4f58]">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="btn btn-soft text-[11.5px]"
                  onClick={() => toggleFixStudent(student.id, slot.id)}
                >
                  <MapPin size={12} />
                  {student.fixedSlotId === slot.id ? '取消固定' : '固定座位'}
                </button>
                <button
                  className="btn btn-soft text-[11.5px]"
                  onClick={() => toggleBlockedSlot(slot.id)}
                >
                  <Ban size={12} />
                  设为禁区
                </button>
                <button
                  className="btn btn-soft col-span-2 text-[11.5px] text-[#b34a43]"
                  onClick={() => {
                    clearSlot(slot.id);
                    selectSlot(null);
                  }}
                >
                  <Trash2 size={12} />
                  清空该座位
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 text-[12.5px] font-medium">
                <span className="grid h-6 w-6 place-items-center rounded-md border border-dashed border-line-strong text-muted-foreground">
                  +
                </span>
                空位
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                选择一名未排座的学生安排到这里，或设为禁区不参与排座。
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.04em] text-muted-foreground">
                  <span>未排座学生</span>
                  <span className="tabular-nums">{unseated.length}</span>
                </div>
                {unseated.length > 0 || query ? (
                  <>
                    <div className="mt-1.5">
                      <input
                        className="h-[30px] w-full rounded-[8px] border border-line bg-card px-2.5 text-[11.5px] outline-none placeholder:text-muted-foreground focus:border-primary/50"
                        placeholder="搜索姓名 / 学号"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="scroll-thin mt-1.5 flex max-h-[160px] flex-col gap-0.5 overflow-y-auto">
                      {unseated.map((s) => (
                        <button
                          key={s.id}
                          className="flex items-center gap-2 rounded-[8px] px-1.5 py-1.5 text-left transition-colors hover:bg-ink/[0.05]"
                          onClick={() => assignStudentToSlot(s.id, slot.id)}
                        >
                          <span
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[10.5px] font-semibold"
                            style={{
                              background:
                                s.gender === 'male'
                                  ? 'rgba(91,141,239,0.14)'
                                  : s.gender === 'female'
                                    ? 'rgba(232,130,155,0.14)'
                                    : 'rgba(108,114,128,0.12)',
                              color:
                                s.gender === 'male'
                                  ? '#3c6fd1'
                                  : s.gender === 'female'
                                    ? '#c95a77'
                                    : '#6c7280',
                            }}
                          >
                            {s.name.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">
                            {s.name}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {s.studentNo}
                          </span>
                        </button>
                      ))}
                      {unseated.length === 0 && (
                        <div className="px-1.5 py-4 text-center text-[11px] text-muted-foreground">
                          没有匹配的学生
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 rounded-[10px] bg-surface-warm px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    所有学生都已落座，暂无未排座的学生。
                  </p>
                )}
              </div>

              <button
                className="btn btn-soft mt-3 w-full text-[11.5px]"
                onClick={() => toggleBlockedSlot(slot.id)}
              >
                <Ban size={12} />
                设为禁区
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
