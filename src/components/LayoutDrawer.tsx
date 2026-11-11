import { Minus, Plus, LayoutTemplate, Sparkles, Ban, Users } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { buildSlots, totalCols } from '../lib/layout';
import { Drawer, Segmented } from './ui';
import clsx from 'clsx';
import type { DeskType } from '../types';

const PRESETS: { rows: number; groups: number; deskType: DeskType; name: string }[] = [
  { rows: 6, groups: 5, deskType: 'single', name: '单桌 5 列' },
  { rows: 6, groups: 4, deskType: 'double', name: '双人桌 4 组' },
  { rows: 6, groups: 3, deskType: 'double', name: '双人桌 3 组' },
  { rows: 5, groups: 6, deskType: 'single', name: '单桌 6 列' },
];

function capacityOf(rows: number, groups: number, deskType: DeskType) {
  return rows * groups * (deskType === 'double' ? 2 : 1);
}

function MiniPreview({ rows, groups, deskType }: { rows: number; groups: number; deskType: DeskType }) {
  return (
    <div className="flex flex-col items-center gap-[3px]">
      {Array.from({ length: Math.min(rows, 6) }).map((_, r) => (
        <div key={r} className="flex items-center gap-[3px]">
          {Array.from({ length: Math.min(groups, 5) }).map((__, g) => (
            <span key={g} className="flex gap-[2px]">
              {Array.from({ length: deskType === 'double' ? 2 : 1 }).map((___, i) => (
                <span
                  key={i}
                  className="h-[4px] w-[4px] rounded-[1.5px] bg-[#c9c4b7]"
                />
              ))}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LayoutDrawer() {
  const drawer = useAppStore((s) => s.drawer);
  const setDrawer = useAppStore((s) => s.setDrawer);
  const layout = useAppStore((s) => s.layout);
  const setLayout = useAppStore((s) => s.setLayout);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const students = useAppStore((s) => s.students);
  const solveNow = useAppStore((s) => s.solveNow);
  const solving = useAppStore((s) => s.solving);

  const slots = buildSlots(layout);
  const capacity = slots.filter((s) => !s.blocked).length;
  const blockedCount = layout.blocked.length;
  const short = students.length - capacity;
  const cols = totalCols(layout);

  return (
    <Drawer
      open={drawer === 'layout'}
      onClose={() => setDrawer(null)}
      title="座位布局"
      subtitle="选择预设或自定义行列，画布实时预览"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            className="btn btn-ghost text-[11.5px]"
            onClick={() => setLayout({ blocked: [] })}
            disabled={!blockedCount}
          >
            <Ban size={13} /> 清空禁区
          </button>
          <button className="btn btn-primary" onClick={() => solveNow()} disabled={solving}>
            <Sparkles size={13} /> 应用并重排
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <LayoutTemplate size={13} className="text-muted-foreground" />
            <h3 className="text-[12px] font-semibold">预设布局</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => {
              const active =
                layout.rows === preset.rows &&
                layout.groups === preset.groups &&
                layout.deskType === preset.deskType;
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset.rows, preset.groups, preset.deskType)}
                  className={clsx(
                    'flex items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-all',
                    active
                      ? 'border-[rgba(61,90,254,0.5)] bg-primary-soft shadow-[0_4px_14px_rgba(61,90,254,0.1)]'
                      : 'border-line bg-white hover:border-line-strong',
                  )}
                >
                  <div className="grid h-10 w-11 shrink-0 place-items-center rounded-[8px] bg-surface-warm">
                    <MiniPreview
                      rows={preset.rows}
                      groups={preset.groups}
                      deskType={preset.deskType}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className={clsx('text-[12px] font-medium', active && 'text-primary')}>
                      {preset.name}
                    </div>
                    <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {preset.rows} 排 · {capacityOf(preset.rows, preset.groups, preset.deskType)} 座
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[14px] border border-line bg-white px-4 py-3.5">
          <h3 className="mb-3 text-[12px] font-semibold">自定义</h3>
          <div className="flex flex-col gap-3">
            <Stepper
              label="排数"
              value={layout.rows}
              min={1}
              max={10}
              onChange={(rows) => setLayout({ rows })}
            />
            <Stepper
              label={layout.deskType === 'double' ? '桌组数' : '列数'}
              value={layout.groups}
              min={1}
              max={8}
              onChange={(groups) => setLayout({ groups })}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-muted-foreground">桌型</span>
              <Segmented
                value={layout.deskType}
                onChange={(deskType) => setLayout({ deskType })}
                options={[
                  { value: 'single', label: '单人桌' },
                  { value: 'double', label: '双人桌' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11.5px] text-muted-foreground">讲台方向</span>
              <Segmented
                value={layout.podiumSide}
                onChange={(podiumSide) => setLayout({ podiumSide })}
                options={[
                  { value: 'top', label: '上方' },
                  { value: 'bottom', label: '下方' },
                ]}
              />
            </div>
          </div>
          <div className="mt-3 rounded-[9px] bg-surface-warm px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
            双人桌时每 2 人共用一张桌子（自动建立同桌关系）；单人桌每人独立。过道会随组数自动留白。
          </div>
        </section>

        <section className="rounded-[14px] border border-line bg-surface-warm px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12px] font-medium">
              <Users size={13} className="text-muted-foreground" />
              容量
            </div>
            <div className="text-[11px] tabular-nums text-muted-foreground">
              学生 <span className="font-semibold text-ink">{students.length}</span> · 座位{' '}
              <span className="font-semibold text-ink">{capacity}</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[9px] bg-white px-2 py-2">
              <div className="text-[14px] font-semibold tabular-nums">{cols}</div>
              <div className="text-[9.5px] text-muted-foreground">座位列数</div>
            </div>
            <div className="rounded-[9px] bg-white px-2 py-2">
              <div className="text-[14px] font-semibold tabular-nums">{blockedCount}</div>
              <div className="text-[9.5px] text-muted-foreground">禁区数</div>
            </div>
            <div className="rounded-[9px] bg-white px-2 py-2">
              <div className="text-[14px] font-semibold tabular-nums">
                {Math.max(0, capacity - students.length)}
              </div>
              <div className="text-[9.5px] text-muted-foreground">空余座位</div>
            </div>
          </div>
          {short > 0 && (
            <div className="mt-2 rounded-[8px] bg-danger-soft px-2.5 py-1.5 text-[10.5px] text-[#b34a43]">
              座位不足，还差 {short} 个。请增加排数/组数，或把禁区恢复为可用座位。
            </div>
          )}
          <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            提示：点击画布任意座位，可在右下角面板中将其设为「禁区」或清空。
          </div>
        </section>
      </div>
    </Drawer>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          className="grid h-6 w-6 place-items-center rounded-[7px] border border-line bg-white text-muted-foreground transition-colors hover:text-ink disabled:opacity-40"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`减少${label}`}
        >
          <Minus size={12} />
        </button>
        <span className="w-9 text-center text-[12.5px] font-medium tabular-nums">{value}</span>
        <button
          className="grid h-6 w-6 place-items-center rounded-[7px] border border-line bg-white text-muted-foreground transition-colors hover:text-ink disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`增加${label}`}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
