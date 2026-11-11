import { useEffect, useMemo } from 'react';
import { Command, Cpu, Hand, MousePointerClick, Sparkles } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { TopBar } from './components/TopBar';
import { StudentPanel } from './components/StudentPanel';
import { SeatCanvas } from './components/SeatCanvas';
import { RuleDrawer } from './components/RuleDrawer';
import { LayoutDrawer } from './components/LayoutDrawer';
import { ImportDialog } from './components/ImportDialog';
import { ExportDialog } from './components/ExportDialog';
import { StudentDialog } from './components/StudentDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { VersionDialog } from './components/VersionDialog';
import { Toasts } from './components/Toasts';
import { Modal } from './components/ui';
import { TooltipProvider } from './components/ui/tooltip';
import { buildSlots } from './lib/layout';

function Dot() {
  return <span className="size-1 rounded-full bg-line-strong" />;
}

function StatusBar() {
  const students = useAppStore((s) => s.students);
  const layout = useAppStore((s) => s.layout);
  const assignment = useAppStore((s) => s.assignment);
  const manualSlots = useAppStore((s) => s.manualSlots);
  const semanticMode = useAppStore((s) => s.semanticMode);
  const score = useAppStore((s) => s.score);

  const seats = useMemo(
    () => buildSlots(layout).filter((s) => !s.blocked).length,
    [layout],
  );
  const seated = Object.keys(assignment).length;
  const manual = Object.keys(manualSlots).length;
  const full = students.length > 0 && seated === students.length;

  return (
    <footer className="relative z-20 flex h-[28px] shrink-0 items-center justify-between border-t border-line/70 bg-card/60 px-4 text-[10.5px] text-muted-foreground backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1">
          <Hand className="size-3" /> 拖动座位即可交换
        </span>
        <Dot />
        <span className="flex items-center gap-1">
          <Command className="size-3" /> Ctrl+Z 撤销
        </span>
        <Dot />
        <span className="hidden sm:inline">按 ? 查看快捷键</span>
      </div>
      <div className="flex items-center gap-2.5 tabular-nums">
        {manual > 0 && (
          <>
            <span className="text-[#a9761f]">手动调整 {manual} 处</span>
            <Dot />
          </>
        )}
        <span className={full ? 'text-[#2c8463]' : undefined}>
          已落座 {seated}/{students.length}
        </span>
        <Dot />
        <span>座位 {seats}</span>
        <Dot />
        <span>满足度 {Math.round(score)}%</span>
        <Dot />
        <span className="flex items-center gap-1">
          <Cpu className="size-3" />
          {semanticMode === 'ai' ? 'AI 语义' : '本地语义'}
        </span>
      </div>
    </footer>
  );
}

function ShortcutsDialog() {
  const open = useAppStore((s) => s.shortcutOpen);
  const setOpen = useAppStore((s) => s.setShortcutOpen);

  const groups = [
    {
      title: '排座与调整',
      items: [
        { icon: Sparkles, keys: ['点击「智能排座」'], desc: '按当前规则生成座位表' },
        { icon: MousePointerClick, keys: ['拖动座位'], desc: '与目标座位交换，拖到空位即移动' },
        { icon: Hand, keys: ['点击座位'], desc: '查看安排理由、固定或设为禁区' },
      ],
    },
    {
      title: '编辑与视图',
      items: [
        { icon: Command, keys: ['Ctrl', 'Z'], desc: '撤销上一步调整' },
        { icon: Command, keys: ['Ctrl', 'Shift', 'Z'], desc: '重做' },
        { icon: Command, keys: ['Esc'], desc: '关闭面板 / 取消选择' },
        { icon: Command, keys: ['?'], desc: '打开快捷键面板' },
      ],
    },
  ];

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="快捷键与操作"
      subtitle="熟练之后，排座只需要几次点击"
      width={520}
    >
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="field-label mb-2">{group.title}</div>
            <div className="flex flex-col gap-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.desc}
                    className="flex items-center gap-3 rounded-[10px] border border-line bg-surface-warm px-3 py-2 transition-colors hover:border-line-strong"
                  >
                    <span className="grid size-7 place-items-center rounded-[8px] bg-card text-muted-foreground">
                      <Icon className="size-3.5" />
                    </span>
                    <span className="flex-1 text-[12px] text-ink">{item.desc}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-[5px] border border-line-strong bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-[0_1px_0_rgba(16,24,40,0.06)]"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function App() {
  useEffect(() => {
    const state = useAppStore.getState();
    if (!state.students.length || Object.keys(state.assignment).length) return;
    const timer = window.setTimeout(() => useAppStore.getState().solveNow(20261110), 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      const state = useAppStore.getState();
      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'z' && !typing) {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y' && !typing) {
        event.preventDefault();
        state.redo();
        return;
      }
      if (event.key === 'Escape') {
        if (state.importOpen) state.setImportOpen(false);
        else if (state.exportOpen) state.setExportOpen(false);
        else if (state.settingsOpen) state.setSettingsOpen(false);
        else if (state.versionsOpen) state.setVersionsOpen(false);
        else if (state.studentEditor.open) state.closeStudentEditor();
        else if (state.shortcutOpen) state.setShortcutOpen(false);
        else if (state.drawer) state.setDrawer(null);
        else {
          state.selectSlot(null);
          state.selectStudent(null);
        }
        return;
      }
      if (event.key === '?' && !typing && !mod) {
        event.preventDefault();
        state.setShortcutOpen(!state.shortcutOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <TooltipProvider delayDuration={280}>
      <div className="paper-bg paper-noise relative flex h-full flex-col overflow-hidden">
        <TopBar />
        <div className="relative flex min-h-0 flex-1">
          <StudentPanel />
          <SeatCanvas />
        </div>
        <StatusBar />

        <LayoutDrawer />
        <RuleDrawer />
        <ImportDialog />
        <ExportDialog />
        <StudentDialog />
        <SettingsDialog />
        <VersionDialog />
        <ShortcutsDialog />
        <Toasts />
      </div>
    </TooltipProvider>
  );
}
