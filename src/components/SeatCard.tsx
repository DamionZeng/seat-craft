import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import clsx from 'clsx';
import type { Slot, Student } from '../types';

const CATEGORY_COLOR: Record<string, string> = {
  behavior: '#E5A23C',
  study: '#3D5AFE',
  personality: '#3FB68B',
  other: '#A7A29A',
};

export function StudentFace({ student, compact }: { student: Student; compact: boolean }) {
  const tags = [...new Map(student.traits.map((t) => [t.text, t])).values()];
  return (
    <>
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background:
            student.gender === 'male'
              ? 'linear-gradient(180deg,#7BA6F5,#5B8DEF)'
              : student.gender === 'female'
                ? 'linear-gradient(180deg,#F0A5B7,#E8829B)'
                : '#D8D3C6',
        }}
      />
      <div className="flex min-w-0 flex-col gap-[3px] pl-[10px] pr-[7px]">
        <div className="flex items-center gap-1">
          <span
            className={clsx(
              'truncate font-semibold tracking-[-0.01em] text-ink',
              compact ? 'text-[11.5px]' : 'text-[13.5px]',
            )}
          >
            {student.name}
          </span>
          {student.fixedSlotId && (
            <MapPin size={compact ? 8 : 10} className="shrink-0 text-primary" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {student.height !== undefined && (
            <span
              className={clsx(
                'rounded-[4px] bg-warm-soft font-medium tabular-nums text-[#b0722a]',
                compact ? 'px-1 text-[8.5px]' : 'px-1.5 py-px text-[9.5px]',
              )}
            >
              {student.height}
            </span>
          )}
          {!compact && (
            <span className="truncate text-[9px] tabular-nums text-muted-foreground">
              {student.studentNo}
            </span>
          )}
          <span className="ml-auto flex items-center gap-[3px]">
            {tags.slice(0, compact ? 2 : 3).map((tag) => (
              <span
                key={tag.id}
                className="block h-[5px] w-[5px] rounded-full"
                style={{ background: CATEGORY_COLOR[tag.category] }}
              />
            ))}
            {tags.length > (compact ? 2 : 3) && (
              <span className="text-[8px] leading-none text-muted-foreground">+</span>
            )}
          </span>
        </div>
      </div>
    </>
  );
}

export function SeatCard({
  slot,
  student,
  compact,
  selected,
  highlighted,
  manual,
  hidden,
  reasons,
  onSelect,
  onDropStudent,
}: {
  slot: Slot;
  student?: Student;
  compact: boolean;
  selected: boolean;
  highlighted: boolean;
  manual: boolean;
  hidden?: boolean;
  reasons?: string[];
  onSelect: () => void;
  onDropStudent?: (studentId: string) => void;
}) {
  const draggable = useDraggable({
    id: slot.id,
    disabled: !student || slot.blocked,
    data: { slotId: slot.id },
  });
  const droppable = useDroppable({ id: slot.id, disabled: slot.blocked });
  const isDragging = draggable.isDragging;
  const isOver = droppable.isOver;

  // 学生面板中的未排学生使用浏览器原生拖拽，空座位作为放置目标
  const [nativeOver, setNativeOver] = useState(false);
  const acceptDrop = !student && !slot.blocked && !!onDropStudent;

  const setRef = (node: HTMLDivElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };

  if (slot.blocked) {
    return (
      <div
        ref={droppable.setNodeRef}
        className="seat seat-blocked flex flex-col items-center justify-center text-muted-foreground"
        style={{ width: 'var(--seat-w)', height: 'var(--seat-h)' }}
      >
        <span className="text-[10px] tracking-[0.08em]">禁区</span>
      </div>
    );
  }

  const tags = student
    ? [...new Map(student.traits.map((t) => [t.text, t])).values()]
    : [];
  const title = student
    ? [
        `${student.name} · ${student.studentNo}`,
        student.height ? `身高 ${student.height}cm` : '',
        tags.length ? `特点：${tags.map((t) => t.text).join('、')}` : '',
        reasons?.length ? `安排理由：${reasons.join('；')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '空位';

  return (
    <div
      ref={setRef}
      id={`seat-${slot.id}`}
      onClick={onSelect}
      title={title}
      onDragOver={(event) => {
        if (!acceptDrop || !event.dataTransfer.types.includes('text/plain')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (!nativeOver) setNativeOver(true);
      }}
      onDragLeave={() => setNativeOver(false)}
      onDrop={(event) => {
        if (!acceptDrop) return;
        event.preventDefault();
        setNativeOver(false);
        const studentId = event.dataTransfer.getData('text/plain');
        if (studentId) onDropStudent?.(studentId);
      }}
      className={clsx(
        'seat group/seat cursor-pointer',
        !student && 'seat-empty',
        selected && 'seat-selected',
        highlighted && 'seat-highlight',
        isDragging && 'seat-dragging',
        (isOver || nativeOver) && 'seat-over',
      )}
      style={{ width: 'var(--seat-w)', height: 'var(--seat-h)', touchAction: 'none' }}
      {...draggable.attributes}
      {...draggable.listeners}
    >
      {student ? (
        <motion.div
          layoutId={student.id}
          layout
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className={clsx(
            'absolute inset-0 flex flex-col justify-center transition-opacity duration-150',
            hidden && 'opacity-0',
          )}
        >
          {manual && (
            <span
              className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-warm"
              title="已手动调整"
            />
          )}
          <StudentFace student={student} compact={compact} />
        </motion.div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground opacity-70 transition-opacity group-hover/seat:opacity-100">
          <span className={compact ? 'text-[13px] leading-none' : 'text-[16px] leading-none'}>
            +
          </span>
          {!compact && <span className="text-[9.5px]">空位</span>}
        </div>
      )}
    </div>
  );
}
