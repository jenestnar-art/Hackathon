/* =============================================================================
   Pet.tsx —— 那只小生物
   ---------------------------------------------------------------------------
   全模块的心脏。三个关键设计决定：

   ① 形态参数化 —— 不为每种样子画图，用「控制点 + 颜色 + 表情」生成
   ② 影子画在动画组【外面】—— 地上影子不会跟着身体倾斜
   ③ 重播动画用「重启动画」而不是换 React key
      早先用 key={...} 让 SVG 重新挂载来重播动画，结果宠物会在那一帧
      整个消失（浅色的白球、绿球特别明显）。现在改成直接操作 DOM：
      移除动画类 → 强制重排 → 重新加上，DOM 不动，只是动画从头放。
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { BODIES, FACES, type BodyKind, type Mood, type Point } from '@/features/ai/pet/petState'
import '@/features/ai/pet/pet.css'

interface PetProps {
  body?: BodyKind
  mood?: Mood
  spots?: number
  speech?: string
  note?: string
  size?: number
  still?: boolean
  /** 每次数值 +1 就播一次"吃到了"的弹性动画 */
  bounce?: number
  /** 每次数值 +1 就播一次"进化闪光" */
  evolve?: number
  /** 每次数值 +1 就播一次"挨揍"（被打中了） */
  hit?: number
  /**
   * 让它的眼睛盯着某个屏幕坐标看（比如鼠标/手指的位置）。
   * ★ 拖动数字喂它的时候，它会一直盯着你的手 —— 活物感主要来自这里。
   */
  lookAt?: { x: number; y: number } | null
  /**
   * 不画地面阴影，交给外面画。
   * ★ 什么时候需要它：当外层还要对整只宠物做【位移】动画时
   *   （比如 PokePet 的高兴蹦跳、开窍亮相）。
   *   因为 .pet-root 是 position:relative，画在里面的阴影会跟着一起平移，
   *   看起来就像"影子飘起来"了。
   *   这种场合要把阴影放到一个【不动的外层容器】里去画。
   */
  hideShadow?: boolean
  /** 阴影层的额外 class（外面接管阴影时用，比如 pet-shadow-happy） */
  shadowClass?: string
}

export function Pet({
  body = 'round',
  mood,
  spots = 0,
  speech,
  note,
  size = 180,
  still = false,
  bounce = 0,
  evolve = 0,
  hit = 0,
  lookAt = null,
  hideShadow = false,
  shadowClass = '',
}: PetProps) {
  const spec = BODIES[body]
  const shown: Mood = mood ?? spec.defaultMood
  const face = FACES[shown]

  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const bodyPath = pathFrom(spec.points)
  const gradId = `pet-grad-${body}`
  const clipId = `pet-clip-${body}`
  const uneven = body === 'blob'

  /* ★ 重播动画：不卸载 DOM，只重启动画 */
  function replay(el: Element | null, cls: string, ms: number) {
    if (!el) return
    el.classList.remove(cls)
    // 读一次布局，强制浏览器认账"类真的被移除了"
    void (el as HTMLElement).offsetWidth
    el.classList.add(cls)
    window.setTimeout(() => el.classList.remove(cls), ms)
  }
  const lastBounce = useRef(bounce)
  const lastEvolve = useRef(evolve)

  /**
   * 影子单独播动画。
   * ★ 为什么必须有它：身体跳起来的时候，如果影子完全不动，
   *   看起来就像"贴纸在动"，没有重量。影子一缩一张，观众才信它踩在地上。
   *   注意影子【只做 scale 和 opacity】，永远不 rotate。
   */
  function replayShadow(cls: string, ms: number) {
    /* 阴影可能画在本组件里，也可能被外层接管（hideShadow）——
       所以从最近的共同祖先去找，两处都能找到。 */
    const scope = wrapRef.current?.closest('.pet-shadow-scope') ?? wrapRef.current
    replay(scope?.querySelector('.pet-shadow') ?? null, cls, ms)
  }

  useEffect(() => {
    if (bounce !== lastBounce.current) {
      lastBounce.current = bounce
      if (bounce > 0) {
        replay(groupRef.current, 'pet-eat', 700)
        replayShadow('pet-shadow-eat', 700)
      }
    }
  }, [bounce])
  useEffect(() => {
    if (evolve !== lastEvolve.current) {
      lastEvolve.current = evolve
      if (evolve > 0) {
        replay(groupRef.current, 'pet-evolve', 1000)
        replayShadow('pet-shadow-evolve', 1000)
      }
    }
  }, [evolve])

  /* 挨揍：身体抖 + 脸上闪红 + 影子跟着缩 */
  const lastHit = useRef(hit)
  const [hitFlash, setHitFlash] = useState(0)
  useEffect(() => {
    if (hit !== lastHit.current) {
      lastHit.current = hit
      if (hit > 0) {
        replay(groupRef.current, 'pet-hit', 700)
        replayShadow('pet-shadow-hit', 700)
        setHitFlash(hit)
        window.setTimeout(() => setHitFlash((h) => (h === hit ? 0 : h)), 640)
      }
    }
  }, [hit])

  /* ---------- 眼珠：优先看鼠标，没人理它就自己乱瞟 ---------- */
  const [look, setLook] = useState({ x: 0, y: 0 })

  /**
   * ★ 全局鼠标/手指位置。
   * 为什么要它：宠物出现在很多界面（开场、喂食、BOSS、变形、身份证…），
   * 之前只有拖动喂食那一处传了 lookAt，别的地方它都在自己乱瞟。
   * 给它一个全局兜底，所有环节的眼睛就都会跟着鼠标转了。
   * 用 ref 存最新位置，避免每次鼠标移动都触发 React 重渲染。
   */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (lookAt) return // 外面明确指定了看哪儿，就不装全局监听
    if (typeof window === 'undefined') return

    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        setPointer({ x: e.clientX, y: e.clientY })
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [lookAt])

  useEffect(() => {
    // ① 外面明确指定了 → 听它的
    // ② 否则看全局鼠标
    const target = lookAt ?? pointer
    if (target) {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (rect) {
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height * 0.45
        const dx = (target.x - cx) / (rect.width / 2)
        const dy = (target.y - cy) / (rect.height / 2)
        const clamp = (v: number) => Math.max(-1, Math.min(1, v))
        setLook({ x: clamp(dx) * 6, y: clamp(dy) * 5 })
      }
      return
    }

    // ③ 鼠标一直没动过：随机乱瞟，让它看起来还活着
    if (still) return
    const range = shown === 'confused' ? 3.2 : shown === 'happy' ? 2.2 : 1.6
    const id = window.setInterval(() => {
      setLook({
        x: (Math.random() - 0.5) * 2 * range,
        y: (Math.random() - 0.5) * range * 1.4,
      })
    }, shown === 'confused' ? 1100 : 1900)
    return () => window.clearInterval(id)
  }, [shown, still, lookAt, pointer])

  /* ---------- 眨眼 ---------- */
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    if (still || face.pupil === 0) return
    let id = 0
    const schedule = () => {
      id = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 140)
        schedule()
      }, 2200 + Math.random() * 3200)
    }
    schedule()
    return () => window.clearTimeout(id)
  }, [still, face.pupil])

  const cls = [
    'pet-svg',
    still ? '' : `pet-mood-${shown}`,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className="pet-root"
      style={{ width: size, ['--pet-size' as string]: `${size}px` }}
      ref={wrapRef}
    >
      {speech && (
        <div className="pet-bubble">
          {speech}
          {note && <span className="pet-bubble-note">{note}</span>}
        </div>
      )}

      <div className="relative" style={{ width: size, height: size }}>
        {/* ★ 地面阴影：独立一层，垫在身体下面。它只能缩放和变淡，绝不旋转。
            踩过的坑：以前阴影画在 <svg> 里，而旋转动画挂在 .pet-svg 上，
            等于连阴影一起转了。移出 <g> 没用，必须移出整个 <svg>。
            另一个坑：外层若还要给整只宠物做位移动画（PokePet 的蹦跳），
            画在这里的阴影会跟着飘 —— 那种场合用 hideShadow 交给外层画。 */}
        {!hideShadow && (
          <div
            className={`pet-shadow${still ? '' : ` pet-shadow-${shown}`} ${shadowClass}`.trim()}
            aria-hidden
          />
        )}

        {/* 挨揍时脸上闪一下红 */}
        {hitFlash > 0 && (
          <div
            className="pet-hitmark"
            key={`hitmark-${hitFlash}`}
            style={{ width: size * 0.86, height: size * 0.86, margin: size * 0.07 }}
          />
        )}
        {/* 进化时向外炸开的光环 */}
        {evolve > 0 && (
          <div className="pet-burst" style={{ color: spec.stroke }} key={`burst-${evolve}`}>
            <span />
            <span />
            <span />
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox="0 0 200 200"
          width={size}
          height={size}
          role="img"
          aria-label={`模型宠物的形象，当前情绪：${shown}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor={spec.from} />
              <stop offset="100%" stopColor={spec.to} />
            </linearGradient>
            <clipPath id={clipId}>
              <path d={bodyPath} />
            </clipPath>
          </defs>

          {/* ★ 动画组：注意 class 挂在 <g> 上，不是 <svg> 上。
              挂 <svg> 上会连阴影一起转（阴影现在是 CSS 层，但习惯上仍应如此）。 */}
          <g ref={groupRef} className={cls} style={{ transformOrigin: '100px 178px' }}>
            <path
              d={bodyPath}
              fill={`url(#${gradId})`}
              stroke={spec.stroke}
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {spots > 0 && (
              <g clipPath={`url(#${clipId})`} opacity="0.85">
                {spotPositions(spots).map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#c96a6a" opacity="0.42" />
                ))}
              </g>
            )}

            <ellipse cx="76" cy="66" rx="16" ry="11" fill="#fff" opacity="0.5" />

            {/* 眼睛 */}
            {[78, 122].map((x, i) => {
              const cy = uneven ? (i === 0 ? 84 : 92) : 86
              const r = uneven ? (i === 0 ? 15.5 : 11.5) : 14
              const pupilW = (face.pupilWide ?? 1) * face.pupil
              const closed = blink || face.pupil === 0
              const ry = closed ? 1.6 : face.pupil * face.eyeScaleY + (shown === 'happy' ? 1.6 : 0)
              const rx = closed ? r * 0.85 : pupilW + (shown === 'happy' ? 1.2 : 0)

              return (
                <g key={x}>
                  <circle cx={x} cy={cy} r={r} fill="#fff" stroke="rgba(18,32,30,0.10)" />
                  <ellipse
                    cx={x + look.x + (uneven && i === 1 ? -2 : 0)}
                    cy={cy + look.y + (face.eyeScaleY > 1 ? 2 : 0)}
                    rx={rx}
                    ry={ry}
                    fill="#12201e"
                    style={{ transition: 'cx 160ms ease-out, cy 160ms ease-out' }}
                  />
                  {!closed && (
                    <circle
                      cx={x + look.x + 3.5}
                      cy={cy + look.y - 4}
                      r={2.4}
                      fill="#fff"
                      style={{ transition: 'cx 160ms ease-out, cy 160ms ease-out' }}
                    />
                  )}
                  {!closed && shown === 'proud' && (
                    <path
                      d={`M ${x + look.x + 3} ${cy + look.y - 1} l 1.6 3.6 l 3.6 1.6 l -3.6 1.6 l -1.6 3.6 l -1.6 -3.6 l -3.6 -1.6 l 3.6 -1.6 Z`}
                      fill="#ffd75e"
                    />
                  )}
                </g>
              )
            })}

            {face.extra === 'blush' && (
              <g opacity="0.5">
                <ellipse cx="62" cy="106" rx="9" ry="5.5" fill="#f08a8a" />
                <ellipse cx="138" cy="106" rx="9" ry="5.5" fill="#f08a8a" />
              </g>
            )}

            <path
              d={face.mouth(124)}
              fill={shown === 'happy' ? '#e8767a' : 'none'}
              stroke="#12201e"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {face.extra === 'sweat' && (
              <path
                d="M150 60 q 7 11 0 16 q -7 -5 0 -16 Z"
                fill="#7cc4f0"
                opacity="0.9"
                className="pet-sweat"
              />
            )}
            {face.extra === 'sparkle' && (
              <g fill="#ffd75e" className="pet-sparkle">
                <path d="M166 46 l 3.5 8 l 8 3.5 l -8 3.5 l -3.5 8 l -3.5 -8 l -8 -3.5 l 8 -3.5 Z" />
                <path d="M32 62 l 2.5 6 l 6 2.5 l -6 2.5 l -2.5 6 l -2.5 -6 l -6 -2.5 l 6 -2.5 Z" />
              </g>
            )}
            {face.extra === 'bandage' && (
              <g transform="rotate(-18 140 120)">
                <rect x="126" y="114" width="30" height="11" rx="3" fill="#f6ead2" stroke="#cbb894" />
                <line x1="132" y1="114" x2="132" y2="125" stroke="#cbb894" />
                <line x1="150" y1="114" x2="150" y2="125" stroke="#cbb894" />
              </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   把控制点连成一条平滑闭合曲线（相邻两点的中点作为端点）。
   ------------------------------------------------------------------------ */
function pathFrom(points: Point[]): string {
  const n = points.length
  if (n < 3) return ''

  const mid = (a: Point, b: Point) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  })

  const start = mid(points[n - 1], points[0])
  let d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)}`

  for (let i = 0; i < n; i++) {
    const cur = points[i]
    const next = points[(i + 1) % n]
    const end = mid(cur, next)
    d += ` Q ${cur.x.toFixed(1)} ${cur.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  }

  return `${d} Z`
}

/* 斑块位置：固定序列，保证同一数量每次都长在同一个地方 */
interface Spot {
  x: number
  y: number
  r: number
}

const SPOT_SLOTS: Spot[] = [
  { x: 70, y: 150, r: 15 },
  { x: 132, y: 148, r: 12 },
  { x: 100, y: 168, r: 10 },
  { x: 52, y: 112, r: 11 },
  { x: 150, y: 118, r: 9 },
  { x: 100, y: 52, r: 12 },
  { x: 68, y: 60, r: 8 },
  { x: 138, y: 62, r: 8 },
]

function spotPositions(count: number): Spot[] {
  return SPOT_SLOTS.slice(0, Math.min(count, SPOT_SLOTS.length))
}
