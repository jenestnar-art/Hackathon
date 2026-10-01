/* =============================================================================
   finalRules.ts —— 第 4 章「出道」的判定规则（唯一来源）
   ---------------------------------------------------------------------------
   这一章是收尾，要把前几章学的东西串起来：
     第 0 章 样本够不够
     第 1 章 数据平不平衡
     第 2 章 写法多不多样
     第 3 章 标得对不对
     → 第 4 章 这些一起决定它能不能应付【真实现场】

   玩法：一张数据清单，你自己决定喂它哪些。
     · 清单里有干净的，也有【标错的】（红标签，和第 3 章那种一样）
     · "全都喂给它"最快 —— 但把错的一起喂进去，泛化反而上不去
     · 一个个挑干净的，慢，但稳

   ★ 所以这一章有一个故意的陷阱：
     偷懒的人会得到"训练集分数很高、真实现场很惨"的结果 —— 正是过拟合的复现。
     认真挑的人才会拿到高分。两条路都走得到终点，但结局不一样。

   判定规则：
     泛化能力 = 按【干净样本占比】和【喂进去的样本数】一起算
       · 还没喂够 → 不够自信
       · 喂够了但里面对了很多标错的 → 被带偏
       · 喂够了且基本都是干净的 → 真实现场也能认

   推论：
     1. 一开始"真实现场"的准确率很低（它只会做原题）
     2. 挑干净样本喂够 → 泛化能力上到 0.9 以上
     3. 泛化够了打 BOSS，必赢
   ========================================================================== */

/** 这一章数据清单上有多少张候选样本 */
export const POOL_SIZE = 20
/** 每个数字给几种写法 */
export const STYLES_PER_DIGIT = 2
/** 要喂够多少张才算"见过世面" */
export const FINAL_GOAL = 16
/** 干净样本占比要到多少**
 *  16 张里最多允许 2 张标错的 → 14/16 = 0.875 */
export const MIN_CLEAN_RATIO = 0.85
/** 成绩单上"真实现场"要到多少才算过关 */
export const GOAL_REAL_ACC = 0.9

export interface PoolCard {
  id: string
  digit: number
  /** 'neat' 工整 / 'messy' 手写-歪的 / 'rot' 手写-转过的 */
  look: 'neat' | 'messy' | 'rot'
  /** 标错了的卡（图与标签不符） */
  mislabeled: boolean
}

/**
 * 数据清单。
 * 固定枚举 —— 演示要每次都能稳定复现，不能随机。
 * 20 张：14 张干净 + 6 张标错。
 * 标错的分散在各个数字上，不是全堆在一起，这样"全都喂"的代价才明显。
 */
function card(digit: number, look: PoolCard['look'], mislabeled = false): PoolCard {
  return { id: `${digit}-${look}${mislabeled ? '-bad' : ''}`, digit, look, mislabeled }
}

export const POOL: PoolCard[] = [
  card(0, 'neat'),
  card(0, 'messy'),
  card(1, 'neat'),
  card(1, 'messy'),
  card(2, 'neat'),
  card(2, 'rot'),
  card(3, 'neat'),
  card(3, 'messy'),
  card(4, 'neat'),
  card(4, 'messy', true),
  card(5, 'neat'),
  card(5, 'rot'),
  card(6, 'neat'),
  card(6, 'messy', true),
  card(7, 'neat'),
  card(7, 'messy'),
  card(8, 'neat'),
  card(8, 'rot', true),
  card(9, 'neat'),
  card(9, 'messy', true),
]

/** 标错的卡有多少张 */
export const MISLABELED_TOTAL = POOL.filter((c) => c.mislabeled).length

/**
 * ★ 泛化能力。这是这一章唯一的指标。
 * @param picked 玩家选中的卡
 */
export function generalization(picked: PoolCard[]): number {
  const n = picked.length
  if (n === 0) return 0.08

  const clean = picked.filter((c) => !c.mislabeled).length
  const ratio = clean / n

  // 「见过多少」：喂得越多越自信，但边际递减，最多到 0.92
  const exposure = Math.min(0.92, 0.22 + (n / FINAL_GOAL) * 0.7)
  // 「干净多少」：混进标错的会被带偏，这是第 3 章的教训
  //   全部干净 → ×1.0；一半标错 → ×0.5 左右
  const penalty = 0.28 + ratio * 0.72

  return Math.max(0.05, Math.min(0.97, exposure * penalty))
}

/** 已经喂够了吗 */
export function isEnough(picked: PoolCard[]): boolean {
  return picked.length >= FINAL_GOAL
}

/** 干净到可以出道了吗 */
export function isCleanEnough(picked: PoolCard[]): boolean {
  if (picked.length === 0) return false
  const clean = picked.filter((c) => !c.mislabeled).length
  return clean / picked.length >= MIN_CLEAN_RATIO
}

/** 可以打 BOSS 了吗 */
export function readyForBoss(picked: PoolCard[]): boolean {
  return isEnough(picked) && isCleanEnough(picked) && generalization(picked) >= GOAL_REAL_ACC
}

/**
 * ★ BOSS 用的正确率函数。成绩单和 BOSS 战都调它。
 * 它出的全是【没见过的手写体】，所以完全取决于泛化能力。
 */
export function accuracyFor(_truth: number, picked: PoolCard[]): number {
  return generalization(picked)
}

/** 真实现场考的 10 道题：全是不认识的写法 */
export const REAL_PROBE: { truth: number; look: 'messy' | 'rot' }[] = [
  { truth: 0, look: 'rot' },
  { truth: 1, look: 'messy' },
  { truth: 2, look: 'messy' },
  { truth: 3, look: 'rot' },
  { truth: 4, look: 'messy' },
  { truth: 5, look: 'rot' },
  { truth: 6, look: 'messy' },
  { truth: 7, look: 'rot' },
  { truth: 8, look: 'messy' },
  { truth: 9, look: 'rot' },
]

/* ---------------------------------------------------------------------------
   ★ 进程级共享记录：玩家选了哪些卡
   和前三章同样的理由 —— BOSS 开打时父组件 state 可能差一帧。
   ------------------------------------------------------------------------ */

const bag = new Map<string, PoolCard[]>()

export function setPicked(chapterId: string, cards: PoolCard[]): void {
  bag.set(chapterId, cards)
}

export function getPicked(chapterId: string): PoolCard[] {
  return bag.get(chapterId) ?? []
}

export function clearPicked(chapterId: string): void {
  bag.set(chapterId, [])
}
