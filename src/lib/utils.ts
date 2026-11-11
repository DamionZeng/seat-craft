export { cn } from 'cn';

/** 生成带前缀的唯一 id，例如 uid('stu') → stu_1f3k9a */
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 0–1 的比率格式化为百分比文本 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** 无序学生对的稳定键，保证 a/b 顺序无关 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 可复现的伪随机数生成器 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
