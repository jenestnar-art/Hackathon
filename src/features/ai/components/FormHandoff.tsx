/* =============================================================================
   FormHandoff.tsx —— 章节开场：上一章的形态浮上去，新的从下面升起来
   ---------------------------------------------------------------------------
   用法：
     <FormHandoff from="fat" to="round" size={190} />

   `from` 是上一章结束时的形态（没有就只演"新的升上来"）。
   ========================================================================== */

import { useEffect, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import '@/features/ai/components/form-handoff.css'
import type { BodyKind } from '@/features/ai/pet/petState'

interface FormHandoffProps {
  /** 上一章结束时的形态 */
  from?: BodyKind
  /** 这一章开始时的形态 */
  to: BodyKind
  size?: number
  /** 舞台高度 */
  stageHeight?: number
  /**
   * 是否可以开演了。
   * 外层有"全屏镜头推进"的时候要等它演完再传 true，
   * 否则交接动画会在遮罩底下演完，观众什么都看不到。
   */
  ready?: boolean
}

export function FormHandoff({
  from,
  to,
  size = 186,
  stageHeight = 300,
  ready = true,
}: FormHandoffProps) {
  /** 挂载后再启动动画，保证每次都从头播 */
  const [rose, setRose] = useState(false)

  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => setRose(true), 60)
    return () => window.clearTimeout(t)
  }, [ready])

  return (
    <div className="fh-stage" style={{ width: size * 2, height: stageHeight }} aria-hidden>
      <span className="fh-beam" />

      {/* 旧形态：向上浮走。
          未启动时用 .fh-old-in 把它摆在正中，启动后换成 .fh-old 播上浮。 */}
      {from && (
        <div className={`fh-layer ${rose ? 'fh-old' : 'fh-old-in'}`} data-fh="old">
          <Pet body={from} mood="idle" size={size} hideShadow />
        </div>
      )}

      {/* 新形态：从下方升起来 */}
      <div className={`fh-layer fh-new${rose ? ' fh-new-in' : ''}`} data-fh="new">
        <Pet body={to} mood="idle" size={size} />
      </div>
    </div>
  )
}
