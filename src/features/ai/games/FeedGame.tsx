/* =============================================================================
   FeedGame.tsx —— 第 0 关核心玩法：喂食
   ---------------------------------------------------------------------------
   核心循环：
     选一个数字 → 拖给它（或点一下）→ 它吃掉、弹一下、说句话
     → 每喂一个就"当场考一次刚喂的数字"，用户亲眼看着它从错到对

   四个关键设计：
     1. 喂满就停（进度环不会出现 23/12）
     2. 跨阶段时它会长大一次（blob → round → healthy），带进化闪光
     3. 它"记住"了你喂过的每个数字 —— 没喂过的它认不对（真逻辑，不是随机）
     4. ★ 台面必须保证"它缺的数字"在场
        否则会出现最气人的情况：它忘了 2 和 4，台面上却一个 2 都没有，
        用户想补数据却找不到材料。所以生成台面时先满足 missing，再随机补满。
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import { Digit, type DigitStyle } from '@/features/ai/components/Digit'
import { STAGES, stageOf, isFull } from '@/features/ai/games/chapter0'

const STYLES: DigitStyle[] = ['normal', 'normal', 'tilted', 'bold', 'thin']
const TRAY_SIZE = 6

interface Sample {
  id: number
  value: number
  style: DigitStyle
  /** 这一张是不是"它刚忘掉的数字"（橙色角标） */
  needed?: boolean
  /** 这一张是不是"它从没见过的数字"（蓝色小点） */
  fresh?: boolean
}

interface FeedGameProps {
  fed: number
  goal: number
  /** 它已经吃过的数字 */
  seen: Set<number>
  /** ★ 它刚忘掉的数字 —— 台面必须优先供应这些 */
  missingDigits?: number[]
  onFeed: (label: number) => void
  onInstantCheck: (truth: number) => void
  onEvolve?: (stageIndex: number) => void
  busy?: boolean
}

export function FeedGame({
  fed,
  goal,
  seen,
  missingDigits = [],
  onFeed,
  onInstantCheck,
  onEvolve,
  busy,
}: FeedGameProps) {
  const nextId = useRef(0)
  const petRef = useRef<HTMLDivElement>(null)

  const [tray, setTray] = useState<Sample[]>([])
  const [dragging, setDragging] = useState<{
    sample: Sample
    x: number
    y: number
    over: boolean
  } | null>(null)
  const [floats, setFloats] = useState<{ id: number; value: number }[]>([])
  const [eatTick, setEatTick] = useState(0)
  /** 鼠标/手指的屏幕坐标 —— 传给它，它的眼睛会一直盯着你看 */
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)

  const stageIdx = stageOf(fed)
  const stage = STAGES[stageIdx]
  const full = isFull(fed, goal)
  const locked = busy || full

  /** 造一个随机样本 */
  function randomSample(forceValue?: number): Sample {
    nextId.current += 1
    return {
      id: nextId.current,
      value: forceValue ?? Math.floor(Math.random() * 10),
      style: STYLES[Math.floor(Math.random() * STYLES.length)],
      needed: forceValue !== undefined,
    }
  }

  /**
   * 生成一副台面。优先级：
   *   1. 它刚忘掉的数字（必须能补上）
   *   2. 它从来没见过的数字（否则用户想喂 1 却刷不出来，只能干等）
   *   3. 随机补满
   */
  function buildTray(missing: number[], known: Set<number>): Sample[] {
    const unique = Array.from(new Set(missing))
    const neverSeen = Array.from({ length: 10 }, (_, d) => d).filter(
      (d) => !known.has(d) && !unique.includes(d)
    )

    const picks: Sample[] = []
    // 1) 缺的优先
    for (const d of unique) {
      if (picks.length >= TRAY_SIZE) break
      picks.push(randomSample(d))
    }
    // 2) 没见过的补位
    for (const d of neverSeen) {
      if (picks.length >= TRAY_SIZE) break
      picks.push(randomSample(d))
    }
    // 3) 剩下随机
    while (picks.length < TRAY_SIZE) picks.push(randomSample())

    // 统一重算标记：每个缺的数字只标一个角标，没见过的打小点
    const marked = new Set<number>()
    for (const s of picks) {
      s.needed = false
      s.fresh = !known.has(s.value)
      if (unique.includes(s.value) && !marked.has(s.value)) {
        marked.add(s.value)
        s.needed = true
      }
    }

    // 打散
    for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[picks[i], picks[j]] = [picks[j], picks[i]]
    }
    return picks
  }

  /* 初始台面 */
  useEffect(() => {
    setTray(buildTray(missingDigits, seen))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ★ missingDigits 变化时（比如刚输了、忘掉几个数字）重建台面 */
  const missingKey = missingDigits.join(',')
  const seenKey = Array.from(seen).sort().join(',')
  useEffect(() => {
    setTray(buildTray(missingDigits, seen))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, seenKey])

  /* ---------------- 喂食 ---------------- */

  /**
   * ★ SKIP：一次喂到饱。
   * 为什么不直接改 fed：喂食是有副作用的（浮动数字、成长阶段、台词、埋点），
   * 硬改数值会跳过这些。所以这里老老实实按顺序喂。
   * 每次之间留 110ms —— 这个间隔不是装饰：
   * 它让 React 有机会刷新状态，下一轮才拿得到替换以后的台面。
   */
  function fillAll() {
    if (locked) return
    const rest = Math.max(0, goal - fed)
    if (rest === 0) return

    for (let i = 0; i < rest; i++) {
      window.setTimeout(
        () => {
          // 每轮重新读台面：上一次喂食已经把它替换并补位过了
          if (tray.length === 0) return
          doFeed(tray[i % tray.length])
        },
        i * 110 + 20
      )
    }
  }

  function doFeed(sample: Sample) {
    if (locked) return

    const before = stageOf(fed)
    const after = stageOf(fed + 1)
    const evolved = after > before

    setEatTick((t) => t + 1)
    if (evolved) {
      // 形态切换由 MorphPet 的梯形遮挡片负责，这里只通知一下（用来播台词）
      onEvolve?.(after)
    }

    const floatId = Date.now() + Math.random()
    setFloats((f) => [...f, { id: floatId, value: sample.value }])
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== floatId)), 900)

    // 这一张被吃掉了 → 补位。补位顺序：缺的数字 → 没见过的数字 → 随机
    setTray((prev) => {
      const rest = prev.filter((s) => s.id !== sample.id)
      const stillMissing = missingDigits.filter((d) => d !== sample.value)
      const shortMissing = stillMissing.filter((d) => !rest.some((s) => s.value === d))
      const knownNow = new Set(seen).add(sample.value)
      const neverSeen = Array.from({ length: 10 }, (_, d) => d).filter(
        (d) =>
          !knownNow.has(d) &&
          !stillMissing.includes(d) &&
          !rest.some((s) => s.value === d)
      )

      const next = [...rest]
      for (const d of shortMissing) {
        if (next.length >= TRAY_SIZE) break
        next.push(randomSample(d))
      }
      for (const d of neverSeen) {
        if (next.length >= TRAY_SIZE) break
        next.push(randomSample(d))
      }
      while (next.length < TRAY_SIZE) next.push(randomSample())
      return next
    })

    onFeed(sample.value)
    window.setTimeout(() => onInstantCheck(sample.value), 280)
  }

  /* ---------------- 拖拽（也支持直接点一下） ---------------- */
  function startDrag(e: React.PointerEvent, sample: Sample) {
    if (locked) return
    const startX = e.clientX
    const startY = e.clientY
    let moved = false

    setDragging({ sample, x: e.clientX, y: e.clientY, over: isOverPet(e.clientX, e.clientY) })
    e.currentTarget.setPointerCapture?.(e.pointerId)

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 6 || Math.abs(ev.clientY - startY) > 6) {
        moved = true
      }
      setPointer({ x: ev.clientX, y: ev.clientY })
      setDragging((d) =>
        d ? { ...d, x: ev.clientX, y: ev.clientY, over: isOverPet(ev.clientX, ev.clientY) } : d
      )
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dropped = isOverPet(ev.clientX, ev.clientY)
      setDragging(null)
      if (dropped || !moved) doFeed(sample)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function isOverPet(x: number, y: number): boolean {
    const rect = petRef.current?.getBoundingClientRect()
    if (!rect) return false
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  const percent = Math.min(100, Math.round((fed / goal) * 100))

  return (
    <div
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]"
      /* 让它的眼珠跟着鼠标走 —— 活物感最便宜也最有效的一招 */
      onPointerMove={(e) => setPointer({ x: e.clientX, y: e.clientY })}
      onPointerLeave={() => setPointer(null)}
    >
      {/* ---------------- 左：宠物 + 台面 ---------------- */}
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-center gap-10">
          {/* 宠物 */}
          <div
            ref={petRef}
            className="relative flex flex-col items-center justify-center rounded-3xl px-7 py-5 transition"
            style={{
              background: dragging?.over ? 'rgb(var(--lcd-rgb) / 0.13)' : 'transparent',
              border: `2px dashed ${dragging?.over ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.12)'}`,
              minWidth: 250,
              minHeight: 310,
            }}
          >
            <Pet
              body={stage.body}
              mood={dragging?.over ? 'happy' : stage.mood}
              size={188}
              bounce={eatTick}
              lookAt={pointer}
            />
            <div className="mt-1 text-[11px] text-lcd-ink/40">
              {full ? '它吃饱了' : dragging ? '松手喂给它' : '把台面上的数字拖过来'}
            </div>

            {/* 吃掉时飘起来的数字 */}
            <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center">
              {floats.map((f) => (
                <span
                  key={f.id}
                  className="absolute"
                  style={{ animation: 'digit-float 900ms ease-out forwards' }}
                >
                  <Digit value={f.value} size={26} color="#d7ff68" />
                </span>
              ))}
            </div>
          </div>

          {/* 进度环 + 成长阶段 */}
          <div className="flex flex-col items-center gap-4">
            <ProgressRing percent={percent} fed={fed} goal={goal} />
            <div className="text-center">
              <div className="text-[11px] text-lcd-ink/45">它吃过的样本</div>
              <div className="mt-1 font-mono text-xs text-lcd-ink/70">
                {full ? '已经吃饱了' : `还差 ${goal - fed} 个`}
              </div>
            </div>

            <div className="mt-1 w-[200px]">
              <div className="mb-2 text-center text-[10px] font-semibold tracking-[0.16em] text-lcd-ink/35">
                它的成长
              </div>
              <div className="flex flex-col gap-1.5">
                {STAGES.map((s, i) => {
                  const reached = i <= stageIdx
                  return (
                    <div
                      key={s.at}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] transition"
                      style={{
                        background: i === stageIdx ? 'rgb(var(--lcd-rgb) / 0.13)' : 'transparent',
                        color: reached ? 'rgb(var(--lcd-ink-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.34)',
                        fontWeight: i === stageIdx ? 600 : 400,
                      }}
                    >
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{
                          background: reached ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.16)',
                        }}
                      />
                      <span className="flex-1">{s.label}</span>
                      <span className="font-mono text-[10px] opacity-45">{s.at}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- 待喂的样本 ---------------- */}
        <div className="row-line mt-6 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-lcd-ink/60">
              台面上的样本（拖给它，或者直接点一下）
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-lcd-ink/38">
                {full
                  ? '它吃不下了，去打仗吧'
                  : missingDigits.length > 0
                    ? '橙色「要补」＝它刚忘的；蓝点＝它从没见过的'
                    : '蓝点＝它从没见过这个数字；拖过去就等于在"标注"'}
              </span>
              {/* ★ SKIP：一次喂到饱。
                  拖 12 个样本对想快的人是纯粹的等待，
                  而且拖到第 8 个之后已经没有新信息了 —— 该允许跳过。 */}
              {!full && !locked && (
                <button
                  type="button"
                  onClick={fillAll}
                  data-probe="feed-all"
                  title="不用一个个拖，直接喂到饱"
                  className="key-skip px-3.5 py-1.5 text-[11px] font-medium"
                >
                  ⏭ 一次喂到饱（还差 {goal - fed} 个）
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3" style={{ opacity: locked ? 0.4 : 1 }}>
            {tray.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={locked}
                onPointerDown={(e) => startDrag(e, s)}
                className="relative flex h-[92px] w-[68px] cursor-grab items-center justify-center rounded-2xl border bg-screen-3 transition hover:-translate-y-0.5 hover:border-lcd hover:bg-screen-3 disabled:cursor-not-allowed"
                style={{
                  borderColor: s.needed ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.11)',
                  borderWidth: s.needed ? 2 : 1,
                  background: s.needed ? 'rgb(var(--lcd-rgb) / 0.1)' : 'rgb(var(--screen-bg-3-rgb))',
                  touchAction: 'none',
                }}
              >
                <Digit value={s.value} size={34} style={s.style} />
                {s.needed && (
                  <span className="absolute -top-1.5 right-1 rounded-full bg-lcd px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    要补
                  </span>
                )}
                {!s.needed && s.fresh && (
                  <span
                    className="absolute right-1.5 top-1.5 size-1.5 rounded-full"
                    style={{ background: '#5cc0ff' }}
                    title="它还没见过这个数字"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 右：它眼里的世界 ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="panel p-5">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-lcd-ink/38">
            它认识哪些数字
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }, (_, d) => {
              const known = seen.has(d)
              const forgotten = missingDigits.includes(d)
              return (
                <div
                  key={d}
                  className="grid aspect-square place-items-center rounded-lg border font-mono text-xs font-bold transition"
                  style={
                    known
                      ? {
                          borderColor: 'rgb(var(--lcd-rgb) / 0.5)',
                          background: 'rgb(var(--lcd-rgb) / 0.13)',
                          color: 'rgb(var(--lcd-rgb))',
                        }
                      : {
                          borderColor: forgotten
                            ? 'rgb(var(--warn-rgb) / 0.55)'
                            : 'rgb(var(--lcd-ink-rgb) / 0.1)',
                          background: forgotten ? 'rgb(var(--warn-rgb) / 0.1)' : 'rgb(var(--screen-bg-3-rgb))',
                          color: forgotten ? 'rgb(var(--warn-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.28)',
                        }
                  }
                >
                  {d}
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-lcd-ink/40">
            {missingDigits.length > 0
              ? '红框的是它刚忘掉的 —— 台面上橙色「要补」的就是它们。'
              : '灰的数字它没见过 —— 你拿没喂过的数字考它，它只能瞎猜。'}
          </p>
        </div>

        <div className="panel p-5">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-lcd-ink/38">
            它现在的水平
          </div>
          <LevelBar fed={fed} />
        </div>
      </div>

      {/* 跟随手指的拖拽影子 */}
      {dragging && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: dragging.x - 30,
            top: dragging.y - 40,
            transform: dragging.over ? 'scale(1.15)' : 'scale(1)',
            transition: 'transform 120ms',
          }}
        >
          <Digit value={dragging.sample.value} size={40} color="#d7ff68" />
        </div>
      )}
    </div>
  )
}

/* ---------------- 进度环 ---------------- */
function ProgressRing({
  percent,
  fed,
  goal,
}: {
  percent: number
  fed: number
  goal: number
}) {
  const R = 54
  const C = 2 * Math.PI * R
  const offset = C * (1 - percent / 100)

  return (
    <div className="relative">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={R} fill="none" stroke="rgb(var(--lcd-ink-rgb) / 0.1)" strokeWidth="10" />
        <circle
          cx="66"
          cy="66"
          r={R}
          fill="none"
          stroke="#d7ff68"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 66 66)"
          style={{ transition: 'stroke-dashoffset 420ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-extrabold text-lcd-ink">{fed}</span>
        <span className="font-mono text-[11px] text-lcd-ink/40">/ {goal}</span>
      </div>
    </div>
  )
}

/* ---------------- 能力条 ---------------- */
function LevelBar({ fed }: { fed: number }) {
  const stages = [
    { at: 0, label: '全靠猜', pct: 12 },
    { at: 4, label: '偶尔蒙对', pct: 38 },
    { at: 9, label: '大概有感觉了', pct: 66 },
    { at: 12, label: '认得你了', pct: 88 },
  ]
  const cur = [...stages].reverse().find((s) => fed >= s.at) ?? stages[0]

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{cur.label}</span>
        <span className="font-mono text-xs text-lcd">{cur.pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-lcd-ink/8">
        <div
          className="h-full rounded-full bg-lcd transition-[width] duration-700"
          style={{ width: `${cur.pct}%` }}
        />
      </div>
      <div className="mt-4 flex flex-col gap-1 text-[10px] text-lcd-ink/40">
        {stages.map((s) => (
          <div
            key={s.at}
            className="flex justify-between"
            style={{ opacity: fed >= s.at ? 1 : 0.4 }}
          >
            <span>{s.label}</span>
            <span className="font-mono">{s.at} 个样本</span>
          </div>
        ))}
      </div>
    </div>
  )
}
