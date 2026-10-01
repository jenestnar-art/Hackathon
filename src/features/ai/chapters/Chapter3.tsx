/* =============================================================================
   Chapter3.tsx —— 第 3 章：它被人教坏了（数据质量）
   ---------------------------------------------------------------------------
   这一章的戏眼是【它认错，不全是它的错】。

   情绪曲线：
     开场：它很得意"我又变强了，准确率 97%"      → smug
     翻车：3 和 8 全认反，身上长了 5 块斑块       → hurt
     抓内鬼：拉出"图是 3、标签是 8"的样本          → 玩家自己看明白
     清干净：斑块退了，成绩单全对，它跳起来        → happy + "我脑子清爽了！"
         ↓
     打 BOSS「内鬼样本」→ 滚动换形态 → 徽章「内鬼猎人」
   ========================================================================== */

import { ChapterRunner } from '@/features/ai/ChapterRunner'
import { DetectiveGame } from '@/features/ai/games/DetectiveGame'
import { CH3 } from '@/features/ai/data/petLines'
import { POISON_GOAL, accuracyFor, caughtCount, markCaught } from '@/features/ai/games/poisonRules'
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

export function Chapter3({ onExit, fromBody, handoffReady }: Props) {
  return (
    <ChapterRunner
      chapterId="ch3"
      goal={POISON_GOAL}
      forgetOnLose={0}
      styleBias="messy"
      petBody="spiky"
      introLines={[
        { mood: 'smug', text: CH3.enter.text },
        { mood: 'smug', text: '3 和 8 我闭着眼睛都能认。' },
        { mood: 'hurt', text: '……等一下，我身上怎么长了斑块？' },
      ]}
      initial={{ fed: 0, seen: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], feedOrder: [] }}
      /* ★ BOSS 战从共享记录读"抓了几张内鬼" —— 抓够了它才认得出 3 和 8 */
      bossAccuracy={(truth) => accuracyFor(truth, caughtCount('ch3'))}
      renderGame={(ctx) => (
        <DetectiveGame
          caught={caughtCount('ch3')}
          onCatch={(id, wasPoison) => {
            if (wasPoison) {
              markCaught('ch3', id)
              ctx.feed(0)
            }
          }}
          petBody="spiky"
          petMood="hurt"
        />
      )}
      fromBody={fromBody}
      handoffReady={handoffReady}
      onExit={onExit}
    />
  )
}
