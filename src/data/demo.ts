import type { LayoutConfig, Rule, Student } from '../types';
import { DEFAULT_RULES, createBuiltinRule } from '../lib/rules';
import { localTraitsFromRaw } from '../lib/semantics';

const NAMES_MALE = [
  '陈宇航', '李昊然', '王梓轩', '张子墨', '刘俊熙',
  '赵嘉煜', '周承宇', '吴启航', '徐一鸣', '孙浩然',
  '马天佑', '朱昱辰', '胡博文', '郭子涵', '何思远',
  '高晨阳', '林奕辰', '罗子健', '郑楷瑞', '谢明远',
];

const NAMES_FEMALE = [
  '林清越', '苏语桐', '沈知夏', '顾念安', '宋依然',
  '唐语汐', '许星禾', '何芷晴', '叶嘉宁', '蒋雨桐',
  '严可欣', '韩若曦', '曹若琳', '邓舒雅', '温以宁',
  '卢书瑶', '姜凝', '崔羽彤', '程一诺', '傅安然',
];

const TRAIT_POOL = [
  '数学拔尖，但坐不住',
  '话多，和谁都能聊',
  '近视，需要坐前排',
  '文静内向，不太主动',
  '英语较弱，需要帮扶',
  '自律专注，习惯好',
  '听力较弱，需要靠前',
  '个子高，喜欢篮球',
  '幽默开朗，人缘好',
  '需要老师多盯',
  '语文好，写作强',
  '数学薄弱，需要帮扶',
  '调皮，爱搞小动作',
  '音乐特长，性格敏感',
  '成绩优秀，乐于助人',
  '活泼外向，爱表达',
];

function makeId(index: number, prefix: string) {
  return `${prefix}_${String(index).padStart(3, '0')}`;
}

/** 生成一批可演示的示例学生（可被老师直接覆盖或删除） */
export function createDemoStudents(): Student[] {
  const list: Student[] = [];
  for (let i = 0; i < 40; i++) {
    const isMale = i % 2 === 0;
    const name = isMale
      ? NAMES_MALE[Math.floor(i / 2)]
      : NAMES_FEMALE[Math.floor(i / 2)];
    const height = isMale
      ? 158 + ((i * 7) % 31)
      : 148 + ((i * 5) % 27);
    const raw = TRAIT_POOL[i % TRAIT_POOL.length];
    list.push({
      id: makeId(i + 1, 'stu'),
      studentNo: `2026${String(i + 1).padStart(3, '0')}`,
      name,
      gender: isMale ? 'male' : 'female',
      height,
      traits: localTraitsFromRaw(raw),
      note: '',
    });
  }
  return list;
}

export const DEMO_LAYOUT: LayoutConfig = {
  rows: 5,
  groups: 4,
  deskType: 'double',
  podiumSide: 'top',
  blocked: [],
};

export const DEMO_RULES: Rule[] = DEFAULT_RULES.map((rule) =>
  rule.kind === 'builtin' ? { ...rule, enabled: rule.builtin !== 'tallBack' } : rule,
);

export const DEMO_CLASS_NAME = '高二 (3) 班 · 示例';

export function createEmptyRuleSet(): Rule[] {
  return [
    createBuiltinRule('height'),
    createBuiltinRule('gender'),
    createBuiltinRule('trait'),
    createBuiltinRule('frontNeeds'),
    createBuiltinRule('tallBack'),
    createBuiltinRule('avoidCluster'),
  ];
}
