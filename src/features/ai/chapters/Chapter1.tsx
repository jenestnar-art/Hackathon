/* =============================================================================
   Chapter1.tsx —— 第 1 章：它偏食了（数据不平衡）
   ---------------------------------------------------------------------------
   玩法是一场【对照实验】：
     A 补样本 → 立竿见影
     B 再练练（调参）→ 几乎无用
   谁先谁后，就是"先怀疑数据还是先怀疑模型"这个核心信号的来源。

   ⚠️ 难度设计踩过的两个坑（都记在这里）：
     坑 1：最早"补满 6/8"只给 0.82 准确率，而过关要 8/10 → 补满了也打不过，
           用户怎么点都赢不了。这是设计事故。
     坑 2：胜负经过"中间指标 → 显示值 → 判定"三层转手，出现过失配：
           界面显示 25%，按钮却已经出现，用户完全看不懂发生了什么。

   所以现在规则极其直白：
     **你给 6 和 8 各补了几个，直接决定它答对 6/8 的概率。**
     补满 → 0.90，稳过。没补 → 瞎猜，必输。
     没有中间层，不会失配。
   ========================================================================== */

import { useState } from 'react'
import { ChapterRunner } from '@/features/ai/ChapterRunner'
import { ImbalanceGame } from '@/features/ai/games/ImbalanceGame'
import {
  IMBALANCE_GOAL,
  accuracyFor,
  getFed,
} from '@/features/ai/games/imbalanceRules'
import { CH1 } from '@/features/ai/data/petLines'
import type { ChapterId } from '@/features/ai/store/petStore'
import type { BodyKind } from '@/features/ai/pet/petState'

const GOAL = IMBALANCE_GOAL

/** 开局：好数字各 6 个，6 和 8 各 1 个 */
const START_SEEN = [0, 1, 2, 3, 4, 5, 7, 9]

interface Props {
  onExit?: () => void
  onChapterChange?: (id: ChapterId) => void
  /** 上一章结束时的形态：开场演一次形态交接 */
  fromBody?: BodyKind
  /** 外层的全屏推进演完了没有 */
  handoffReady?: boolean
}

export function Chapter1({ onExit, fromBody, handoffReady }: Props) {
  const [paramCount, setParamCount] = useState(0)
  const [rounds, setRounds] = useState(8)

  return (
    <ChapterRunner
      chapterId="ch1"
      goal={GOAL}
      forgetOnLose={0}
      styleBias="normal"
      petBody="fat"
      introLines={[
        { mood: 'smug', text: CH1.enter.text },
        { mood: 'smug', text: '你先训一下看看，我吃得很饱。' },
        { mood: 'confused', text: '……不过 6 和 8 这两个，我好像没什么印象。' },
      ]}
      initial={{ fed: 0, seen: START_SEEN, feedOrder: [] }}
      /**
       * ★ 胜负只由"你给这个数字补了几次"决定：
       *     0~1 次 → 瞎猜（0.06~0.11），必输
       *     2~4 次 → 半懂（0.40~0.62），看运气
       *     5 次   → 学透了（0.90），稳过
       */
      /* ★ BOSS 战从【共享记录】读喂食顺序，而不是 React state。
         原因：刚补完就打 BOSS 时，state 还差一帧没更新，会导致明明补够了却打不过。
         共享记录是喂食当场写入的，所以开打时一定是最新的。 */
      bossAccuracy={(truth) => accuracyFor(truth, getFed('ch1'))}
      renderGame={(ctx) => (
        <ImbalanceGame
          fixed={ctx.fed}
          goal={ctx.goal}
          fedOrder={ctx.feedOrder}
          onFeed={ctx.feed}
          onParamAdjust={() => {
            setParamCount((c) => c + 1)
            setRounds((r) => r + 4)
          }}
          paramCount={paramCount}
          rounds={rounds}
          petBody="fat"
          petMood={ctx.fed === 0 ? 'smug' : 'confused'}
        />
      )}
      fromBody={fromBody}
      handoffReady={handoffReady}
      onExit={onExit}
    />
  )
}
