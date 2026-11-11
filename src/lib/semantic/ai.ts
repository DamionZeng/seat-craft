import type { Polarity, SemanticMode, Student, TagCluster, Trait, TraitCategory } from '../../types';
import { splitTraitText, localTraitsFromRaw } from '../semantics';
import { uid } from '../utils';

export interface AiSettings {
  enabled: boolean;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
  strictMask: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  apiKey: '',
  chatModel: 'Qwen/Qwen2.5-7B-Instruct',
  embeddingModel: 'BAAI/bge-m3',
  strictMask: true,
};

const BASE_URL = 'https://api.siliconflow.cn/v1';
const TIMEOUT = 4000;

async function request(path: string, body: unknown, apiKey: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`SiliconFlow ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function maskNames(text: string, names: string[]): string {
  let out = text;
  for (const name of names) {
    if (!name || name.length < 2) continue;
    out = out.split(name).join('某同学');
  }
  return out;
}

const CATEGORY_MAP: Record<string, TraitCategory> = {
  性格: 'personality',
  行为: 'behavior',
  学习: 'study',
  其他: 'other',
  personality: 'personality',
  behavior: 'behavior',
  study: 'study',
  other: 'other',
};

const POLARITY_MAP: Record<string, Polarity> = {
  正: 'positive',
  正向: 'positive',
  积极: 'positive',
  positive: 'positive',
  负: 'negative',
  负向: 'negative',
  消极: 'negative',
  negative: 'negative',
  中性: 'neutral',
  中: 'neutral',
  neutral: 'neutral',
};

interface AiTag {
  tag: string;
  category: TraitCategory;
  polarity: Polarity;
  strength: number;
}

async function extractTags(texts: string[], settings: AiSettings): Promise<Map<string, AiTag[]>> {
  const prompt = [
    '你是班主任排座系统的语义抽取器。只做标签抽取，不排座位。',
    '对每条学生特点文本抽取 1-3 个规范标签，类别只能是 性格/行为/学习/其他，极性只能是 正/负/中性，强度 1-3。',
    '严格输出 JSON 对象，不要解释、不要 Markdown。格式：',
    '{"items":[{"text":"原始文本","tags":[{"tag":"规范标签","category":"性格","polarity":"正","strength":2}]}]}',
    '文本列表：',
    JSON.stringify(texts),
  ].join('\n');

  const call = async () => {
    const res = await request(
      '/chat/completions',
      {
        model: settings.chatModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      },
      settings.apiKey,
    );
    const content: string = res.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content);
    const map = new Map<string, AiTag[]>();
    const items: any[] = Array.isArray(parsed.items) ? parsed.items : [];
    for (const item of items) {
      if (typeof item?.text !== 'string' || !Array.isArray(item.tags)) continue;
      map.set(
        item.text,
        item.tags
          .filter((t: any) => t && typeof t.tag === 'string')
          .slice(0, 3)
          .map((t: any) => ({
            tag: t.tag,
            category: CATEGORY_MAP[t.category] ?? 'other',
            polarity: POLARITY_MAP[t.polarity] ?? 'neutral',
            strength: Math.min(3, Math.max(1, Number(t.strength) || 2)),
          })),
      );
    }
    return map;
  };

  try {
    return await call();
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    return await call();
  }
}

async function embed(texts: string[], settings: AiSettings): Promise<number[][]> {
  const res = await request(
    '/embeddings',
    { model: settings.embeddingModel, input: texts, encoding_format: 'float' },
    settings.apiKey,
  );
  const data: any[] = Array.isArray(res.data) ? res.data : [];
  return data
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => (Array.isArray(item.embedding) ? item.embedding : []));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface Cluster {
  id: string;
  name: string;
  category: TraitCategory;
  polarity: Polarity;
  centroid: number[];
  members: string[];
  vector?: number[];
}

function clusterTags(vectors: Map<string, number[]>, tagMeta: Map<string, AiTag>): {
  assignments: Map<string, string>;
  clusters: TagCluster[];
} {
  const clusters: Cluster[] = [];
  const assignments = new Map<string, string>();
  for (const [tag, vector] of vectors) {
    let best: Cluster | null = null;
    let bestSim = 0.82;
    for (const cluster of clusters) {
      const sim = cosine(vector, cluster.centroid);
      if (sim >= bestSim) {
        best = cluster;
        bestSim = sim;
      }
    }
    const meta = tagMeta.get(tag);
    if (!best) {
      const cluster: Cluster = {
        id: uid('cluster'),
        name: tag,
        category: meta?.category ?? 'other',
        polarity: meta?.polarity ?? 'neutral',
        centroid: vector.slice(),
        members: [tag],
        vector: vector.slice(),
      };
      clusters.push(cluster);
      assignments.set(tag, cluster.id);
    } else {
      best.members.push(tag);
      best.centroid = best.centroid.map((v, i) => (v * (best!.members.length - 1) + vector[i]) / best!.members.length);
      assignments.set(tag, best.id);
    }
  }
  return {
    assignments,
    clusters: clusters.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      polarity: c.polarity,
      count: c.members.length,
    })),
  };
}

export interface AiAnalyzeResult {
  students: Student[];
  clusters: TagCluster[];
  mode: SemanticMode;
}

export async function analyzeWithAi(
  students: Student[],
  settings: AiSettings,
): Promise<AiAnalyzeResult> {
  if (!settings.apiKey) throw new Error('未配置 API Key');

  const raws = [...new Set(students.flatMap((s) => s.traits.map((t) => t.raw)))].filter(Boolean);
  if (!raws.length) throw new Error('没有可分析的特点文本');

  const names = students.map((s) => s.name);
  const payload = raws.map((raw) => (settings.strictMask ? maskNames(raw, names) : raw));
  const tagMap = await extractTags(payload, settings);

  const nextStudents = students.map((student) => {
    const traits: Trait[] = [];
    for (const raw of student.traits.map((t) => t.raw)) {
      const masked = settings.strictMask ? maskNames(raw, names) : raw;
      const tags = tagMap.get(masked);
      if (tags?.length) {
        for (const tag of tags) {
          traits.push({
            id: uid('tr'),
            text: tag.tag,
            raw,
            category: CATEGORY_MAP[tag.category] ?? 'other',
            polarity: POLARITY_MAP[tag.polarity] ?? 'neutral',
            strength: Math.min(3, Math.max(1, tag.strength)) as 1 | 2 | 3,
            source: 'ai',
          });
        }
      } else {
        traits.push(...localTraitsFromRaw(raw));
      }
    }
    if (!traits.length) {
      for (const raw of splitTraitText(student.note ?? '')) {
        traits.push(...localTraitsFromRaw(raw));
      }
    }
    return { ...student, traits };
  });

  const uniqueTags = [...new Set(nextStudents.flatMap((s) => s.traits.map((t) => t.text)))];
  let clusters: TagCluster[] = [];
  const tagMeta = new Map<string, AiTag>();
  for (const tags of tagMap.values()) {
    for (const tag of tags) {
      tagMeta.set(tag.tag, tag);
    }
  }
  try {
    const vectors = await embed(uniqueTags, settings);
    const vectorMap = new Map<string, number[]>();
    uniqueTags.forEach((tag, i) => {
      if (vectors[i]?.length) vectorMap.set(tag, vectors[i]);
    });
    if (vectorMap.size === uniqueTags.length && uniqueTags.length) {
      const result = clusterTags(vectorMap, tagMeta);
      clusters = result.clusters;
      for (const student of nextStudents) {
        for (const trait of student.traits) {
          trait.clusterId = result.assignments.get(trait.text) ?? trait.text;
        }
      }
    }
  } catch {
    // embedding 失败时退化为按标签名聚合，不影响排座
  }

  return { students: nextStudents, clusters, mode: 'ai' };
}
