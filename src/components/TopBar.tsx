import { useEffect, useRef, useState } from 'react';
import {
  Download,
  History,
  LayoutGrid,
  Loader2,
  Redo2,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Upload,
  UsersRound,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { Segmented } from './ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-9 place-items-center rounded-[11px] text-white shadow-[0_6px_16px_rgba(61,90,254,0.32),inset_0_1px_0_rgba(255,255,255,0.35)] [background:linear-gradient(140deg,#3D5AFE_0%,#5B7CFA_60%,#7C93FF_100%)]">
        <LayoutGrid className="size-[17px]" strokeWidth={2.2} />
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">排座台</span>
          <Badge variant="secondary" className="h-[15px] px-1 text-[9px] font-medium text-muted-foreground">
            MVP
          </Badge>
        </div>
        <ClassTitle />
      </div>
    </div>
  );
}

function ClassTitle() {
  const className = useAppStore((s) => s.className);
  const setClassName = useAppStore((s) => s.setClassName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(className);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next) setClassName(next);
    else setDraft(className);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="mt-0.5 w-[168px] rounded-[5px] border border-primary/40 bg-card px-1 py-px text-[11px] text-ink outline-none focus:ring-2 focus:ring-ring/40"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(className);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="text-[11px] text-muted-foreground transition-colors hover:text-ink"
      title="点击重命名班级"
      onClick={() => {
        setDraft(className);
        setEditing(true);
      }}
    >
      {className}
    </button>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="size-8 rounded-lg text-muted-foreground hover:bg-ink/5 hover:text-ink"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const drawer = useAppStore((s) => s.drawer);
  const setDrawer = useAppStore((s) => s.setDrawer);
  const setImportOpen = useAppStore((s) => s.setImportOpen);
  const setExportOpen = useAppStore((s) => s.setExportOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setVersionsOpen = useAppStore((s) => s.setVersionsOpen);
  const versionCount = useAppStore((s) => s.versions.length);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const solveNow = useAppStore((s) => s.solveNow);
  const solving = useAppStore((s) => s.solving);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);
  const students = useAppStore((s) => s.students);
  const semanticMode = useAppStore((s) => s.semanticMode);
  const hasAssignment = useAppStore((s) => Object.keys(s.assignment).length > 0);
  const rules = useAppStore((s) => s.rules);
  const customRuleCount = rules.filter((r) => r.kind === 'custom' && r.enabled).length;
  const score = useAppStore((s) => s.score);

  return (
    <header className="relative z-20 flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-line/80 bg-background/70 px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <Separator orientation="vertical" className="mx-0.5 h-6 self-center bg-line" />
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-ink/5 hover:text-ink"
          >
            <Upload data-icon="inline-start" />
            导入名单
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrawer(drawer === 'layout' ? null : 'layout')}
            className={`gap-1.5 px-2.5 text-[12.5px] ${
              drawer === 'layout'
                ? 'bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-line'
                : 'text-muted-foreground hover:bg-ink/5 hover:text-ink'
            }`}
          >
            <LayoutGrid data-icon="inline-start" />
            布局
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrawer(drawer === 'rules' ? null : 'rules')}
            className={`gap-1.5 px-2.5 text-[12.5px] ${
              drawer === 'rules'
                ? 'bg-card text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-line'
                : 'text-muted-foreground hover:bg-ink/5 hover:text-ink'
            }`}
          >
            <SlidersHorizontal data-icon="inline-start" />
            规则
            {customRuleCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px] font-semibold text-primary">
                {customRuleCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <div className="hidden items-center gap-1.5 rounded-full border border-line/80 px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground lg:flex">
          <UsersRound className="size-3" />
          {students.length} 人
        </div>
        <Segmented
          className="hidden md:inline-flex"
          value={view}
          onChange={setView}
          options={[
            { value: 'teacher', label: '讲台视角' },
            { value: 'student', label: '学生视角' },
          ]}
        />
        <Separator orientation="vertical" className="h-5 self-center bg-line" />
        <div className="flex items-center gap-0.5">
          <IconAction label="撤销 (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
            <Undo2 />
          </IconAction>
          <IconAction label="重做 (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
            <Redo2 />
          </IconAction>
          <IconAction
            label={versionCount ? `版本管理 · 已保存 ${versionCount} 个` : '版本管理'}
            onClick={() => setVersionsOpen(true)}
          >
            <History />
          </IconAction>
        </div>
        <Separator orientation="vertical" className="h-5 self-center bg-line" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExportOpen(true)}
          className="gap-1.5 px-2.5 text-[12.5px] text-muted-foreground hover:bg-ink/5 hover:text-ink"
        >
          <Download data-icon="inline-start" />
          <span className="hidden lg:inline">导出</span>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="语义与设置"
              className="relative size-8 rounded-lg text-muted-foreground hover:bg-ink/5 hover:text-ink"
            >
              <Settings />
              <span
                className={`absolute right-1.5 top-1.5 size-1.5 rounded-full ring-2 ring-background ${
                  semanticMode === 'ai' ? 'bg-ok' : 'bg-warm'
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {semanticMode === 'ai' ? 'AI 语义已启用' : '本地语义模式'}
          </TooltipContent>
        </Tooltip>

        <motion.div whileTap={{ scale: 0.97 }} whileHover={{ y: -1 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
          <Button
            onClick={() => solveNow()}
            disabled={solving || !students.length}
            className="gap-1.5 rounded-[10px] px-3.5 text-[12.5px] font-semibold text-primary-foreground shadow-[0_6px_16px_rgba(61,90,254,0.26),inset_0_1px_0_rgba(255,255,255,0.24)] transition-shadow hover:shadow-[0_10px_24px_rgba(61,90,254,0.34),inset_0_1px_0_rgba(255,255,255,0.3)] [background:linear-gradient(135deg,#3D5AFE_0%,#5B7CFA_100%)]"
          >
            {solving ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                计算中
              </>
            ) : (
              <>
                <Sparkles data-icon="inline-start" />
                {hasAssignment ? '再排一次' : '智能排座'}
                {hasAssignment && (
                  <span className="ml-0.5 rounded-[5px] bg-white/20 px-1.5 py-px text-[10px] font-semibold tabular-nums">
                    {Math.round(score)}%
                  </span>
                )}
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </header>
  );
}
