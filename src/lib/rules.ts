import type {
  BuiltinRule,
  BuiltinRuleId,
  CustomAction,
  CustomRule,
  CustomStrength,
  Rule,
  Student,
  Zone,
} from '../types';
import { ACTION_LABEL, STRENGTH_LABEL, ZONE_LABEL } from '../types';
import { uid } from './utils';

export const BUILTIN_META: Record<
  BuiltinRuleId,
  { name: string; desc: string; weight: number; enabled: boolean }
> = {
  height: {
    name: '身高阶梯',
    desc: '矮的坐前排，后排应高于前排，保证视线与镜头不被遮挡',
    weight: 70,
    enabled: true,
  },
  gender: {
    name: '男女搭配',
    desc: '双人桌优先一男一女同桌；单人桌退化为左右相邻交替',
    weight: 60,
    enabled: true,
  },
  trait: {
    name: '特点互补',
    desc: '性格行为差异互补、学习强弱配对，由语义引擎提供分数',
    weight: 65,
    enabled: true,
  },
  frontNeeds: {
    name: '特殊需求优先前排',
    desc: '近视 / 视力差 / 听力弱 / 身高低于 145cm 的学生优先前排',
    weight: 80,
    enabled: true,
  },
  tallBack: {
    name: '高个后排',
    desc: '身高 180cm 以上优先后排；超过 190cm 为硬约束，不得坐前两排',
    weight: 75,
    enabled: false,
  },
  avoidCluster: {
    name: '避免同标签聚集',
    desc: '「爱讲话」「坐不住」等负向行为标签的学生不相邻',
    weight: 55,
    enabled: false,
  },
};

export function createBuiltinRule(id: BuiltinRuleId): BuiltinRule {
  const meta = BUILTIN_META[id];
  return {
    id: `builtin_${id}`,
    kind: 'builtin',
    builtin: id,
    enabled: meta.enabled,
    weight: meta.weight,
  };
}

export const DEFAULT_RULES: Rule[] = (
  Object.keys(BUILTIN_META) as BuiltinRuleId[]
).map(createBuiltinRule);

export const BUILTIN_NAME: Record<BuiltinRuleId, string> = {
  height: BUILTIN_META.height.name,
  gender: BUILTIN_META.gender.name,
  trait: BUILTIN_META.trait.name,
  frontNeeds: BUILTIN_META.frontNeeds.name,
  tallBack: BUILTIN_META.tallBack.name,
  avoidCluster: BUILTIN_META.avoidCluster.name,
};

export function createCustomRule(partial?: Partial<CustomRule>): CustomRule {
  return {
    id: uid('rule'),
    kind: 'custom',
    name: '新规则',
    enabled: true,
    weight: 90,
    strength: 'strong',
    condition: { field: 'name', op: 'eq', value: '' },
    action: 'preferZone',
    target: { zone: 'front' },
    ...partial,
  };
}

export function defaultWeightForStrength(strength: CustomStrength): number {
  if (strength === 'must') return 100;
  if (strength === 'strong') return 90;
  return 60;
}

export function ruleTitle(rule: Rule): string {
  if (rule.kind === 'builtin') return BUILTIN_NAME[rule.builtin];
  return rule.name || ACTION_LABEL[rule.action];
}

export function ruleDescription(rule: Rule): string {
  if (rule.kind === 'builtin') return BUILTIN_META[rule.builtin].desc;
  const cond = describeCondition(rule);
  const target =
    rule.action === 'preferZone' || rule.action === 'forbidZone'
      ? ZONE_LABEL[rule.target.zone ?? 'front']
      : rule.action === 'pin'
        ? formatSlotId(rule.target.slotId)
        : rule.target.studentId
          ? '指定学生'
          : '未选择学生';
  return `${cond} → ${ACTION_LABEL[rule.action]}（${target}）`;
}

function describeCondition(rule: CustomRule): string {
  const { field, op, value } = rule.condition;
  const fieldLabel: Record<string, string> = {
    name: '姓名',
    studentNo: '学号',
    gender: '性别',
    height: '身高',
    trait: '特点',
    note: '备注',
  };
  const opLabel: Record<string, string> = {
    eq: '等于',
    contains: '包含',
    gt: '大于',
    lt: '小于',
  };
  return `${fieldLabel[field]}${opLabel[op]}「${value}」`;
}

export function formatSlotId(slotId?: string): string {
  if (!slotId) return '未选择座位';
  const m = /^r(\d+)c(\d+)$/.exec(slotId);
  if (!m) return slotId;
  return `第 ${m[1]} 排 · 第 ${m[2]} 座`;
}

export function matchStudents(rule: CustomRule, students: Student[]): Student[] {
  const { field, op, value } = rule.condition;
  if (!value && op !== 'gt' && op !== 'lt') return [];
  const v = value.trim();
  return students.filter((s) => {
    switch (field) {
      case 'name':
        return op === 'contains' ? s.name.includes(v) : s.name === v;
      case 'studentNo':
        return op === 'contains' ? s.studentNo.includes(v) : s.studentNo === v;
      case 'gender': {
        const g =
          v === '男' || v.toLowerCase() === 'male'
            ? 'male'
            : v === '女' || v.toLowerCase() === 'female'
              ? 'female'
              : 'unknown';
        return s.gender === g;
      }
      case 'height': {
        const n = Number(v);
        if (Number.isNaN(n) || s.height === undefined) return false;
        if (op === 'gt') return s.height > n;
        if (op === 'lt') return s.height < n;
        return s.height === n;
      }
      case 'trait':
        return s.traits.some(
          (t) =>
            (op === 'contains' ? t.text.includes(v) || t.raw.includes(v) : t.text === v),
        );
      case 'note':
        return op === 'contains' ? (s.note ?? '').includes(v) : (s.note ?? '') === v;
      default:
        return false;
    }
  });
}

export function describeCustomRuleSummary(
  action: CustomAction,
  strength: CustomStrength,
  zone?: Zone,
): string {
  return `${ACTION_LABEL[action]} · ${STRENGTH_LABEL[strength]}${zone ? ` · ${ZONE_LABEL[zone]}` : ''}`;
}
