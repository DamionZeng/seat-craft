import { useEffect, useState } from 'react';
import { History, RotateCcw, Save, Trash2, UsersRound } from 'lucide-react';
import { MAX_VERSIONS, useAppStore } from '../store/useAppStore';
import { Modal } from './ui';

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PendingAction = { type: 'restore' | 'delete'; id: string; name: string };

export function VersionDialog() {
  const open = useAppStore((s) => s.versionsOpen);
  const setOpen = useAppStore((s) => s.setVersionsOpen);
  const versions = useAppStore((s) => s.versions);
  const saveVersion = useAppStore((s) => s.saveVersion);
  const restoreVersion = useAppStore((s) => s.restoreVersion);
  const deleteVersion = useAppStore((s) => s.deleteVersion);

  const [name, setName] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (!open) setPending(null);
  }, [open]);

  // 确认层打开时拦截 Esc，避免直接关掉整个版本面板
  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setPending(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [pending]);

  const save = () => {
    saveVersion(name);
    setName('');
  };

  const confirm = () => {
    if (!pending) return;
    if (pending.type === 'restore') restoreVersion(pending.id);
    else deleteVersion(pending.id);
    setPending(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="版本管理"
      subtitle={`保存当前方案快照，随时回退 · 最多保留 ${MAX_VERSIONS} 个版本`}
      width={660}
      footer={
        <button className="btn btn-soft" onClick={() => setOpen(false)}>
          关闭
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="rounded-[14px] border border-line bg-surface-warm px-4 py-3.5">
          <div className="field-label mb-2">保存当前版本</div>
          <div className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder="版本备注，例如：期中考试座位"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
            <button className="btn btn-primary shrink-0" onClick={save}>
              <Save size={13} /> 保存快照
            </button>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            快照包含班级名、名单、布局、规则与当前排座结果，保存在本机。
          </p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">
              <History size={14} className="text-muted-foreground" />
              历史版本
            </div>
            <span className="text-[10.5px] tabular-nums text-muted-foreground">
              {versions.length} / {MAX_VERSIONS}
            </span>
          </div>

          {versions.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-line-strong px-4 py-10 text-center text-[12px] text-muted-foreground">
              还没有保存过版本，先点上方「保存快照」记录当前方案
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center gap-3 rounded-[12px] border border-line bg-card px-3.5 py-2.5 transition-colors hover:border-line-strong"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary-soft text-primary">
                    <History size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{version.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                      <span>{formatTime(version.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <UsersRound className="size-2.5" />
                        {version.students.length} 人
                      </span>
                      <span>
                        {version.layout.rows} 排 × {version.layout.groups} 组
                      </span>
                      <span>满足度 {Math.round(version.score)}%</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-soft shrink-0"
                    onClick={() =>
                      setPending({ type: 'restore', id: version.id, name: version.name })
                    }
                  >
                    <RotateCcw size={12} /> 回退
                  </button>
                  <button
                    className="btn btn-danger shrink-0"
                    onClick={() =>
                      setPending({ type: 'delete', id: version.id, name: version.name })
                    }
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {pending && (
        <div
          className="absolute inset-0 z-30 grid place-items-center rounded-[20px] bg-ink/25 px-6 backdrop-blur-[2px]"
          onClick={() => setPending(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="version-confirm-title"
            className="w-full max-w-[380px] rounded-[16px] border border-line bg-popover p-5 shadow-[0_24px_60px_rgba(16,24,40,0.22)] animate-in fade-in-0 zoom-in-95 duration-150"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  pending.type === 'delete'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-primary-soft text-primary'
                }`}
              >
                {pending.type === 'delete' ? <Trash2 size={16} /> : <RotateCcw size={16} />}
              </span>
              <div className="min-w-0 pt-0.5">
                <h3
                  id="version-confirm-title"
                  className="text-[14px] font-semibold tracking-[-0.01em] text-ink"
                >
                  {pending.type === 'delete' ? '删除这个版本？' : '回退到这个版本？'}
                </h3>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">{pending.name}</p>
              </div>
            </div>

            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              {pending.type === 'delete'
                ? '该快照将从本机永久删除，不会影响当前排座方案。'
                : '当前未保存的调整会被覆盖，回退后撤销/重做记录也会清空。'}
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn btn-soft" onClick={() => setPending(null)}>
                取消
              </button>
              <button
                className={pending.type === 'delete' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirm}
              >
                {pending.type === 'delete' ? '确认删除' : '确认回退'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
