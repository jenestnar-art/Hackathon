/* =============================================================================
   overfitRules.ts —— 第 2 章的判定规则（唯一来源）
   ---------------------------------------------------------------------------
   这一章教的是【过拟合】：

     它在自己那套原题上几乎满分（98%），但换个写法就不认了。
     原因不是它笨，是它只见过那一种写法 —— 它把"这一种笔迹"当成了数字本身。

   判定规则：
     原题（工整的）：一直都对（它就是靠背下来的）
     变形（歪的、斜的、粗的）：每喂进一个变形样本，正确率涨一档
                              喂够 NEED_PER_DIGIT 个 → 1.0

   推论（这一章的硬规则，和第 1 章一个套路）：
     1. 一开始成绩单上"变形"那 4 道必错、"原题"那 4 道必对
     2. 每个数字喂够 2 个变形样本 → 成绩单全对
     3. 成绩单全对时打 BOSS，必赢
   ========================================================================== */

/** 这一章重点的三个数字：7 的写法最多变，4 和 9 也容易写歪 */
export const WATCH = [7, 4, 9]
/** 每个重点数字要喂几个变形样本才算见过 */
export const NEED_PER_DIGIT = 2
/** 这一章要喂够的总数 */
export const OVERFIT_GOAL = NEED_PER_DIGIT * WATCH.length
/** 成绩单上"变形"部分要多少才算治好 */
export const GOAL_MESSY_ACC = 0.9

/** 变形样本的三种花样 */
export type VariantKind = 'tilt' | 'stretch' | 'thin'

export interface Variant {
  id: string
  digit: number
  kind: VariantKind
  /** 0~1，喂进之后"抗歪"能力的提升档位 */
  power: number
}

const KIND_LABEL: Record<VariantKind, string> = {
  tilt: '歪着写',
  stretch: '拉长写',
  thin: '潦草写',
}

export function kindLabel(k: VariantKind): string {
  return KIND_LABEL[k]
}

/**
 * 生成某个数字的变形样本。
 * 用固定算式而不是随机 —— 同一个数字每次给的花样一样，
 * 玩家才能形成"我喂的是这个数字的这一种写法"的记忆。
 */
export function variantsFor(digit: number): Variant[] {
  return [
    { id: `${digit}-tilt`, digit, kind: 'tilt', power: 0.5 },
    { id: `${digit}-stretch`, digit, kind: 'stretch', power: 0.5 },
    { id: `${digit}-thin`, digit, kind: 'thin', power: 0.5 },
  ]
}

/** 某个数字已经被喂进了几个变形样本（同一个样本喂两次只算一次） */
export function seenVariants(fed: Variant[], digit: number): number {
  const set = new Set(fed.filter((v) => v.digit === digit).map((v) => v.id))
  return set.size
}

/** 它是否已经见识过各种写法 */
export function isFixed(fed: Variant[]): boolean {
  return WATCH.every((d) => seenVariants(fed, d) >= NEED_PER_DIGIT)
}

/**
 * ★ 唯一的正确率函数。成绩单和 BOSS 战都调它。
 * @param truth  真正是几
 * @param messy  这张是不是"变形/手写"样本
 * @param fed    已经喂进的变形样本
 */
export function accuracyFor(truth: number, messy: boolean, fed: Variant[]): number {
  // 原题：它靠背的，一直都对
  if (!messy) return 1
  // 不在重点数字里的，本来也认得出
  if (!WATCH.includes(truth)) return 0.94

  const n = seenVariants(fed, truth)
  if (n >= NEED_PER_DIGIT) return 1
  // 见过一个有点印象，见过零个基本靠蒙
  return n === 1 ? 0.3 : 0.06
}

/** 成绩单用哪些题：4 张原题 + 4 张变形 */
export const PROBE: { truth: number; messy: boolean }[] = [
  { truth: 2, messy: false },
  { truth: 5, messy: false },
  { truth: 9, messy: false },
  { truth: 3, messy: false },
  { truth: 7, messy: true },
  { truth: 4, messy: true },
  { truth: 9, messy: true },
  { truth: 7, messy: true },
]

/* ---------------------------------------------------------------------------
   ★ 进程级共享的"喂进了哪些变形样本"
   和第 1 章同样的理由：BOSS 开打时父组件的 state 可能还差一帧，
   从共享记录读才是稳的。
   ------------------------------------------------------------------------ */

const bag = new Map<string, Variant[]>()

export function pushVariant(chapterId: string, v: Variant): void {
  const cur = bag.get(chapterId) ?? []
  if (!cur.some((x) => x.id === v.id)) bag.set(chapterId, [...cur, v])
}

export function getVariants(chapterId: string): Variant[] {
  return bag.get(chapterId) ?? []
}

export function clearVariants(chapterId: string): void {
  bag.set(chapterId, [])
}
