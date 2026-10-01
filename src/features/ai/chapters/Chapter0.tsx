/* =============================================================================
   Chapter0.tsx —— 第 0 章：开局一只啥也不会的
   状态只有"喂了多少 / 见过哪些"，元流程全在 ChapterRunner 里。
   ========================================================================== */

import { ChapterRunner } from '@/features/ai/ChapterRunner'
import { FeedGame } from '@/features/ai/games/FeedGame'
import { UNSEEN_PENALTY, accuracyByFed } from '@/features/ai/games/chapter0'
import { INTRO_LINES } from '@/features/ai/data/petLines'
import { classify } from '@/features/ai/lib/modelBrain'
import { track } from '@/features/ai/lib/track'
import type { ChapterId } from '@/features/ai/store/petStore'
import type { BodyKind } from '@/features/ai/pet/petState'

const GOAL = 12

interface Props {
  onExit?: () => void
  onChapterChange?: (id: ChapterId) => void
  /** 上一章结束时的形态：开场演一次形态交接 */
  fromBody?: BodyKind
  /** 外层的全屏推进演完了没有 */
  handoffReady?: boolean
}

export function Chapter0({ onExit, fromBody, handoffReady }: Props) {
  return (
    <ChapterRunner
      chapterId="ch0"
      goal={GOAL}
      forgetOnLose={3}
      styleBias="neat"
      introLines={INTRO_LINES.map((l) => ({ mood: l.mood, text: l.text }))}
      /* BOSS 用和喂食时同一套规则：只对"吃过"的数字有把握 */
      bossAccuracy={(truth, state) => {
        const base = accuracyByFed(state.fed)
        return state.seen.includes(truth) ? base : base * UNSEEN_PENALTY
      }}
      renderGame={(ctx) => (
        <FeedGame
          fed={ctx.fed}
          goal={ctx.goal}
          seen={ctx.seen}
          missingDigits={ctx.forgot}
          onFeed={ctx.feed}
          onEvolve={ctx.setStage}
          onInstantCheck={(truth) => {
            /* 每喂一个，当场考一次刚喂的数字（给一点"印象新鲜"的奖励） */
            const acc = accuracyByFed(ctx.fed + 1) + 0.04
            const g = classify('fledgling', truth, Math.random, Math.min(0.96, acc))
            const correct = g.digit === truth
            track('instant_check', {
              truth,
              guess: g.digit,
              correct,
              chapter: 'ch0',
            })
          }}
        />
      )}
      fromBody={fromBody}
      handoffReady={handoffReady}
      onExit={onExit}
    />
  )
}
