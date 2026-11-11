import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { CustomAction, CustomRule, CustomStrength, Rule, Zone } from '../types';
import {
  ACTION_LABEL,
  CATEGORY_LABEL,
  STRENGTH_LABEL,
  ZONE_LABEL,
} from '../types';
import {
  BUILTIN_META,
  createCustomRule,
  defaultWeightForStrength,
  formatSlotId,
  ruleDescription,
  ruleTitle,
} from '../lib/rules';
import { totalCols } from '../lib/layout';
import { Drawer, Field, ScoreRing, Segmented, Switch } from './ui';
import clsx from 'clsx';

export function RuleDrawer() {
  const drawer = useAppStore((s) => s.drawer);
  const setDrawer = useAppStore((s) => s.setDrawer);
  const rules = useAppStore((s) => s.rules);
  const updateRule = useAppStore((s) => s.updateRule);
  const addCustomRule = useAppStore((s) => s.addCustomRule);
  const removeRule = useAppStore((s) => s.removeRule);
  const resetRules = useAppStore((s) => s.resetRules);
  const score = useAppStore((s) => s.score);
  const satisfactions = useAppStore((s) => s.satisfactions);
  const solveNow = useAppStore((s) => s.solveNow);
  const solving = useAppStore((s) => s.solving);
  const notify = useAppStore((s) => s.notify);

  const [editing, setEditing] = useState<CustomRule | null>(null);

  const builtins = rules.filter((r) => r.kind === 'builtin');
  const customs = rules.filter((r) => r.kind === 'custom');
  const sortedSats = useMemo(
    () => [...satisfactions].sort((a, b) => a.sat - b.sat),
    [satisfactions],
  );

  const startNew = () => {
    setEditing(createCustomRule({ name: '近视学生优先前排', condition: { field: 'trait', op: 'contains', value: '近视' }, action: 'preferZone', target: { zone: 'front' }, strength: 'strong', weight: 90 }));
  };

  return (
    <Drawer
      open={drawer === 'rules'}
      onClose={() => {
        setEditing(null);
        setDrawer(null);
      }}
      title="排座规则"
      subtitle="自定义规则优先于内置软规则；硬约束不满足会阻止生成"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button className="btn btn-ghost text-[11.5px]" onClick={resetRules}>
            <RotateCcw size={13} /> 恢复默认
          </button>
          <button
            className="btn btn-primary"
            disabled={solving}
            onClick={() => solveNow()}
          >
            <Sparkles size={13} /> 应用并重排
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4 rounded-[14px] border border-line bg-surface-warm px-4 py-3">
          <ScoreRing value={score} size={62} stroke={6} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold">本次排座满足度</div>
            <div className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
              {satisfactions.filter((s) => s.sat < 0.999).length === 0
                ? '所有启用的规则均已满足'
                : `${satisfactions.filter((s) => s.sat < 0.999).length} 条规则仍有提升空间，点击下方权重调整后重排`}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {sortedSats.slice(0, 3).map((sat) => (
                <span
                  key={sat.ruleId}
                  className={clsx(
                    'tag-chip',
                    sat.sat >= 0.999
                      ? 'bg-ok-soft text-[#2c8463]'
                      : sat.sat >= 0.7
                        ? 'bg-warn-soft text-[#a9761f]'
                        : 'bg-danger-soft text-[#b34a43]',
                  )}
                >
                  {sat.name} {Math.round(sat.sat * 100)}%
                </span>
              ))}
            </div>
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold">内置规则</h3>
            <span className="text-[10px] text-muted-foreground">开关 + 权重 1–100</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {builtins.map((rule) => (
              <BuiltinRow key={rule.id} rule={rule} onChange={updateRule} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold">自定义规则</h3>
            <button className="btn btn-ghost h-7 px-2 text-[11px]" onClick={startNew}>
              <Plus size={12} /> 新建
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:border-[rgba(61,90,254,0.35)] hover:text-primary"
              onClick={() => {
                setEditing(
                  createCustomRule({
                    name: '高个学生优先后排',
                    condition: { field: 'trait', op: 'contains', value: '高个' },
                    action: 'preferZone',
                    target: { zone: 'back' },
                    strength: 'strong',
                    weight: 90,
                  }),
                );
              }}
            >
              + 高个坐后排
            </button>
            <button
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:border-[rgba(61,90,254,0.35)] hover:text-primary"
              onClick={() => {
                setEditing(
                  createCustomRule({
                    name: '听力弱的学生靠前',
                    condition: { field: 'trait', op: 'contains', value: '听力' },
                    action: 'preferZone',
                    target: { zone: 'front' },
                    strength: 'must',
                    weight: 100,
                  }),
                );
              }}
            >
              + 听力弱坐前排
            </button>
            <button
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:border-[rgba(61,90,254,0.35)] hover:text-primary"
              onClick={() =>
                setEditing(
                  createCustomRule({
                    name: '两名学生不许相邻',
                    condition: { field: 'name', op: 'eq', value: '' },
                    action: 'avoidAdjacent',
                    target: {},
                    strength: 'must',
                    weight: 100,
                  }),
                )
              }
            >
              + 两人不相邻
            </button>
            <button
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] text-muted-foreground transition-colors hover:border-[rgba(61,90,254,0.35)] hover:text-primary"
              onClick={() =>
                setEditing(
                  createCustomRule({
                    name: '男女同桌不超过 50%',
                    action: 'genderMix',
                    target: { ratio: 50, ratioMode: 'max' },
                    strength: 'strong',
                    weight: 90,
                  }),
                )
              }
            >
              + 男女同桌≤50%
            </button>
          </div>

          {editing ? (
            <CustomRuleEditor
              key={editing.id}
              initial={editing}
              onCancel={() => setEditing(null)}
              onSave={(rule) => {
                const exists = customs.some((r) => r.id === rule.id);
                if (exists) updateRule(rule.id, rule);
                else addCustomRule(rule);
                setEditing(null);
                notify(`规则「${rule.name}」已保存，重排后生效`, 'success');
              }}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              {customs.length === 0 && (
                <div className="rounded-[12px] border border-dashed border-line px-4 py-5 text-center text-[11px] leading-relaxed text-muted-foreground">
                  还没有自定义规则
                  <br />
                  用「条件 + 动作 + 强度」三步搭建，优先于内置软规则
                </div>
              )}
              {customs.map((rule) => (
                <CustomRuleRow
                  key={rule.id}
                  rule={rule}
                  onChange={updateRule}
                  onEdit={() => setEditing(rule)}
                  onRemove={() => {
                    removeRule(rule.id);
                    notify('规则已删除', 'info');
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold">满足度明细</h3>
          <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-white px-3.5 py-3">
            {satisfactions.length === 0 && (
              <div className="text-[11px] text-muted-foreground">尚未生成排座结果</div>
            )}
            {satisfactions.map((sat) => (
              <div key={sat.ruleId}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {sat.kind === 'custom' && (
                      <span className="rounded-[4px] bg-[#f1efe8] px-1 text-[9px] text-muted-foreground">
                        自定义
                      </span>
                    )}
                    <span className="truncate font-medium">{sat.name}</span>
                  </span>
                  <span
                    className={clsx(
                      'shrink-0 tabular-nums',
                      sat.sat >= 0.999
                        ? 'text-ok'
                        : sat.sat >= 0.7
                          ? 'text-warn'
                          : 'text-danger',
                    )}
                  >
                    {Math.round(sat.sat * 100)}%
                  </span>
                </div>
                <div className="stat-bar mt-1">
                  <span
                    style={{
                      width: `${Math.round(sat.sat * 100)}%`,
                      background:
                        sat.sat >= 0.999 ? '#3FB68B' : sat.sat >= 0.7 ? '#E5A23C' : '#E5645C',
                    }}
                  />
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{sat.detail}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-start gap-2 rounded-[12px] bg-primary-soft px-3.5 py-2.5 text-[10.5px] leading-relaxed text-[#4453a8]">
          <Wand2 size={13} className="mt-0.5 shrink-0" />
          规则由确定性求解器执行：所有「必须」硬约束优先满足，其次按权重最大化软规则满足度。
        </div>
      </div>
    </Drawer>
  );
}

function BuiltinRow({
  rule,
  onChange,
}: {
  rule: Rule;
  onChange: (id: string, patch: Partial<Rule>) => void;
}) {
  if (rule.kind !== 'builtin') return null;
  const meta = BUILTIN_META[rule.builtin];
  return (
    <div
      className={clsx(
        'rounded-[12px] border px-3 py-2.5 transition-colors',
        rule.enabled ? 'border-line bg-white' : 'border-line/70 bg-surface-warm/60',
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium">{meta.name}</span>
            <span className="text-[9.5px] tabular-nums text-muted-foreground">权重 {rule.weight}</span>
          </div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{meta.desc}</p>
        </div>
        <Switch
          checked={rule.enabled}
          onChange={(checked) => onChange(rule.id, { enabled: checked })}
        />
      </div>
      {rule.enabled && (
        <input
          type="range"
          min={1}
          max={100}
          value={rule.weight}
          className="slider mt-1.5"
          style={{ ['--fill' as any]: `${rule.weight}%` }}
          onChange={(e) => onChange(rule.id, { weight: Number(e.target.value) })}
        />
      )}
    </div>
  );
}

function CustomRuleRow({
  rule,
  onChange,
  onEdit,
  onRemove,
}: {
  rule: CustomRule;
  onChange: (id: string, patch: Partial<Rule>) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group rounded-[12px] border border-line bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[12px] font-medium">{rule.name}</span>
            <span
              className={clsx(
                'rounded-[4px] px-1 text-[9px] font-medium',
                rule.strength === 'must'
                  ? 'bg-danger-soft text-[#b34a43]'
                  : rule.strength === 'strong'
                    ? 'bg-primary-soft text-[#3446c9]'
                    : 'bg-[#f1efe8] text-muted-foreground',
              )}
            >
              {STRENGTH_LABEL[rule.strength]}
            </span>
            {rule.strength !== 'must' && (
              <span className="text-[9.5px] tabular-nums text-muted-foreground">权重 {rule.weight}</span>
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
            {ruleDescription(rule)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button className="icon-btn h-6 w-6" onClick={onEdit} title="编辑规则">
            <Pencil size={12} />
          </button>
          <button
            className="icon-btn h-6 w-6 hover:text-danger"
            onClick={onRemove}
            title="删除规则"
          >
            <Trash2 size={12} />
          </button>
          <Switch
            checked={rule.enabled}
            onChange={(checked) => onChange(rule.id, { enabled: checked })}
          />
        </div>
      </div>
      {rule.strength !== 'must' && rule.enabled && (
        <input
          type="range"
          min={1}
          max={100}
          value={rule.weight}
          className="slider mt-1.5"
          style={{ ['--fill' as any]: `${rule.weight}%` }}
          onChange={(e) => onChange(rule.id, { weight: Number(e.target.value) })}
        />
      )}
    </div>
  );
}

const ACTIONS: CustomAction[] = [
  'pin',
  'deskmate',
  'avoidAdjacent',
  'preferZone',
  'forbidZone',
  'genderMix',
];
const ZONES: Zone[] = ['front', 'back', 'middle', 'window', 'door'];

function CustomRuleEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: CustomRule;
  onCancel: () => void;
  onSave: (rule: CustomRule) => void;
}) {
  const students = useAppStore((s) => s.students);
  const layout = useAppStore((s) => s.layout);
  const [draft, setDraft] = useState<CustomRule>(initial);
  const [error, setError] = useState<string | null>(null);

  const patch = (partial: Partial<CustomRule>) => setDraft((prev) => ({ ...prev, ...partial }));
  const cols = totalCols(layout);

  const save = () => {
    if (
      draft.action !== 'genderMix' &&
      !draft.condition.value.trim() &&
      draft.condition.field !== 'height'
    ) {
      setError('请填写条件值，例如学生姓名或标签');
      return;
    }
    if (draft.action === 'genderMix') {
      const ratio = draft.target.ratio ?? 50;
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 100) {
        setError('比例需在 0–100 之间');
        return;
      }
    }
    if (draft.action === 'pin' && !draft.target.slotId) {
      setError('请选择目标座位');
      return;
    }
    if (
      (draft.action === 'deskmate' || draft.action === 'avoidAdjacent') &&
      !draft.target.studentId
    ) {
      setError('请选择目标学生');
      return;
    }
    const ratioText = `${draft.target.ratioMode === 'min' ? '不低于' : '不超过'} ${draft.target.ratio ?? 50}%`;
    const name =
      draft.name.trim() ||
      (draft.action === 'genderMix'
        ? `男女同桌${ratioText}`
        : `${ACTION_LABEL[draft.action]} · ${draft.condition.value || '条件'}`);
    onSave({
      ...draft,
      name,
      weight:
        draft.strength === 'must' ? 100 : draft.weight || defaultWeightForStrength(draft.strength),
    });
  };

  return (
    <div className="rounded-[14px] border border-[rgba(61,90,254,0.28)] bg-white p-3.5 shadow-[0_8px_24px_rgba(61,90,254,0.08)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-semibold">
          {initial.condition.value || initial.target.slotId ? '编辑规则' : '新建规则'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {draft.action === 'genderMix' ? '全班生效 · 无需条件' : '最多 3 层条件 · 当前为单条件'}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <Field label="规则名称">
          <input
            className="input h-8 text-[12px]"
            value={draft.name}
            placeholder="例如：近视学生坐前三排"
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>

        {draft.action !== 'genderMix' && (
          <div>
            <span className="field-label">条件</span>
            <div className="mt-1.5 grid grid-cols-[1fr_88px_1fr] gap-1.5">
              <select
                className="input h-8 text-[12px]"
                value={draft.condition.field}
                onChange={(e) => {
                  const field = e.target.value as CustomRule['condition']['field'];
                  const op = field === 'height' ? 'gt' : field === 'trait' || field === 'note' ? 'contains' : 'eq';
                  patch({ condition: { ...draft.condition, field, op } });
                }}
              >
                <option value="name">姓名</option>
                <option value="studentNo">学号</option>
                <option value="gender">性别</option>
                <option value="height">身高</option>
                <option value="trait">特点</option>
                <option value="note">备注</option>
              </select>
              <select
                className="input h-8 text-[12px]"
                value={draft.condition.op}
                onChange={(e) =>
                  patch({
                    condition: {
                      ...draft.condition,
                      op: e.target.value as CustomRule['condition']['op'],
                    },
                  })
                }
              >
                <option value="eq">等于</option>
                <option value="contains">包含</option>
                <option value="gt">大于</option>
                <option value="lt">小于</option>
              </select>
              <input
                className="input h-8 text-[12px]"
                value={draft.condition.value}
                placeholder={
                  draft.condition.field === 'gender'
                    ? '男 / 女'
                    : draft.condition.field === 'height'
                      ? '数值，如 180'
                      : '条件值'
                }
                onChange={(e) =>
                  patch({ condition: { ...draft.condition, value: e.target.value } })
                }
              />
            </div>
          </div>
        )}

        <div>
          <span className="field-label">动作</span>
          <select
            className="input mt-1.5 h-8 text-[12px]"
            value={draft.action}
            onChange={(e) => {
              const action = e.target.value as CustomAction;
              patch({
                action,
                target:
                  action === 'pin'
                    ? { slotId: draft.target.slotId ?? 'r1c1' }
                    : action === 'deskmate' || action === 'avoidAdjacent'
                      ? { studentId: draft.target.studentId }
                      : action === 'genderMix'
                        ? { ratio: draft.target.ratio ?? 50, ratioMode: draft.target.ratioMode ?? 'max' }
                        : { zone: draft.target.zone ?? 'front' },
              });
            }}
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABEL[action]}
              </option>
            ))}
          </select>
        </div>

        {draft.action === 'pin' && (
          <div>
            <span className="field-label">目标座位</span>
            <select
              className="input mt-1.5 h-8 text-[12px]"
              value={draft.target.slotId ?? 'r1c1'}
              onChange={(e) => patch({ target: { ...draft.target, slotId: e.target.value } })}
            >
              {Array.from({ length: layout.rows }).flatMap((_, r) =>
                Array.from({ length: cols }).map((__, c) => {
                  const id = `r${r + 1}c${c + 1}`;
                  return (
                    <option key={id} value={id}>
                      第 {r + 1} 排 · 第 {c + 1} 座
                    </option>
                  );
                }),
              )}
            </select>
          </div>
        )}

        {(draft.action === 'deskmate' || draft.action === 'avoidAdjacent') && (
          <div>
            <span className="field-label">目标学生</span>
            <select
              className="input mt-1.5 h-8 text-[12px]"
              value={draft.target.studentId ?? ''}
              onChange={(e) =>
                patch({ target: { ...draft.target, studentId: e.target.value } })
              }
            >
              <option value="">请选择学生</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}（{student.studentNo}）
                </option>
              ))}
            </select>
          </div>
        )}

        {(draft.action === 'preferZone' || draft.action === 'forbidZone') && (
          <div>
            <span className="field-label">区域</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ZONES.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => patch({ target: { ...draft.target, zone } })}
                  className={clsx(
                    'rounded-[7px] border px-2 py-1 text-[11px] transition-colors',
                    draft.target.zone === zone
                      ? 'border-[rgba(61,90,254,0.5)] bg-primary-soft text-primary'
                      : 'border-line bg-white text-muted-foreground hover:text-ink',
                  )}
                >
                  {ZONE_LABEL[zone]}
                </button>
              ))}
            </div>
          </div>
        )}

        {draft.action === 'genderMix' && (
          <div>
            <span className="field-label">男女同桌比例</span>
            <div className="mt-1.5 flex items-center gap-2">
              <Segmented
                value={draft.target.ratioMode ?? 'max'}
                onChange={(ratioMode) =>
                  patch({ target: { ...draft.target, ratioMode } })
                }
                options={[
                  { value: 'max', label: '不超过' },
                  { value: 'min', label: '不低于' },
                ]}
              />
              <div className="relative w-24">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  className="input h-8 pr-7 text-[12px]"
                  value={draft.target.ratio ?? 50}
                  onChange={(e) =>
                    patch({ target: { ...draft.target, ratio: Number(e.target.value) } })
                  }
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              按完整双人桌统计异性同桌占比，性别未知的学生不计入；对全班生效。
            </p>
          </div>
        )}

        <div>
          <span className="field-label">强度</span>
          <div className="mt-1.5 flex items-center gap-2">
            <Segmented
              value={draft.strength}
              onChange={(strength) =>
                patch({
                  strength,
                  weight:
                    strength === 'must' ? 100 : defaultWeightForStrength(strength as CustomStrength),
                })
              }
              options={[
                { value: 'must', label: '必须' },
                { value: 'strong', label: '强烈' },
                { value: 'normal', label: '普通' },
              ]}
            />
            {draft.strength === 'must' ? (
              <span className="flex items-center gap-1 text-[10px] text-danger">
                <ShieldAlert size={11} /> 硬约束
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">权重 {draft.weight}</span>
            )}
          </div>
          {draft.strength !== 'must' && (
            <input
              type="range"
              min={1}
              max={100}
              value={draft.weight}
              className="slider mt-2"
              style={{ ['--fill' as any]: `${draft.weight}%` }}
              onChange={(e) => patch({ weight: Number(e.target.value) })}
            />
          )}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 rounded-[8px] bg-danger-soft px-2.5 py-1.5 text-[11px] text-[#b34a43]">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button className="btn btn-ghost h-8 text-[11.5px]" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-primary h-8 text-[11.5px]" onClick={save}>
            <CheckCircle2 size={13} /> 保存规则
          </button>
        </div>
      </div>
    </div>
  );
}
