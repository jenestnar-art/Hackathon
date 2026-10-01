/* =============================================================================
   modelBrain.ts —— 模型大脑表
   ---------------------------------------------------------------------------
   ★ 这是"纯前端也能做出 AI 感"的关键。

   为什么不做实时训练：
     1. 每一幕都要"立刻翻车"，真训练 1~2 秒会打断游戏节奏
     2. 真模型有不稳定性 —— 万一这次它偏偏答对了，剧本就崩了
     3. 不加载 TensorFlow 能给首屏省下 1MB

   诚实口径（答辩被问到就照这个答）：
     "我们的 AI 行为来自一张预先训练好的模型能力表。真正的训练流程我们也跑通了
      （TensorFlow.js 在浏览器里训一个小型 CNN），但为了保证演示的节奏与可靠性，
      产品里用的是离线结果。"
   ========================================================================== */

/** 大脑状态 —— 每一幕对应一个 */
export type BrainState =
  | 'untrained' // 什么都没学，全靠猜
  | 'fledgling' // 第 0 章结尾：刚开始有感觉
  | 'biased' // 第 1 章：6 和 8 没吃过，塌了
  | 'balanced' // 第 1 章结尾：补好了
  | 'overfit' // 第 2 章：只认工整的字
  | 'generalized' // 第 2 章结尾：各种写法都认
  | 'poisoned' // 第 3 章：被错标数据教坏
  | 'clean' // 第 3 章结尾：清洗后
  | 'healthy' // 第 4 章：出厂状态

/**
 * 每个状态下，模型对 0~9 各自"答对"的概率（0~1）。
 * 数组下标就是数字本身。
 */
export const BRAIN: Record<BrainState, number[]> = {
  //          0     1     2     3     4     5     6     7     8     9
  untrained: [0.10, 0.09, 0.11, 0.09, 0.10, 0.12, 0.08, 0.10, 0.09, 0.07],
  fledgling: [0.84, 0.86, 0.78, 0.74, 0.80, 0.76, 0.68, 0.85, 0.66, 0.79],

  // 6 和 8 只"吃"过个位数样本 → 几乎完全放弃它们
  biased: [0.95, 0.96, 0.94, 0.93, 0.95, 0.92, 0.08, 0.95, 0.05, 0.94],
  balanced: [0.95, 0.96, 0.94, 0.93, 0.95, 0.92, 0.93, 0.95, 0.91, 0.94],

  // 训练集好看，但换个写法就废
  overfit: [0.98, 0.99, 0.97, 0.96, 0.98, 0.97, 0.97, 0.99, 0.98, 0.96],
  generalized: [0.93, 0.95, 0.90, 0.89, 0.92, 0.89, 0.90, 0.94, 0.88, 0.91],

  // 被错标数据教坏：3 会被认成 8，而且它很自信
  poisoned: [0.92, 0.94, 0.90, 0.22, 0.91, 0.88, 0.89, 0.93, 0.90, 0.89],
  clean: [0.93, 0.95, 0.91, 0.90, 0.92, 0.90, 0.90, 0.94, 0.90, 0.91],

  healthy: [0.96, 0.97, 0.95, 0.95, 0.96, 0.94, 0.95, 0.97, 0.94, 0.95],
}

/** 每个状态的"最能说明问题"的一句话，给界面上的状态条用 */
export const BRAIN_LABEL: Record<BrainState, string> = {
  untrained: '全靠猜',
  fledgling: '刚认得出个大概',
  biased: '偏食：6 和 8 不认得',
  balanced: '营养均衡了',
  overfit: '只认工整的字',
  generalized: '各种写法都认',
  poisoned: '被人教坏了',
  clean: '脑子清爽了',
  healthy: '出厂状态',
}

/* ---------------------------------------------------------------------------
   预置的"错标"样本（第 3 章用）
   故意把 3 标成 8 —— 这就是模型学会"3 是 8"的原因
   ------------------------------------------------------------------------ */

export interface DirtySample {
  id: number
  /** 图里真正画的是什么 */
  truth: number
  /** 数据里贴的标签 */
  label: number
}

/** 生成一份带错标的数据集 */
export function buildDirtySet(total = 40, dirty = 4): DirtySample[] {
  const samples: DirtySample[] = []
  // 40 张图里，真值按 0~9 循环铺开
  for (let i = 0; i < total; i++) {
    samples.push({ id: i, truth: i % 10, label: i % 10 })
  }
  // 把其中 4 个"3"的标签改成 8
  const threes = samples.filter((s) => s.truth === 3).map((s) => s.id)
  threes.slice(0, dirty).forEach((id) => {
    const target = samples.find((s) => s.id === id)
    if (target) target.label = 8
  })
  return samples
}

/* ---------------------------------------------------------------------------
   分类：给一张图，返回模型认为它是什么
   ------------------------------------------------------------------------ */

export interface Guess {
  /** 模型给出的答案 */
  digit: number
  /** 置信度 0~1 */
  confidence: number
  /** 完整概率分布（画条形图用） */
  probs: number[]
  /** 答对了吗（需要真值才能判断，这里先留空由调用方填） */
  correct?: boolean
}

/**
 * @param state    模型当前状态
 * @param truth    这张图真正是什么
 * @param rng      可注入的随机源，方便测试时固定结果
 * @param accOverride 直接指定"答对概率"（第 0 章要按喂食量动态算）
 */
export function classify(
  state: BrainState,
  truth: number,
  rng = Math.random,
  accOverride?: number
): Guess {
  const acc = accOverride ?? BRAIN[state][truth] ?? 0.5
  /* ★ 剧本事件：第 3 章的"3 被认成 8"必须每次都发生 —— 那一幕是整个第 3 章的触发器。
     但只在【没有外部指定准确率】时才强制。
     踩过的坑：这里以前是无条件的，于是玩家把内鬼清干净、外面传进来 0.97 的正确率，
     它还是把每个 3 都判错 —— BOSS 永远打不过，而且看日志完全对不上账。
     谁调用时明确给了准确率，就说明调用方知道该演什么，剧本要让位。 */
  const scripted = state === 'poisoned' && truth === 3 && accOverride == null
  const hit = !scripted && rng() < acc

  if (hit) {
    // 答对：置信度 0.62~0.97
    const confidence = 0.62 + rng() * 0.35
    return { digit: truth, confidence, probs: spreadProbs(truth, confidence) }
  }

  // 答错：挑一个"最像"的错答案
  const wrong = pickWrong(state, truth, rng())
  // 错的时候置信度有两种：一种是"我不太确定"（0.3~0.5），一种是"我特别确定"（0.7~0.95）
  // 后者才是最好笑的，也是第 3 章的关键
  const overconfident = scripted || rng() < overconfidenceChance(state, truth)
  const confidence = overconfident ? (scripted ? 0.91 : 0.7 + rng() * 0.25) : 0.3 + rng() * 0.2
  return { digit: wrong, confidence, probs: spreadProbs(wrong, confidence) }
}

/** 某些状态下，模型错得特别自信 */
function overconfidenceChance(state: BrainState, truth: number): number {
  if (state === 'poisoned' && truth === 3) return 0.92 // 第 3 章那一幕
  if (state === 'overfit') return 0.6 // 它"见过很多"，所以自信
  if (state === 'untrained') return 0.25 // 瞎猜也能很理直气壮
  return 0.35
}

/** 挑一个错答案。有"偏好"的错法比随机错法更像真的。 */
function pickWrong(state: BrainState, truth: number, rand: number): number {
  // 第 3 章：3 一律错成 8
  if (state === 'poisoned' && truth === 3) return 8
  // 第 1 章：6 和 8 互相混，或者被认成 5、9
  if (state === 'biased') {
    if (truth === 6) return rand < 0.6 ? 8 : rand < 0.5 ? 5 : 0
    if (truth === 8) return rand < 0.6 ? 6 : rand < 0.5 ? 3 : 9
  }
  // 其它情况：从"长得像"的候选里挑
  const alike: Record<number, number[]> = {
    0: [6, 8, 9],
    1: [7, 4],
    2: [7, 3],
    3: [8, 5, 9],
    4: [9, 1],
    5: [6, 3, 8],
    6: [8, 5, 0],
    7: [1, 9, 2],
    8: [6, 3, 9],
    9: [4, 7, 8],
  }
  const pool = (alike[truth] ?? [0, 1, 2, 3]).filter((d) => d !== truth)
  return pool[Math.floor(rand * pool.length)]
}

/** 把置信度摊成一条分布曲线（给条形图用） */
function spreadProbs(top: number, confidence: number): number[] {
  const rest = (1 - confidence) / 9
  return Array.from({ length: 10 }, (_, d) => (d === top ? confidence : rest))
}

/* ---------------------------------------------------------------------------
   通用小工具
   ------------------------------------------------------------------------ */

/** 洗牌 */
export function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 取"每个数字各 n 个"的测试样本序列 —— BOSS 战用。
 * 每种写法都来一点，模拟真实世界的杂乱。
 */
export function buildBossSamples(digits: number[], perDigit = 1): number[] {
  const out: number[] = []
  for (const d of digits) {
    for (let i = 0; i < perDigit; i++) out.push(d)
  }
  return shuffle(out)
}
