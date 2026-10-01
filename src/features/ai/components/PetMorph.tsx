/* =============================================================================
   PetMorph.tsx —— 形态变化时的"梯形遮挡片"转场
   ---------------------------------------------------------------------------
   用法：
     <PetMorph morphKey={stageIndex} render={(body) => <Pet body={body} ... />} />

   工作原理（三段时间线）：
     t=0    旧形态在画面中央，静止
     t=450  梯形遮挡片刚好完全盖住中央 → 在这一刻把形态换成新的（观众看不到）
     t=900  梯形从左侧离开，露出新形态 → 播一次很轻的"落定"回弹

   为什么要"借遮挡偷换"而不是"让观众看着它变"：
     看着它变 = 注意力在"变化过程"上，容易显廉价。
     遮挡偷换 = 观众只看到结果，干净利落，是成熟游戏的做法。
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import '@/features/ai/components/pet-morph.css'

interface PetMorphProps {
  /** 这个值一变，就播一次遮挡换形态 */
  morphKey: number | string
  /** 渲染宠物。收到的是"当前该显示的形态" */
  render: (morphKey: number | string) => React.ReactNode
  /** 遮挡片完全盖住的那一刻（毫秒），默认 450 */
  swapAt?: number
  /** 整个过渡时长，默认 900 */
  duration?: number
}

export function PetMorph({
  morphKey,
  render,
  swapAt = 450,
  duration = 900,
}: PetMorphProps) {
  /** 屏幕上此刻显示的形态 */
  const [shown, setShown] = useState(morphKey)
  const [sweeping, setSweeping] = useState(false)
  const [landed, setLanded] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    // 首次渲染不播动画
    if (shown === morphKey) return

    setSweeping(true)
    setLanded(false)

    // 遮挡片盖住中央的那一刻 —— 偷换形态
    const t1 = window.setTimeout(() => setShown(morphKey), swapAt)
    // 扫完，露出新形态
    const t2 = window.setTimeout(() => {
      setSweeping(false)
      setLanded(true)
    }, duration)
    // 落定动画结束
    const t3 = window.setTimeout(() => setLanded(false), duration + 500)

    timers.current = [t1, t2, t3]
    return () => timers.current.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morphKey])

  return (
    <div className={`pm-stage${sweeping ? ' pm-sweeping' : ''}`}>
      <div className={`pm-body${landed ? ' pm-landed' : ''}`}>{render(shown)}</div>

      {/* 遮挡层：只在扫过期间存在 */}
      {sweeping && (
        <div className="pm-wipe-layer" aria-hidden>
          <div className="pm-trapezoid" />
        </div>
      )}
    </div>
  )
}
