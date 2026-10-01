/* =============================================================================
   Chapter4.tsx —— 第 4 章：出道（泛化）
   ---------------------------------------------------------------------------
   收尾的一章：前四章教的毛病，这一章一起考。
   数据清单里混着标错的样本，"全都喂"最快但会被带偏。

   情绪曲线：
     开场：它准备好了，"这次是真的新题"          → idle
     模拟考：一张没喂 → 瞎猜                     → confused
     挑数据：一张张挑干净的，泛化能力往上爬      → confused → 开窍
     过关：真实现场也能认，它跳起来              → happy
         ↓
     打 BOSS「真实现场」→ 滚动换形态 → 徽章「出师」→ 模型身份证
   ========================================================================== */

import { ChapterRunner } from '@/features/ai/ChapterRunner'
import { FinalGame } from '@/features/ai/games/FinalGame'
import { CH4 } from '@/features/ai/data/petLines'
import { FINAL_GOAL, accuracyFor, getPicked, setPicked } from '@/features/ai/games/finalRules'
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

export function Chapter4({ onExit, fromBody, handoffReady }: Props) {
  return (
    <ChapterRunner
      chapterId="ch4"
      goal={FINAL_GOAL}
      forgetOnLose={0}
      styleBias="messy"
      petBody="healthy"
      introLines={[
        { mood: 'idle', text: CH4.enter.text },
        { mood: 'idle', text: '前面那些毛病，我大概都改掉了。' },
        { mood: 'idle', text: '这次是真的新题 —— 一道我都没做过。' },
      ]}
      initial={{ fed: 0, seen: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], feedOrder: [] }}
      /* ★ BOSS 战从共享记录读玩家挑的卡 —— 泛化能力决定它能不能认出手写体 */
      bossAccuracy={(truth) => accuracyFor(truth, getPicked('ch4'))}
      renderGame={(ctx) => (
        <FinalGame
          onFeed={(digit) => ctx.feed(digit)}
          onPickedChange={(cards) => setPicked('ch4', cards)}
          petBody="healthy"
          petMood="idle"
        />
      )}
      fromBody={fromBody}
      handoffReady={handoffReady}
      onExit={onExit}
    />
  )
}
