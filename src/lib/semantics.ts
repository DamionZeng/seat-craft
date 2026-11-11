import type {
  Polarity,
  SemanticMode,
  Student,
  TagCluster,
  Trait,
  TraitCategory,
} from '../types';
import { pairKey, uid } from './utils';

interface LexEntry {
  tag: string;
  category: TraitCategory;
  polarity: Polarity;
  strength: 1 | 2 | 3;
  keywords: string[];
}

/** 本地同义词词典：离线模式下的语义兜底（约 200 组关键词） */
const LEXICON: LexEntry[] = [
  // 性格
  {
    tag: '活跃外向',
    category: 'personality',
    polarity: 'positive',
    strength: 2,
    keywords: ['活泼', '活跃', '外向', '开朗', '热情', '积极', '爱表达', '阳光', '大方'],
  },
  {
    tag: '安静内向',
    category: 'personality',
    polarity: 'neutral',
    strength: 2,
    keywords: ['安静', '内向', '文静', '沉默', '慢热', '不爱说话', '腼腆', '害羞'],
  },
  {
    tag: '幽默风趣',
    category: 'personality',
    polarity: 'positive',
    strength: 2,
    keywords: ['幽默', '搞笑', '风趣', '有趣', '段子'],
  },
  {
    tag: '敏感情绪化',
    category: 'personality',
    polarity: 'negative',
    strength: 2,
    keywords: ['敏感', '玻璃心', '情绪化', '易哭', '脆弱', '压力大'],
  },
  {
    tag: '自信',
    category: 'personality',
    polarity: 'positive',
    strength: 1,
    keywords: ['自信', '有主见', '独立'],
  },
  // 行为
  {
    tag: '爱讲话',
    category: 'behavior',
    polarity: 'negative',
    strength: 3,
    keywords: ['话多', '爱说话', '话痨', '爱聊天', '和谁都能聊', '爱讲话', '说个不停', '嘴碎'],
  },
  {
    tag: '坐不住',
    category: 'behavior',
    polarity: 'negative',
    strength: 3,
    keywords: ['坐不住', '好动', '动来动去', '注意力不集中', '走神', '分心', '小动作'],
  },
  {
    tag: '需要关注',
    category: 'behavior',
    polarity: 'negative',
    strength: 2,
    keywords: ['需要关注', '需要盯', '需要督促', '需要提醒', '需要老师多盯', '需要管', '自控差'],
  },
  {
    tag: '自律专注',
    category: 'behavior',
    polarity: 'positive',
    strength: 2,
    keywords: ['自律', '自觉', '专注', '认真', '踏实', '守纪律', '习惯好'],
  },
  {
    tag: '调皮',
    category: 'behavior',
    polarity: 'negative',
    strength: 2,
    keywords: ['调皮', '捣蛋', '淘气', '闹', '爱玩'],
  },
  {
    tag: '乐于助人',
    category: 'behavior',
    polarity: 'positive',
    strength: 2,
    keywords: ['乐于助人', '热心', '负责', '爱帮忙', '带动'],
  },
  // 学习
  {
    tag: '数学强',
    category: 'study',
    polarity: 'positive',
    strength: 3,
    keywords: ['数学好', '数学拔尖', '数学强', '数学优秀', '理科好', '数学成绩好'],
  },
  {
    tag: '数学弱',
    category: 'study',
    polarity: 'negative',
    strength: 3,
    keywords: ['数学弱', '数学差', '数学不好', '数学薄弱', '数学吃力', '数学基础差'],
  },
  {
    tag: '语文强',
    category: 'study',
    polarity: 'positive',
    strength: 3,
    keywords: ['语文好', '语文强', '语文优秀', '写作好', '作文好'],
  },
  {
    tag: '语文弱',
    category: 'study',
    polarity: 'negative',
    strength: 3,
    keywords: ['语文弱', '语文差', '语文不好', '阅读弱', '作文弱'],
  },
  {
    tag: '英语强',
    category: 'study',
    polarity: 'positive',
    strength: 3,
    keywords: ['英语好', '英语强', '英语优秀', '口语好'],
  },
  {
    tag: '英语弱',
    category: 'study',
    polarity: 'negative',
    strength: 3,
    keywords: ['英语弱', '英语差', '英语不好', '英语薄弱'],
  },
  {
    tag: '成绩优秀',
    category: 'study',
    polarity: 'positive',
    strength: 2,
    keywords: ['成绩好', '学习好', '优秀', '学霸', '名列前茅'],
  },
  {
    tag: '需要帮扶',
    category: 'study',
    polarity: 'negative',
    strength: 2,
    keywords: ['成绩差', '基础差', '学习吃力', '需要帮扶', '跟不上', '学习弱'],
  },
  // 其他 / 身体条件
  {
    tag: '近视',
    category: 'other',
    polarity: 'negative',
    strength: 3,
    keywords: ['近视', '视力差', '看不清', '戴眼镜', '配镜'],
  },
  {
    tag: '听力弱',
    category: 'other',
    polarity: 'negative',
    strength: 3,
    keywords: ['听力弱', '听力不好', '耳朵不好', '听不清'],
  },
  {
    tag: '个子高',
    category: 'other',
    polarity: 'neutral',
    strength: 2,
    keywords: ['高个', '个子高', '身高高', '太高', '长得高'],
  },
  {
    tag: '个子矮',
    category: 'other',
    polarity: 'neutral',
    strength: 2,
    keywords: ['个子矮', '身材矮', '身高矮', '矮小'],
  },
  {
    tag: '体育特长',
    category: 'other',
    polarity: 'positive',
    strength: 1,
    keywords: ['体育好', '运动好', '爱运动', '篮球', '足球', '田径'],
  },
  {
    tag: '艺术特长',
    category: 'other',
    polarity: 'positive',
    strength: 1,
    keywords: ['画画', '美术', '音乐', '舞蹈', '艺术', '乐器'],
  },
  {
    tag: '班干部',
    category: 'other',
    polarity: 'positive',
    strength: 2,
    keywords: ['班长', '班干部', '学习委员', '课代表', '组长'],
  },
];

/** 把老师填写的自由文本切分为片段 */
export function splitTraitText(text: string): string[] {
  return text
    .split(/[、，,;；/|｜\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function localTraitsFromRaw(raw: string): Trait[] {
  const hits: LexEntry[] = [];
  for (const entry of LEXICON) {
    if (entry.keywords.some((kw) => raw.includes(kw))) hits.push(entry);
  }
  if (!hits.length) {
    return [
      {
        id: uid('tr'),
        text: raw.trim(),
        raw: raw.trim(),
        category: 'other',
        polarity: 'neutral',
        strength: 1,
        source: 'local',
      },
    ];
  }
  // 避免同一片段产生过多标签，最多保留 3 个
  return hits.slice(0, 3).map((entry) => ({
    id: uid('tr'),
    text: entry.tag,
    raw: raw.trim(),
    category: entry.category,
    polarity: entry.polarity,
    strength: entry.strength,
    source: 'local' as SemanticMode,
  }));
}

export function enrichTraits(rawText: string): Trait[] {
  return splitTraitText(rawText).flatMap(localTraitsFromRaw);
}

function traitPairScore(a: Trait, b: Trait): number {
  if (a.text === b.text) return 0;
  if (a.category === 'study' && b.category === 'study') {
    if (a.polarity !== 'neutral' && b.polarity !== 'neutral' && a.polarity !== b.polarity) {
      return 1;
    }
    if (a.polarity === 'neutral' || b.polarity === 'neutral') return 0.3;
    return 0;
  }
  if (
    (a.category === 'personality' || a.category === 'behavior') &&
    (b.category === 'personality' || b.category === 'behavior')
  ) {
    if (a.polarity !== 'neutral' && b.polarity !== 'neutral' && a.polarity !== b.polarity) {
      return 0.85;
    }
    return 0.55;
  }
  return 0;
}

/** 两个学生的特点互补分（0..1），取最优标签对 */
export function studentComplement(a: Student, b: Student): number {
  let best = 0;
  for (const ta of a.traits) {
    for (const tb of b.traits) {
      const v = traitPairScore(ta, tb);
      if (v > best) best = v;
    }
  }
  return best;
}

export function buildComplementMatrix(students: Student[]): Record<string, number> {
  const matrix: Record<string, number> = {};
  for (let i = 0; i < students.length; i++) {
    for (let j = i + 1; j < students.length; j++) {
      const a = students[i];
      const b = students[j];
      const score = Math.max(studentComplement(a, b), heightComplement(a, b));
      matrix[pairKey(a.id, b.id)] = score;
    }
  }
  return matrix;
}

function heightComplement(a: Student, b: Student): number {
  if (a.height && b.height) {
    return Math.min(0.3, Math.abs(a.height - b.height) / 100);
  }
  return 0;
}

export function complementOf(
  matrix: Record<string, number>,
  a: string,
  b: string,
): number {
  return matrix[pairKey(a, b)] ?? 0;
}

/** 从学生标签生成语义簇（本地模式：按标签名聚合） */
export function buildLocalClusters(students: Student[]): TagCluster[] {
  const map = new Map<string, TagCluster>();
  for (const student of students) {
    for (const trait of student.traits) {
      const existing = map.get(trait.text);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(trait.text, {
          id: `cluster_${trait.text}`,
          name: trait.text,
          category: trait.category,
          polarity: trait.polarity,
          count: 1,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export const FRONT_NEED_TAGS = ['近视', '听力弱', '个子矮'];
export const TALL_TAGS = ['个子高'];

export function needsFront(student: Student): boolean {
  if (student.height !== undefined && student.height < 145) return true;
  return student.traits.some(
    (t) => FRONT_NEED_TAGS.includes(t.text) || /近视|视力|听力/.test(t.raw),
  );
}

export function isTall(student: Student): boolean {
  if (student.height !== undefined && student.height >= 180) return true;
  return student.traits.some((t) => TALL_TAGS.includes(t.text) || /高个|个子高/.test(t.raw));
}

export function isVeryTall(student: Student): boolean {
  return student.height !== undefined && student.height > 190;
}

export function hasNegativeBehaviorTag(student: Student): string | null {
  const trait = student.traits.find(
    (t) => t.category === 'behavior' && t.polarity === 'negative',
  );
  return trait ? trait.text : null;
}
