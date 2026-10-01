/* =============================================================================
   Chapter2.tsx —— 第 2 章：它只会做原题（过拟合）
   ---------------------------------------------------------------------------
   这一章的戏眼是【你自己写的字，它当面不认】。

   情绪曲线：
     开场：它很得意"训练集 96%"            → proud
     翻车：原题全对、变形全错，它一个都不认  → dead（僵住了）
     被戳：抖一下 + 残影 + "我见过的 7 不是这样的"
     喂食：一个个变形样本喂进去            → confused → 慢慢开窍
     开窍：什么写法都认得了，跳起来         → happy + "什么写法我都认得了！"
         ↓
     打 BOSS「歪七扭八」→ 滚动换形态 → 徽章「吹哨人」
   ========================================================================== */

import { ChapterRunner } from '@/features/ai/ChapterRunner'
import { OverfitGame } from '@/features/ai/games/OverfitGame'
import { CH2 } from '@/features/ai/data/petLines'
import { OVERFIT_GOAL, accuracyFor, getVariants } from '@/features/ai/games/overfitRules'
import type { ChapterId } from '@/features/ai/store/petStore'
import type { BodyKind } from '@/features/ai/pet/petState'

interface Props {
  onExit?: () => void
  onChapterChange?: (id: ChapterId) => void
  /** 上一章结束时的形态：开场演一次形态交接 */
  fromBody?: BodyKind
  /** 外层的全屏推进演完了没有 */
  handoffReady?: boolean
}

export function Chapter2({ onExit, fromBody, handoffReady }: Props) {
  return (
    <ChapterRunner
      chapterId="ch2"
      goal={OVERFIT_GOAL}
      forgetOnLose={0}
      /* ★ 必须用 messy：这一章的 BOSS「歪七扭八」出的就是手写体。
         写成 normal 的话，故事说"字写得丑你别怪我"，题面却是工整字，对不上。 */
      styleBias="messy"
      petBody="box"
      introLines={[
        { mood: 'proud', text: CH2.enter.text },
        { mood: 'proud', text: '这套题我全做过，随便考。' },
        { mood: 'confused', text: '……不过要是换个写法，我就不保证了。' },
      ]}
      initial={{ fed: 0, seen: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], feedOrder: [] }}
      /* ★ BOSS 战和成绩单调同一个函数。它出的全是手写体（messy=true），
           所以成绩单全对 = BOSS 每题必对 = 必赢 */
      bossAccuracy={(truth) => accuracyFor(truth, true, getVariants('ch2'))}
      renderGame={(ctx) => (
        <OverfitGame
          fed={ctx.fed}
          goal={ctx.goal}
          onFeed={() => ctx.feed(0)}
          petBody="box"
          petMood="dead"
        />
      )}
      fromBody={fromBody}
      handoffReady={handoffReady}
      onExit={onExit}
    />
  )
}
