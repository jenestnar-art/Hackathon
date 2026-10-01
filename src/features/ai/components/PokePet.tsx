/* =============================================================================
   PokePet.tsx —— 可点击的宠物：戳一下会抖、留残影，开心了会蹦
   ---------------------------------------------------------------------------
   两套情绪：
     丧（还没开窍）：戳它 → 抖动 + 残影 + 抱歉神态 + 道歉台词
     得意（开窍了）：一直高兴地蹦 + 头顶冒星星 + 戳它还是开心
   ★ 情绪要跟着"它的水平"走，不能开了窍还贴着创可贴道歉。
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import '@/features/ai/components/pet-shake-ghost.css'
import '@/features/ai/components/pet-cheer.css'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface PokePetProps {
  body: BodyKind
  mood: Mood
  size?: number
  spots?: number
  /** 被戳时要说的几句话（随机挑一句）。会随情绪换一套。 */
  lines: string[]
  /** 被戳时切换到的表情，默认 hurt */
  pokeMood?: Mood
  lineDuration?: number
  /** 外部状态文字（没被戳时显示） */
  statusText?: string
  disabled?: boolean
  /** ★ 是否处于"得意"状态：会一直蹦、冒星星、状态文字变绿 */
  cheering?: boolean
  /** ★ 每次 +1 就播一次夸张的"跳起来亮相"（刚开窍那一下） */
  celebrate?: number
}

export function PokePet({
  body,
  mood,
  size = 172,
  spots,
  lines,
  pokeMood = 'hurt',
  lineDuration = 3000,
  statusText,
  disabled = false,
  cheering = false,
  celebrate = 0,
}: PokePetProps) {
  const [poking, setPoking] = useState(false)
  const [line, setLine] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  /** 刚开窍那一下的夸张亮相 */
  const [showingOff, setShowingOff] = useState(false)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  const poke = useCallback(() => {
    if (disabled) return
    clear()
    setTick((t) => t + 1)
    setPoking(true)
    setLine(lines[Math.floor(Math.random() * lines.length)])
    timers.current = [
      window.setTimeout(() => setPoking(false), 700),
      window.setTimeout(() => setLine(null), lineDuration),
    ]
  }, [disabled, lines, lineDuration])

  /* 刚开窍：播一次夸张的跳起来 */
  const lastCelebrate = useRef(celebrate)
  useEffect(() => {
    if (celebrate === lastCelebrate.current) return
    lastCelebrate.current = celebrate
    if (celebrate <= 0) return
    setShowingOff(true)
    const id = window.setTimeout(() => setShowingOff(false), 1150)
    return () => window.clearTimeout(id)
  }, [celebrate])

  useEffect(() => clear, [])

  const shownMood: Mood = poking ? pokeMood : mood

  const wrapCls = [
    'pk-wrap',
    poking ? 'pk-hit' : '',
    cheering && !poking ? 'pk-cheer' : '',
    showingOff ? 'pk-celebrate-once' : '',
    disabled ? 'cursor-default' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col items-center">
      {/* ★ pet-shadow-scope：阴影的"落点容器"。
          它是这一整块里【唯一不动】的元素（button 和 pk-inner 都会动），
          所以地面阴影必须放在这一层，否则蹦跳时阴影会跟着飘。
          Pet 内部通过 closest('.pet-shadow-scope') 找到它来播阴影动画。 */}
      <div
        className="pet-shadow-scope relative"
        style={{ width: size, height: size }}
      >
        {/* 地面阴影：不随身体动，只在蹦跳时"呼吸" */}
        <div
          className={`pet-shadow${poking ? '' : ` pet-shadow-${shownMood}`}`}
          aria-hidden
        />

        <button
          type="button"
          onClick={poke}
          disabled={disabled}
          aria-label="戳一下它"
          className={wrapCls}
          style={{ width: size, height: size, background: 'none', border: 'none', padding: 0 }}
        >
          {/* 庆祝时头顶冒星星 */}
          {cheering && !poking && (
            <span className="pk-cheer-stars" aria-hidden>
              <span>✨</span>
              <span>⭐</span>
              <span>✨</span>
            </span>
          )}

          {/* 两层残影：错开起跑，拖在后面。
              ★ 残影必须 still —— 它是"上一帧的定格"，自己再动就乱了。
              残影也不画阴影（hideShadow），否则会看到三个影子。 */}
          {poking && (
            <>
              <span className="pk-ghost pk-ghost-1" key={`g1-${tick}`} aria-hidden>
                <Pet body={body} mood={shownMood} spots={spots} size={size} still hideShadow />
              </span>
              <span className="pk-ghost pk-ghost-2" key={`g2-${tick}`} aria-hidden>
                <Pet body={body} mood={shownMood} spots={spots} size={size} still hideShadow />
              </span>
          </>
        )}

        {/* 本体。
            ★ 这里【绝对不能传 still】。
            still 会关掉情绪动作（pet-mood-*），于是：
              · 高兴时它不会蹦（用户明确要求过"高兴要跳起来"）
              · 地面阴影也不会跟着呼吸（阴影的节奏是跟着情绪动作走的）
            ★ 这里也【必须 hideShadow】：阴影已经由外面那个不动的
            .pet-shadow-scope 画好了，否则会有两个影子。
            被戳时由外层 .pk-inner 的 pk-shake 接管抖动 —— 那个作用在父级，
            和这里的情绪动作是两个不同的元素，不会互相覆盖。 */}
        <span
          key={`b-${tick}`}
          className={`pk-inner block${poking ? ' pk-shake' : ''}`}
          style={{ width: size, height: size }}
        >
          <Pet body={body} mood={shownMood} spots={spots} size={size} hideShadow />
        </span>
        </button>
      </div>

      {/* 状态 / 台词 */}
      <div className="mt-1 flex min-h-[44px] max-w-[230px] flex-col items-center">
        {line ? (
          <p
            className="rounded-2xl bg-lcd/15 px-3.5 py-2 text-center text-[11px] leading-5 text-lcd-ink"
            style={{ animation: 'pet-bubble-in 240ms cubic-bezier(0.22,1,0.36,1) both' }}
          >
            {line}
          </p>
        ) : (
          <>
            {statusText && (
              <p
                className={`text-[11px] font-semibold${
                  cheering ? ' pk-status-proud' : ' text-lcd-ink/45'
                }`}
              >
                {statusText}
              </p>
            )}
            {!disabled && (
              <span className="pk-tip mt-1 text-[10px] text-lcd">
                {cheering ? '👆 再戳我一下' : '👆 戳我一下'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
