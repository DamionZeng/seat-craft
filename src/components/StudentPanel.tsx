import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, PanelLeftClose, PanelLeftOpen, Search, Upload, UserPlus, UsersRound } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../store/useAppStore';
import type { Student } from '../types';
import { GENDER_LABEL } from '../types';
import { Segmented } from './ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function avatarColor(gender: Student['gender']) {
  if (gender === 'male') return { bg: 'rgba(91,141,239,0.14)', color: '#3c6fd1' };
  if (gender === 'female') return { bg: 'rgba(232,130,155,0.14)', color: '#c95a77' };
  return { bg: 'rgba(108,114,128,0.12)', color: '#6c7280' };
}

export function StudentPanel() {
  const students = useAppStore((s) => s.students);
  const assignment = useAppStore((s) => s.assignment);
  const openStudentEditor = useAppStore((s) => s.openStudentEditor);
  const selectStudent = useAppStore((s) => s.selectStudent);
  const selectedStudentId = useAppStore((s) => s.selectedStudentId);
  const setImportOpen = useAppStore((s) => s.setImportOpen);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'male' | 'female' | 'unseated'>('all');
  const [collapsed, setCollapsed] = useState(false);

  const seatedIds = useMemo(() => new Set(Object.values(assignment)), [assignment]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return students.filter((s) => {
      if (filter === 'male' && s.gender !== 'male') return false;
      if (filter === 'female' && s.gender !== 'female') return false;
      if (filter === 'unseated' && seatedIds.has(s.id)) return false;
      if (!q) return true;
      return s.name.includes(q) || s.studentNo.includes(q);
    });
  }, [students, query, filter, seatedIds]);

  const seatedCount = students.filter((s) => seatedIds.has(s.id)).length;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0, width: collapsed ? 48 : 300 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 shrink-0 overflow-hidden border-r border-line/80 bg-background/50 backdrop-blur-xl"
    >
      {collapsed ? (
        <div className="flex h-full w-12 flex-col items-center gap-2 py-3.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:bg-ink/5 hover:text-ink"
                onClick={() => setCollapsed(false)}
                aria-label="展开学生名单"
              >
                <PanelLeftOpen />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">展开学生名单</TooltipContent>
          </Tooltip>
          <span className="mt-1 text-[10.5px] tabular-nums text-muted-foreground [writing-mode:vertical-rl]">
            学生名单 · {students.length}
          </span>
        </div>
      ) : (
        <div className="flex h-full w-[300px] flex-col">
          <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[13px] font-semibold tracking-[-0.01em]">学生名单</h2>
              <span className="text-[11px] tabular-nums text-muted-foreground">{students.length} 人</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-ink/5 hover:text-ink"
                    onClick={() => setImportOpen(true)}
                    aria-label="导入名单"
                  >
                    <Upload />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">导入名单</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-ink/5 hover:text-ink"
                    onClick={() => openStudentEditor()}
                    aria-label="添加学生"
                  >
                    <UserPlus />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">添加学生</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-ink/5 hover:text-ink"
                    onClick={() => setCollapsed(true)}
                    aria-label="折叠学生名单"
                  >
                    <PanelLeftClose />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">折叠学生名单</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 px-4 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-[34px] rounded-[9px] border-line bg-card pl-8 text-[12.5px] placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/25"
                placeholder="搜索姓名 / 学号"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'male', label: '男' },
                  { value: 'female', label: '女' },
                  { value: 'unseated', label: '未排' },
                ]}
              />
              <span
                className="shrink-0 rounded-full bg-ink/[0.04] px-1.5 py-0.5 text-[10.5px] tabular-nums text-muted-foreground"
                title={`${seatedCount}/${students.length} 已落座`}
              >
                {seatedCount}/{students.length}
              </span>
            </div>
          </div>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-0.5">
            {!students.length && (
              <Empty className="mt-10 border-0 px-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-[#f1eee6] text-muted-foreground">
                    <UsersRound className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle className="text-[13px]">还没有学生</EmptyTitle>
                  <EmptyDescription className="text-[11.5px] leading-relaxed">
                    导入一份 Excel 名单，或直接从表格复制粘贴，即可开始智能排座。
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    size="sm"
                    onClick={() => setImportOpen(true)}
                    className="gap-1.5 rounded-lg text-[12px] text-primary-foreground shadow-[0_4px_12px_rgba(61,90,254,0.22)] [background:linear-gradient(135deg,#3D5AFE,#5B7CFA)]"
                  >
                    <Upload data-icon="inline-start" />
                    导入名单
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            {filtered.map((student, index) => {
              const selected = student.id === selectedStudentId;
              const seated = seatedIds.has(student.id);
              const avatar = avatarColor(student.gender);
              const tags = [...new Set(student.traits.map((t) => t.text))].slice(0, 2);
              const more = Math.max(0, new Set(student.traits.map((t) => t.text)).size - tags.length);
              return (
                <motion.button
                  key={student.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(index * 0.014, 0.2), ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => selectStudent(selected ? null : student.id)}
                  onDoubleClick={() => openStudentEditor(student.id)}
                  draggable={!seated}
                  onDragStartCapture={(event) => {
                    if (seated) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData('text/plain', student.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  className={clsx(
                    'group relative mb-1 flex w-full items-center gap-2.5 rounded-[12px] border px-2 py-2 text-left transition-colors duration-150',
                    !seated && 'cursor-grab active:cursor-grabbing',
                    selected
                      ? 'border-primary/30 bg-primary-soft'
                      : 'border-transparent hover:bg-ink/[0.04]',
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="student-selected-bar"
                      className="absolute inset-y-2 left-0 w-[2.5px] rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <div
                    className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[12px] font-semibold"
                    style={{ background: avatar.bg, color: avatar.color }}
                  >
                    {student.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium">{student.name}</span>
                      {!seated && (
                        <Badge variant="secondary" className="h-[15px] bg-warn-soft px-1 text-[9px] font-medium text-[#a9761f]">
                          未排
                        </Badge>
                      )}
                      {student.fixedSlotId && (
                        <Badge variant="secondary" className="h-[15px] bg-primary-soft px-1 text-[9px] font-medium text-primary">
                          固定
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                      <span className="tabular-nums">{student.studentNo}</span>
                      {student.height && (
                        <>
                          <span className="size-0.5 rounded-full bg-line-strong" />
                          <span className="tabular-nums">{student.height}cm</span>
                        </>
                      )}
                      <span className="size-0.5 rounded-full bg-line-strong" />
                      <span>{GENDER_LABEL[student.gender]}</span>
                    </div>
                    {tags.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 overflow-hidden">
                        {tags.map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                        {more > 0 && <span className="text-[9.5px] text-muted-foreground">+{more}</span>}
                      </div>
                    )}
                  </div>
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      openStudentEditor(student.id);
                    }}
                    title="编辑"
                  >
                    <Pencil className="size-3" />
                  </span>
                </motion.button>
              );
            })}

            {students.length > 0 && filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">没有匹配的学生</div>
            )}
          </div>

          <div className="border-t border-line/70 px-4 py-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
            点击学生可高亮座位 · 拖动未排学生到空位 · 画布中拖动座位即可交换
          </div>
        </div>
      )}
    </motion.aside>
  );
}
