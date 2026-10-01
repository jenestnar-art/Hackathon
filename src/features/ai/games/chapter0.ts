/* =============================================================================
   chapter0.ts —— 第 0 章的识别规则
   ---------------------------------------------------------------------------
   为什么要单独抽出来：
     之前"喂的时候几乎全对、打分时反而出错"，根因是两处用了同一套概率但场景不同。
     现在改成一条规则，并且引入"它到底见过哪些数字"这个概念 —— 这才是模型的样子。

   三条规则：
     1. 它只对自己"吃过"的数字有把握 —— 没喂过的，它会认错
     2. 吃得越多越准，但有上限（0.88）—— 永远不会完美，这是 AI 的真实
     3. 喂食时的"当场自检"给一点奖励（刚看过，印象新鲜），BOSS 时不给
   ========================================================================== */

import type { BodyKind } from '@/features/ai/pet/petState'

/* ---------------------------------------------------------------------------
   一、能力曲线
   ------------------------------------------------------------------------ */

/** 喂了 n 个样本之后的准确率上限 */
export function accuracyByFed(fed: number): number {
  if (fed <= 0) return 0.12
  return Math.min(0.80, 0.42 + fed * 0.032)
}

/** 没喂过的数字要打折扣：它压根没见过，只能靠"长得像"去蒙 */
export const UNSEEN_PENALTY = 0.65

/**
 * 算某次识别的"答对概率"。
 * @param truth    真正是几
 * @param fed      已喂样本数
 * @param seen     它吃过的数字集合
 * @param bonus    当场自检给的小奖励
 */
export function answerAccuracy(
  truth: number,
  fed: number,
  seen: Set<number>,
  bonus = 0
): number {
  const base = accuracyByFed(fed)
  const known = seen.size === 0 || seen.has(truth)
  const v = known ? base : base * UNSEEN_PENALTY
  return Math.min(0.96, v + bonus)
}

/* ---------------------------------------------------------------------------
   二、成长阶段：让它"分阶段长大"，而不是一喂就变白
   ------------------------------------------------------------------------ */

export interface Stage {
  at: number
  body: BodyKind
  mood?: 'confused' | 'idle' | 'happy' | 'proud'
  label: string
  /** 跨到这个阶段时它说的话 */
  line: string
}

export const STAGES: Stage[] = [
  {
    at: 0,
    body: 'blob',
    mood: 'confused',
    label: '一坨糊的',
    line: '……我好像还没有形状。',
  },
  {
    at: 1,
    body: 'round',
    mood: 'idle',
    label: '长出轮廓了',
    line: '咦，我长出手脚了？',
  },
  {
    at: 7,
    body: 'healthy',
    mood: 'proud',
    label: '结实起来了',
    line: '我感觉自己变结实了！',
  },
]

export function stageOf(fed: number): number {
  let idx = 0
  for (let i = 0; i < STAGES.length; i++) {
    if (fed >= STAGES[i].at) idx = i
  }
  return idx
}

export function stageAt(idx: number): Stage {
  return STAGES[Math.max(0, Math.min(idx, STAGES.length - 1))]
}

/* ---------------------------------------------------------------------------
   三、喂食上限
   之前进度环会出现 "23 / 12" —— 喂过量没有意义，还会让后面几章的节奏失真。
   ------------------------------------------------------------------------ */

export function clampFed(fed: number, goal: number): number {
  return Math.max(0, Math.min(fed, goal))
}

export function isFull(fed: number, goal: number): boolean {
  return fed >= goal
}

/**
 * 按"喂食进度比例"算阶段。
 * 为什么需要它：章节的目标数不一样（第 0 章 12 个、第 1 章 8 个），
 * 如果用绝对数字当分界，喂满的那一刻可能刚好掉回上一阶段（踩过这个坑）。
 * 按比例算就不会。
 */
export function stageByProgress(fed: number, goal: number): number {
  if (goal <= 0) return 0
  const r = fed / goal
  if (r >= 0.7) return 2
  if (r >= 0.25) return 1
  return 0
}