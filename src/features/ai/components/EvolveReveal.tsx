/* =============================================================================
   EvolveReveal.tsx —— BOSS 打完的"进化演出"（滚动式）
   ---------------------------------------------------------------------------
   时间线（总 2.6 秒）：
     t=0.00  两条轨道停在左边 —— 观众看到旧形态
     t=0.70  整条轨道水平向左滚一格（760ms）
             旧形态从左边滚出画面，新形态从右边滚进来
     t=1.46  滚完，新形态落定（轻微回弹），标题从模糊到清晰
     t=1.90  徽章、术语依次弹入

   为什么重做成滚动式：
     之前用的是"爆闪 + 白光"那一套，合成层太多、效果发糊，
     而且方向不明确。滚动式只有一个 transform 在动：
     干净、锐利、方向一眼看懂 —— 旧的走了，新的来了。
   ========================================================================== */

import { useEffect, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import '@/features/ai/components/evolve-reveal.css'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface EvolveRevealProps {
  fromBody: BodyKind
  toBody: BodyKind
  toMood?: Mood
  beforeLabel?: string
  afterLabel?: string
  fromSize?: number
  toSize?: number
  /** 格子宽度（px）—— 决定滚动一格的距离 */
  cellWidth?: number
  /** 滚动的开始时间与时长（毫秒） */
  rollDelay?: number
  rollDuration?: number
}

export function EvolveReveal({
  fromBody,
  toBody,
  toMood = 'proud',
  beforeLabel = '之前',
  afterLabel = '现在',
  fromSize = 124,
  toSize = 168,
  cellWidth = 190,
  rollDelay = 700,
  rollDuration = 760,
}: EvolveRevealProps) {
  const [rolling, setRolling] = useState(false)
  const [landed, setLanded] = useState(false)

  useEffect(() => {
    setRolling(false)
    setLanded(false)

    const t1 = window.setTimeout(() => setRolling(true), rollDelay)
    const t2 = window.setTimeout(() => {
      setRolling(false)
      setLanded(true)
    }, rollDelay + rollDuration)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [fromBody, toBody, rollDelay, rollDuration])

  return (
    <div className="flex flex-col items-center">
      {/* 滚动区：一个裁切窗口 + 两条轨道 */}
      <div
        className={`sr-mask sr-root${rolling ? ' sr-rolling' : ''}`}
        style={{ width: cellWidth }}
      >
        {/* ★ 滚完之后必须用 inline style 把 -50% 锁住。
            否则 animation 一撤，transform 回到 CSS 初始值 0，会看到明显的回弹。 */}
        <div
          className="sr-track"
          style={landed ? { transform: 'translateX(-50%)' } : undefined}
        >
          {/* 左格：旧形态 */}
          <div className="sr-cell">
            <Pet body={fromBody} mood="confused" size={fromSize} still />
            <div className="mt-2 text-[11px] text-lcd-ink/40">{beforeLabel}</div>
          </div>

          {/* 右格：新形态（滚进来之后轻微落定） */}
          <div className={`sr-cell${landed ? ' sr-fresh' : ''}`}>
            <Pet body={toBody} mood={toMood} size={toSize} />
            <div className="mt-2 text-[11px] font-medium text-lcd">{afterLabel}</div>
          </div>
        </div>
      </div>

      {/* 下面一行说明，滚动时淡出、滚完淡入 */}
      <div
        className="mt-4 text-[10px] font-semibold tracking-[0.2em] text-lcd-ink/30 transition-opacity duration-300"
        style={{ opacity: rolling ? 0 : 1 }}
      >
        {rolling ? '形态重写中…' : '形态已更新'}
      </div>
    </div>
  )
}
