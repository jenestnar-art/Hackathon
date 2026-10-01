/* =============================================================================
   ChapterTransition.tsx —— 章节过渡：由远及近的镜头推进
   ---------------------------------------------------------------------------
   它在整条流程里的位置：
     这是一层【全屏遮罩】，负责"换场景"——
     打完一章点"进入下一章"，画面先黑下来，巨型章节号从远处冲过来，
     然后穿过去，进入新章节。

     进去之后，新章节的开场还有一次【形态交接】（旧的浮上去、新的升起来），
     那一次负责"换形态"。

     两者一个是"换场"，一个是"换形"，是叠加关系，不是二选一。

   三层结构：
     1. 遮罩 + 星点（提供"远处"的纵深）
     2. 巨型章节号 从 translateZ(-2600px) 冲到 0（真实透视，不是平面放大）
     3. 文字从下方浮起，逐层错开 120ms

   时间线（总 2.6 秒）：
     0.00s  遮罩渐显 + 扫描光带启动
     0.12s  章节号从极远处开始冲过来（带 14px 动态模糊）
     0.50s  CHAPTER 01 小字浮起
     0.62s  主标题浮起
     0.74s  副标题浮起
     0.86s  分隔线展开
     1.95s  章节号穿过镜头冲出画面
     2.20s  遮罩淡出 → 新章节
   ========================================================================== */

import { useEffect, useState } from 'react'
import '@/features/ai/components/chapter-transition.css'

interface ChapterTransitionProps {
  order: string
  title: string
  subtitle?: string
  onDone?: () => void
  /** 总时长（毫秒） */
  duration?: number
}

export function ChapterTransition({
  order,
  title,
  subtitle,
  onDone,
  duration = 2600,
}: ChapterTransitionProps) {
  const [phase, setPhase] = useState<'idle' | 'in' | 'leaving'>('idle')

  useEffect(() => {
    const t0 = window.setTimeout(() => setPhase('in'), 20)
    const t1 = window.setTimeout(() => setPhase('leaving'), duration - 620)
    const t2 = window.setTimeout(() => onDone?.(), duration)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [duration, onDone])

  return (
    <div className={`ct-root ct-${phase}`}>
      <div className={`ct-veil${phase !== 'idle' ? ' on' : ''}`} />
      <div className="ct-stars" />
      <div className="ct-sweep" />

      {/* 巨型章节号：描边版 + 实体版叠在一起，有层次 */}
      <span className="ct-number" aria-hidden>
        {order}
      </span>
      <span className="ct-number-solid" aria-hidden>
        {order}
      </span>

      <div className="ct-vignette" />

      <div className="ct-text">
        <div className="ct-kicker">CHAPTER {order}</div>
        <div className="ct-title">{title}</div>
        {subtitle && <div className="ct-sub">{subtitle}</div>}
        <div className="ct-rule" />
      </div>
    </div>
  )
}

/**
 * 内容"从下方淡入"的包装 —— 用来替代硬切。
 */
export function FadeInUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(id)
  }, [delay])

  return (
    <div
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(16px)',
        transition: 'opacity 520ms ease-out, transform 560ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {children}
    </div>
  )
}
