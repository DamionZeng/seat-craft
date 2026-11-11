export type Gender = 'male' | 'female' | 'unknown';

export type TraitCategory = 'personality' | 'behavior' | 'study' | 'other';
export type Polarity = 'positive' | 'negative' | 'neutral';
export type SemanticMode = 'local' | 'ai' | 'manual';

export interface Trait {
  id: string;
  /** 归一后的标签名，用于互补计算与展示 */
  text: string;
  /** 老师原始输入的自由文本片段 */
  raw: string;
  category: TraitCategory;
  polarity: Polarity;
  strength: 1 | 2 | 3;
  source: SemanticMode;
  clusterId?: string;
}

export interface Student {
  id: string;
  studentNo: string;
  name: string;
  gender: Gender;
  height?: number;
  note?: string;
  traits: Trait[];
  /** 老师手动固定的座位 */
  fixedSlotId?: string;
}

export type DeskType = 'single' | 'double';

export interface LayoutConfig {
  rows: number;
  groups: number;
  deskType: DeskType;
  podiumSide: 'top' | 'bottom';
  blocked: string[];
}

export type Zone = 'front' | 'back' | 'middle' | 'window' | 'door';

export interface Slot {
  id: string;
  /** 1-based，1 = 最靠讲台的一排 */
  row: number;
  /** 1-based，老师视角从左到右 */
  col: number;
  /** 1-based 桌组 */
  group: number;
  indexInGroup: number;
  deskId: string;
  zones: Zone[];
  blocked: boolean;
}

export interface Desk {
  id: string;
  row: number;
  group: number;
  slotIds: string[];
}

export type BuiltinRuleId =
  | 'height'
  | 'gender'
  | 'trait'
  | 'frontNeeds'
  | 'tallBack'
  | 'avoidCluster';

export interface BuiltinRule {
  id: string;
  kind: 'builtin';
  builtin: BuiltinRuleId;
  enabled: boolean;
  weight: number;
}

export type CustomAction =
  | 'pin'
  | 'deskmate'
  | 'avoidAdjacent'
  | 'preferZone'
  | 'forbidZone';

export type CustomStrength = 'must' | 'strong' | 'normal';

export type ConditionField = 'name' | 'studentNo' | 'gender' | 'height' | 'trait' | 'note';
export type ConditionOp = 'eq' | 'contains' | 'gt' | 'lt';

export interface RuleCondition {
  field: ConditionField;
  op: ConditionOp;
  value: string;
}

export interface CustomRule {
  id: string;
  kind: 'custom';
  name: string;
  enabled: boolean;
  weight: number;
  strength: CustomStrength;
  condition: RuleCondition;
  action: CustomAction;
  target: {
    slotId?: string;
    studentId?: string;
    zone?: Zone;
    row?: number;
  };
}

export type Rule = BuiltinRule | CustomRule;

export type Assignment = Record<string, string>; // slotId -> studentId

export interface RuleSatisfaction {
  ruleId: string;
  name: string;
  kind: 'builtin' | 'custom';
  weight: number;
  sat: number; // 0..1
  detail: string;
  violations: number;
}

export interface SolveInput {
  students: Student[];
  slots: Slot[];
  rules: Rule[];
  layout: LayoutConfig;
  complement: Record<string, number>;
  seed: number;
  maxIterations?: number;
  timeBudget?: number;
}

export interface SolveResult {
  ok: boolean;
  conflicts: string[];
  warnings: string[];
  assignment: Assignment;
  score: number; // 0..100
  satisfactions: RuleSatisfaction[];
  reasons: Record<string, string[]>;
  iterations: number;
  ms: number;
  seed: number;
}

export interface TagCluster {
  id: string;
  name: string;
  category: TraitCategory;
  polarity: Polarity;
  count: number;
}

export interface ClassInfo {
  id: string;
  name: string;
  grade?: string;
}

export const GENDER_LABEL: Record<Gender, string> = {
  male: '男',
  female: '女',
  unknown: '未填',
};

export const ZONE_LABEL: Record<Zone, string> = {
  front: '前排',
  back: '后排',
  middle: '中间',
  window: '靠窗',
  door: '靠门',
};

export const ACTION_LABEL: Record<CustomAction, string> = {
  pin: '固定到指定座位',
  deskmate: '与指定学生同桌',
  avoidAdjacent: '不与指定学生相邻',
  preferZone: '优先安排到区域',
  forbidZone: '禁止安排到区域',
};

export const STRENGTH_LABEL: Record<CustomStrength, string> = {
  must: '必须',
  strong: '强烈',
  normal: '普通',
};

export const CATEGORY_LABEL: Record<TraitCategory, string> = {
  personality: '性格',
  behavior: '行为',
  study: '学习',
  other: '其他',
};
