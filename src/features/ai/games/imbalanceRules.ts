/* =============================================================================
   imbalanceRules.ts —— 第 1 章的判定规则（唯一来源）
   ---------------------------------------------------------------------------
   ★ 为什么必须只有一个文件：

   之前成绩单和 BOSS 战各写了一套公式，于是出现过这些鬼事：
     · 界面显示"只考 6/8：25%"，但"带它去打"按钮已经亮了
     · 补满了 6 和 8，成绩单还是 0%，BOSS 还打不过
   用户完全看不懂发生了什么。

   后来又把"喂食顺序"存了两份（玩法组件一份、章节容器一份），
   于是出现竞态：刚补完就打 BOSS，BOSS 拿到的是旧记录，还是输。

   现在的规矩：**规则和喂食记录都只有一份**，谁用都从这里读。

   判定规则：
     缺样本的数字（6、8）：
       补够 PER_DIGIT 次 → 正确率 100%（成绩单必对、BOSS 必接住）
       没补够           → 瞎猜（5% 起），成绩单必错、BOSS 必丢
     其它数字：
       样本一直充足 → 永远 100% 正确

   推论（用户定的三条硬规则）：
     1. 成绩单里只有 6 和 8 会错，其它必须全对
     2. 6 和 8 补够之后再训练，成绩单必须全对
     3. 成绩单全对时打 BOSS，必须赢
   ========================================================================== */

export const SCARCE = [6, 8]
/** 每个稀缺数字要补几次才算"补够" */
export const PER_DIGIT = 5
/** 这一章要补够的总数 */
export const IMBALANCE_GOAL = PER_DIGIT * SCARCE.length
/** 成绩单上"只考 6/8"要多少才算治好 */
export const GOAL_BAD_ACC = 0.9

/** 某个数字被补了几次 */
export function fedTimesOf(fedOrder: number[], digit: number): number {
  return fedOrder.filter((d) => d === digit).length
}

/**
 * ★ 唯一的正确率函数。成绩单和 BOSS 战都调它。
 */
export function accuracyFor(truth: number, fedOrder: number[]): number {
  if (!SCARCE.includes(truth)) return 1

  const times = fedTimesOf(fedOrder, truth)
  if (times >= PER_DIGIT) return 1
  if (times >= 2) return 0.35 + (times - 2) * 0.08
  return 0.05 + times * 0.05
}

/** 它是否已经把 6 和 8 都补够了 */
export function isFixed(fedOrder: number[]): boolean {
  return SCARCE.every((d) => fedTimesOf(fedOrder, d) >= PER_DIGIT)
}

/** 每个稀缺数字还要补几次 */
export function remaining(fedOrder: number[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const d of SCARCE) out[d] = Math.max(0, PER_DIGIT - fedTimesOf(fedOrder, d))
  return out
}

/** 每个稀缺数字当前的样本总数（含开局那 1 个），用来画进度条 */
export function sampleCounts(fedOrder: number[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const d of SCARCE) out[d] = 1 + fedTimesOf(fedOrder, d)
  return out
}

/* ---------------------------------------------------------------------------
   ★ 进程级共享的"喂食记录"
   为什么需要它：
     "喂它一个"之后，父组件的 React state 要等下一帧才更新。
     如果用户补完立刻点"带它去打"，BOSS 会拿到旧的记录 → 明明补够了却打不过。
     所以把记录放在模块级，喂食当场写入，BOSS 开打时读到的必然是最新的。
     同时仍然同步给 React state，保证界面渲染正常。
   ------------------------------------------------------------------------ */

const bag = new Map<string, number[]>()

export function pushFed(chapterId: string, digit: number): void {
  const cur = bag.get(chapterId) ?? []
  bag.set(chapterId, [...cur, digit])
}

export function getFed(chapterId: string): number[] {
  return bag.get(chapterId) ?? []
}

export function setFed(chapterId: string, order: number[]): void {
  bag.set(chapterId, order)
}

export function clearFed(chapterId: string): void {
  bag.set(chapterId, [])
}
