/* =============================================================================
   poisonRules.ts —— 第 3 章的判定规则（唯一来源）
   ---------------------------------------------------------------------------
   这一章教的是【数据质量】：它认错，不全是它的错。

   关键设定（必须先想清楚，否则玩法讲不通）：
     投毒样本长什么样？——【图和标签对不上】。
     比如一张明明画着"1"的图，标签却写着"7"。
     人眼一看就知道不对；但模型不会怀疑标签，它只会拼命去拟合，
     于是学会了"长这样的就是 7"——这就是它认错的原因。

   所以玩家的动作就是：把标签和图形对不上的那几张找出来、清掉。

   判定规则：
     · 还没清毒：3 和 8 混淆（它被"3 图 8 标签"教坏了），准确率很低
     · 清掉至少 NEED_CATCH 张：3 和 8 恢复正常

   推论（这一章的硬规则）：
     1. 一开始成绩单上 3 和 8 必错
     2. 抓够内鬼 → 成绩单全对
     3. 成绩单全对时打 BOSS，必赢
   ========================================================================== */

/** 这一章总共摆多少张样本 */
export const GRID_SIZE = 12
/** 最少要抓出几张内鬼才算清干净 */
export const NEED_CATCH = 4
/** 这一章的目标（喂/处理的样本数） */
export const POISON_GOAL = NEED_CATCH

export interface PoisonSample {
  id: string
  /** 图里真正画的是什么 */
  actual: number
  /** 标签写的是什么 */
  label: number
  /** 是不是投毒样本（图与标签对不上） */
  poison: boolean
  /** 给玩家看的一句备注 */
  note?: string
}

/**
 * 这一章的样本盘。
 * 5 张投毒（图与标签明显不符）+ 7 张干净（含几张"标签对但模型仍然犹豫"的干扰项）。
 * 固定枚举而不是随机生成 —— 演示需要每次都能稳定复现。
 */
export const SAMPLES: PoisonSample[] = [
  // ── 投毒：图画的是 1，标签写成 7（人眼一眼可辨）
  { id: 'p1', actual: 1, label: 7, poison: true, note: '图上是 1，标签却写着 7' },
  // ── 投毒：图画的是 3，标签写成 8（这就是它"3/8 不分"的根源）
  { id: 'p2', actual: 3, label: 8, poison: true, note: '图上是 3，标签却写着 8' },
  // ── 投毒：图画的是 5，标签写成 3
  { id: 'p3', actual: 5, label: 3, poison: true, note: '图上是 5，标签却写着 3' },
  // ── 投毒：图画的是 0，标签写成 6
  { id: 'p4', actual: 0, label: 6, poison: true, note: '图上是 0，标签却写着 6' },
  // ── 投毒：图画的是 8，标签写成 3
  { id: 'p5', actual: 8, label: 3, poison: true, note: '图上是 8，标签却写着 3' },

  // ── 干净样本（图与标签一致）
  { id: 'c1', actual: 2, label: 2, poison: false },
  { id: 'c2', actual: 4, label: 4, poison: false },
  { id: 'c3', actual: 6, label: 6, poison: false },
  { id: 'c4', actual: 9, label: 9, poison: false },
  { id: 'c5', actual: 1, label: 1, poison: false },
  { id: 'c6', actual: 7, label: 7, poison: false },
  { id: 'c7', actual: 5, label: 5, poison: false },
]

/** 投毒样本总数 */
export const POISON_TOTAL = SAMPLES.filter((s) => s.poison).length

/**
 * 让模型"猜"某张样本。
 * ★ 这里不装随机 —— 模型的错误是有规律的，正因为它被标签教坏了：
 *     · 还没清毒：凡是标签是 3 或 8 的，它都会往另一个上猜
 *     · 这张图实际是 3 但标签是 8 → 它答 8（完全信标签）
 * 玩家看到的就是"它把 3 认成 8"，而线索就在标签上。
 */
export function modelGuess(s: PoisonSample, caught: number): number {
  // 清够了 → 它重学过了，答图里真实的那个
  if (caught >= NEED_CATCH) return s.actual

  // 还有毒 → 它按错误的标签去认
  if (s.poison) {
    // 被"图 X 标 Y"教坏了：看到 X 的形状会答 Y
    return s.label
  }
  // 干净样本它基本答对，但 3/8 会互相牵连（因为那一类被污染了）
  if (s.actual === 3 || s.actual === 8) return s.actual === 3 ? 8 : 3
  return s.actual
}

/** 这张样本模型答对了吗 */
export function isRight(s: PoisonSample, caught: number): boolean {
  return modelGuess(s, caught) === s.actual
}

/**
 * ★ 唯一的正确率函数。成绩单和 BOSS 战都调它。
 * @param truth   真正是几
 * @param caught  玩家已经抓出几张内鬼
 */
export function accuracyFor(truth: number, caught: number): number {
  /* 还没清干净：3 和 8 这一对是崩的（被投毒样本反复教错） */
  if (caught < NEED_CATCH) {
    if (truth === 3 || truth === 8) return 0.06
    // 其它数字也被拉低了一点，但不致命
    return 0.88
  }
  // 清干净了：恢复正常
  if (truth === 3 || truth === 8) return 0.97
  return 0.96
}

/** 成绩单考哪几道：3 和 8 各占两道，专门盯着被污染的那一类 */
export const PROBE: { truth: number }[] = [
  { truth: 2 },
  { truth: 5 },
  { truth: 3 },
  { truth: 8 },
  { truth: 3 },
  { truth: 8 },
  { truth: 9 },
  { truth: 4 },
]

/* ---------------------------------------------------------------------------
   ★ 进程级的共享记录：玩家抓了几张内鬼
   和第 1、2 章同样的理由 —— BOSS 开打时父组件 state 可能差一帧，
   从共享记录读才稳。而且这次更关键：BOSS 的准确率完全取决于这个数。
   ------------------------------------------------------------------------ */

const bag = new Map<string, Set<string>>()

export function markCaught(chapterId: string, id: string): void {
  const cur = bag.get(chapterId) ?? new Set<string>()
  cur.add(id)
  bag.set(chapterId, cur)
}

export function caughtCount(chapterId: string): number {
  return bag.get(chapterId)?.size ?? 0
}

export function isCaught(chapterId: string, id: string): boolean {
  return bag.get(chapterId)?.has(id) ?? false
}

export function clearPoison(chapterId: string): void {
  bag.set(chapterId, new Set())
}
