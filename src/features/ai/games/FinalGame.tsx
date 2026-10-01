/* =============================================================================
   FinalGame.tsx —— 第 4 章玩法：出道（真实现场）
   ---------------------------------------------------------------------------
   玩法：
     一张数据清单，20 张候选样本，你自己挑喂哪些给它。
       · 「全都喂给它」最快 —— 但清单里混着 6 张标错的（红标签）
       · 一张张挑干净的，慢，但稳
     喂够 16 张、且干净占比 ≥85%，它才有资格上真实现场。

   为什么这一章要这么设计：
     前三章各教了一个毛病，这一章让它们同时出现，看玩家会不会重蹈覆辙。
     偷懒的人会亲眼看到"喂得越多、真实现场反而越差" —— 那就是反噬。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import { PokePet } from '@/features/ai/components/PokePet'
import { DIGIT_CN } from '@/features/ai/components/Digit'
import { MessyDigit } from '@/features/ai/components/MessyDigit'
import { CH4 } from '@/features/ai/data/petLines'
import { track } from '@/features/ai/lib/track'
import { classify } from '@/features/ai/lib/modelBrain'
import {
  POOL,
  FINAL_GOAL,
  MIN_CLEAN_RATIO,
  GOAL_REAL_ACC,
  REAL_PROBE,
  generalization,
  isEnough,
  isCleanEnough,
  type PoolCard,
} from '@/features/ai/games/finalRules'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface FinalGameProps {
  onFeed: (digit: number) => void
  onPickedChange: (cards: PoolCard[]) => void
  petBody: BodyKind
  petMood?: Mood
}

interface Result {
  truth: number
  guess: number
  correct: boolean
}

const LOOK_LABEL: Record<PoolCard['look'], string> = {
  neat: '工整',
  messy: '手写',
  rot: '转过角度',
}

export function FinalGame({ onFeed, onPickedChange, petBody, petMood }: FinalGameProps) {
  const [picked, setPickedLocal] = useState<PoolCard[]>([])
  const [training, setTraining] = useState(false)
  const [thinking, setThinking] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [, setFlash] = useState(0)
  const [verdict, setVerdict] = useState<string | null>(null)

  const gen = useMemo(() => generalization(picked), [picked])
  const enough = isEnough(picked)
  const clean = isCleanEnough(picked)
  const ready = enough && clean && gen >= GOAL_REAL_ACC

  const cleanCount = picked.filter((c) => !c.mislabeled).length
  const ratio = picked.length ? cleanCount / picked.length : 0

  /* ---------------- 跑一次真实现场模拟考 ---------------- */
  const runTest = (reason: 'initial' | 'data', cards: PoolCard[] = picked) => {
    if (training) return
    setTraining(true)
    setVerdict(null)
    setResults(null)

    const THINK = ['它在看没见过的卷子……', '它在找熟悉的形状……', '它有点不确定……']
    let step = 0
    setThinking(THINK[0])
    const timer = window.setInterval(() => {
      step += 1
      setThinking(THINK[Math.min(step, THINK.length - 1)])
    }, 360)

    window.setTimeout(() => {
      window.clearInterval(timer)
      setThinking('')

      const accNow = generalization(cards)
      const out: Result[] = REAL_PROBE.map((p) => {
        const g = classify('generalized', p.truth, Math.random, accNow)
        return { truth: p.truth, guess: g.digit, correct: g.digit === p.truth }
      })

      setResults(out)
      setFlash((f) => f + 1)
      setTraining(false)

      const right = out.filter((r) => r.correct).length
      track('train_run', {
        reason,
        chapter: 'ch4',
        picked: cards.length,
        cleanRatio: cards.length
          ? Math.round((cards.filter((c) => !c.mislabeled).length / cards.length) * 100) / 100
          : 0,
        realAcc: Math.round((right / out.length) * 100) / 100,
      })

      if (reason === 'initial') {
        setVerdict(
          '一张没喂，它只能瞎猜。这些都是它没见过的写法 —— 这就是"真实现场"。'
        )
      } else if (!isCleanEnough(cards)) {
        setVerdict(
          `你喂了 ${cards.length} 张，但里面有 ${cards.length - cards.filter((c) => !c.mislabeled).length} 张标错的 —— ` +
            '喂得越多，它被带偏得越狠。和第 3 章一样的问题。'
        )
      } else if (!isEnough(cards)) {
        setVerdict('干净是够干净了，但见得还太少。再多喂几张。')
      } else {
        setVerdict(
          accNow >= GOAL_REAL_ACC
            ? '没见过的手写体它也认得了 —— 这才是真的学会了。'
            : '差不多了，但还差一点。再看看清单上有没有没喂过的写法。'
        )
      }
    }, 1800)
  }

  /* 进关卡先考一次 */
  const ranOnce = useRef(false)
  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true
    runTest('initial', [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 挑 / 取消一张卡 */
  function toggle(c: PoolCard) {
    if (training) return
    const has = picked.some((x) => x.id === c.id)
    let next: PoolCard[]
    if (has) {
      next = picked.filter((x) => x.id !== c.id)
    } else {
      next = [...picked, c]
      onFeed(c.digit)
      track('sample_add', {
        chapter: 'ch4',
        digit: c.digit,
        look: c.look,
        mislabeled: c.mislabeled,
      })
    }
    setPickedLocal(next)
    onPickedChange(next)
    window.setTimeout(() => runTest('data', next), 120)
  }

  /** 一键全喂 —— 快，但把标错的一起喂了 */
  function feedAll() {
    if (training) return
    const next = [...POOL]
    setPickedLocal(next)
    onPickedChange(next)
    next.forEach((c) => onFeed(c.digit))
    track('sample_add', { chapter: 'ch4', bulk: true, count: next.length })
    window.setTimeout(() => runTest('data', next), 120)
  }

  function reset() {
    if (training) return
    setPickedLocal([])
    onPickedChange([])
    setResults(null)
    setVerdict(null)
    window.setTimeout(() => runTest('initial', []), 100)
  }

  /* ---------------- 情绪 ---------------- */
  const mastered = results != null && !training && results.every((r) => r.correct)

  const [celebrate, setCelebrate] = useState(0)
  const wasMastered = useRef(false)
  useEffect(() => {
    if (mastered && !wasMastered.current) setCelebrate((c) => c + 1)
    wasMastered.current = mastered
  }, [mastered])

  const displayMood: Mood = training ? 'confused' : mastered ? 'happy' : (petMood ?? 'idle')
  const pokeLines = mastered ? CH4.pokeProud : CH4.poke
  const statusText = training
    ? thinking
    : results
      ? mastered
        ? '真实现场我也能认！'
        : gen >= 0.6
          ? '它认出了一部分'
          : '它基本在瞎猜'
      : '它准备好了'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-3xl border border-[#12201e]/8 bg-white p-6 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
        <div className="flex flex-wrap items-start justify-center gap-8">
          <PokePet
            body={petBody}
            mood={displayMood}
            size={168}
            lines={pokeLines}
            pokeMood={mastered ? 'proud' : 'idle'}
            disabled={training}
            cheering={mastered}
            celebrate={celebrate}
            statusText={statusText}
          />

          {/* 真实现场成绩单 */}
          <div className="min-w-[320px] flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#12201e]/60">
                真实现场（10 道没见过的题）
              </span>
              {results && (
                <span className="text-[11px]">
                  认对了：
                  <b
                    className="font-mono"
                    style={{ color: gen >= GOAL_REAL_ACC ? '#00a86b' : '#e4542f' }}
                  >
                    {results.filter((r) => r.correct).length} / {results.length}
                  </b>
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(results ?? Array.from({ length: REAL_PROBE.length }, () => null)).map((r, i) => {
                if (!r) {
                  return (
                    <div
                      key={i}
                      className="grid h-[68px] place-items-center rounded-2xl border border-dashed border-[#12201e]/10 bg-[#f7f6f2] text-[10px] text-[#12201e]/25"
                      style={{
                        animation: training
                          ? `pet-bob 1.1s ease-in-out infinite ${i * 90}ms`
                          : undefined,
                      }}
                    >
                      {training ? '…' : '?'}
                    </div>
                  )
                }
                return (
                  <div
                    key={i}
                    className="grid h-[68px] place-items-center rounded-2xl border"
                    style={{
                      borderColor: r.correct ? 'rgba(0,168,107,0.4)' : 'rgba(228,84,47,0.4)',
                      background: r.correct ? 'rgba(0,168,107,0.06)' : 'rgba(228,84,47,0.06)',
                      animation: `pet-bubble-in 320ms cubic-bezier(0.22,1,0.36,1) ${i * 60}ms both`,
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <MessyDigit
                        value={r.truth}
                        handwritten
                        kind={i % 2 === 0 ? 'tilt' : 'thin'}
                        seed={`real-${i}`}
                        size={22}
                      />
                      <span
                        className="font-mono text-[10px] font-bold"
                        style={{ color: r.correct ? '#00a86b' : '#e4542f' }}
                      >
                        {r.correct ? `✓${r.guess}` : `✗${r.guess}`}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 泛化能力条 */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-[#12201e]/55">泛化能力</span>
                <span
                  className="font-mono font-bold"
                  style={{ color: gen >= GOAL_REAL_ACC ? '#00a86b' : '#ff6b35' }}
                >
                  {Math.round(gen * 100)}%
                </span>
              </div>
              <span className="block h-2.5 overflow-hidden rounded-full bg-[#12201e]/8">
                <span
                  className="block h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.round(gen * 100)}%`,
                    background: gen >= GOAL_REAL_ACC ? '#00a86b' : '#ff6b35',
                  }}
                />
              </span>
              <div className="mt-1 text-[10px] text-[#12201e]/40">
                过关线 {Math.round(GOAL_REAL_ACC * 100)}% —— 它要能认没见过的写法
              </div>
            </div>

            {verdict && (
              <div className="mt-3 rounded-2xl bg-[#f7f6f2] px-4 py-3 text-[11px] leading-6 text-[#12201e]/65">
                {verdict}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- 数据清单 ---------------- */}
        <div className="mt-6 border-t border-[#12201e]/8 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-[#12201e]">
              ① 挑数据 · 你决定喂它哪些（清单里有标错的）
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={training}
                onClick={feedAll}
                className="rounded-full border border-[#e4542f]/40 bg-[#fff3f0] px-3.5 py-1.5 text-[11px] font-semibold text-[#b73b21] transition hover:-translate-y-0.5 disabled:opacity-40"
                title="快，但会把标错的样本一起喂进去"
              >
                ⚡ 全都喂给它（{POOL.length} 张）
              </button>
              <button
                type="button"
                disabled={training || picked.length === 0}
                onClick={reset}
                className="rounded-full border border-[#12201e]/12 bg-white px-3.5 py-1.5 text-[11px] text-[#12201e]/55 transition disabled:opacity-40"
              >
                重挑
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5 lg:grid-cols-10">
            {POOL.map((c) => {
              const on = picked.some((x) => x.id === c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={training}
                  onClick={() => toggle(c)}
                  data-probe="pool-card"
                  data-card={c.id}
                  data-mislabeled={c.mislabeled ? '1' : '0'}
                  data-picked={on ? '1' : '0'}
                  className="flex flex-col items-center gap-1 rounded-2xl border p-2 transition hover:-translate-y-0.5 disabled:opacity-50"
                  style={{
                    borderColor: on
                      ? c.mislabeled
                        ? 'rgba(228,84,47,0.6)'
                        : 'rgba(0,168,107,0.5)'
                      : c.mislabeled
                        ? 'rgba(228,84,47,0.35)'
                        : 'rgba(18,32,30,0.1)',
                    background: on
                      ? c.mislabeled
                        ? 'rgba(228,84,47,0.1)'
                        : 'rgba(0,168,107,0.07)'
                      : c.mislabeled
                        ? 'rgba(228,84,47,0.04)'
                        : 'white',
                  }}
                >
                  <MessyDigit
                    value={c.digit}
                    kind={c.look === 'neat' ? undefined : c.look === 'messy' ? 'thin' : 'tilt'}
                    seed={c.id}
                    size={22}
                  />
                  <span className="font-mono text-[9px] text-[#12201e]/45">{c.digit}</span>
                  {c.mislabeled && (
                    <span className="rounded-full bg-[#e4542f] px-1.5 py-0.5 text-[8px] font-bold text-white">
                      标签错
                    </span>
                  )}
                  <span className="text-[8px] text-[#12201e]/35">{LOOK_LABEL[c.look]}</span>
                </button>
              )
            })}
          </div>

          {/* 已挑进度 */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat
              label="已喂样本"
              value={`${picked.length} / ${FINAL_GOAL}`}
              ok={enough}
              hint={enough ? '见够了' : '还不够'}
            />
            <Stat
              label="干净占比"
              value={picked.length ? `${Math.round(ratio * 100)}%` : '—'}
              ok={clean}
              hint={`要求 ≥${Math.round(MIN_CLEAN_RATIO * 100)}%（最多 ${Math.floor(
                FINAL_GOAL * (1 - MIN_CLEAN_RATIO)
              )} 张标错的）`}
            />
            <Stat
              label="标错的"
              value={`${picked.length - cleanCount} 张`}
              ok={picked.length - cleanCount <= Math.floor(FINAL_GOAL * (1 - MIN_CLEAN_RATIO))}
              hint="喂进去只会带偏它"
            />
          </div>

          {ready && (
            <div className="mt-4 rounded-2xl border border-[#00a86b]/35 bg-[#e9f9f1] px-5 py-4 text-xs leading-6 text-[#12201e]/70">
              数据和写法都够了 —— <b>泛化能力过关</b>。可以带它去打真实现场了。
            </div>
          )}
        </div>

        {/* ---------------- 自己写一个 ---------------- */}
        <div className="mt-6 border-t border-[#12201e]/8 pt-5">
          <div className="mb-3 text-xs font-bold text-[#12201e]">
            ② 最后再写一个给它 · 看它能不能认出你的字
          </div>
          <SelfTest gen={gen} />
        </div>
      </div>

      {/* ---------------- 右栏 ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-[#12201e]/8 bg-white p-5 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-[#12201e]/38">
            这一路它学会了什么
          </div>
          <ul className="flex flex-col gap-2 text-[11px] leading-5 text-[#12201e]/60">
            <li>· 第 0 章：样本不够，它什么都不认识</li>
            <li>· 第 1 章：某一类太少，它会偏食</li>
            <li>· 第 2 章：只见一种写法，它就会背题</li>
            <li>· 第 3 章：标签标错了，它学得越认真错得越狠</li>
            <li className="text-[#ff6b35]">· 第 4 章：这些加在一起，决定它能不能应付真实现场</li>
          </ul>
        </div>

        <div className="rounded-3xl border border-[#12201e]/8 bg-[#101917] p-5 text-white">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/45">提示</div>
          <p className="mt-3 text-[11px] leading-6 text-white/60">
            清单上那些
            <b className="text-[#ff8a65]">红标签</b>
            的样本，图里画的和标签写的
            <b className="text-[#d7ff68]">不是同一个数字</b>。
            <br />
            "全都喂给它"最快 —— 但偷懒的代价会在真实现场里显出来。
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   一个小进度项
   ------------------------------------------------------------------------ */
function Stat({
  label,
  value,
  ok,
  hint,
}: {
  label: string
  value: string
  ok: boolean
  hint: string
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: ok ? 'rgba(0,168,107,0.35)' : 'rgba(18,32,30,0.1)',
        background: ok ? 'rgba(0,168,107,0.05)' : '#f7f6f2',
      }}
    >
      <div className="text-[10px] text-[#12201e]/45">{label}</div>
      <div
        className="mt-1 font-mono text-sm font-bold"
        style={{ color: ok ? '#00a86b' : '#12201e' }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[9px] text-[#12201e]/35">{hint}</div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   最后一道：用户自己写，看它认不认
   ------------------------------------------------------------------------ */
function SelfTest({ gen }: { gen: number }) {
  const [pickedNum, setPickedNum] = useState(7)
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([])
  const [answer, setAnswer] = useState<{ guess: number; correct: boolean } | null>(null)
  const drawing = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const toLocal = (e: React.PointerEvent) => {
    const box = boxRef.current
    if (!box) return null
    const r = box.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  const down = (e: React.PointerEvent) => {
    const p = toLocal(e)
    if (!p) return
    drawing.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setStrokes((s) => [...s, [p]])
    setAnswer(null)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = toLocal(e)
    if (!p) return
    setStrokes((s) => {
      if (!s.length) return s
      const next = s.slice()
      next[next.length - 1] = [...next[next.length - 1], p]
      return next
    })
  }
  const up = () => {
    drawing.current = false
  }

  const hasInk = strokes.some((s) => s.length > 1)

  const check = () => {
    if (!hasInk) return
    const right = Math.random() < gen
    setAnswer({ guess: right ? pickedNum : (pickedNum + 3) % 10, correct: right })
  }

  const paths = strokes.map((s) =>
    s.length ? `M ${s.map((p) => `${(p.x * 100).toFixed(1)},${(p.y * 100).toFixed(1)}`).join(' L ')}` : ''
  )

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div>
        <div
          ref={boxRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="relative touch-none rounded-2xl border-2 border-dashed bg-[#fbfaf7]"
          style={{
            width: 150,
            height: 150,
            borderColor: hasInk ? 'rgba(255,107,53,0.5)' : 'rgba(18,32,30,0.16)',
            cursor: 'crosshair',
          }}
        >
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 size-full"
            preserveAspectRatio="none"
          >
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#12201e"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          {!hasInk && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] text-[#12201e]/25">
              在这里写
            </span>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setStrokes([])
              setAnswer(null)
            }}
            disabled={!hasInk}
            className="rounded-full border border-[#12201e]/12 bg-white px-3 py-1.5 text-[11px] text-[#12201e]/55 transition disabled:opacity-40"
          >
            重写
          </button>
          <button
            type="button"
            onClick={check}
            disabled={!hasInk}
            className="rounded-full bg-[#ff6b35] px-4 py-1.5 text-[11px] font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-40"
          >
            看它认不认
          </button>
        </div>
      </div>

      <div className="min-w-[180px] flex-1">
        <div className="mb-2 text-[11px] font-semibold text-[#12201e]/50">我写的是：</div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setPickedNum(d)
                setAnswer(null)
              }}
              className="grid size-8 place-items-center rounded-xl border text-[13px] font-semibold transition"
              style={{
                borderColor: pickedNum === d ? '#ff6b35' : 'rgba(18,32,30,0.12)',
                background: pickedNum === d ? 'rgba(255,107,53,0.1)' : 'white',
                color: pickedNum === d ? '#ff6b35' : '#12201e',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {answer && (
          <div
            className="mt-3 rounded-2xl border px-3.5 py-2.5 text-[11px] leading-5"
            style={{
              borderColor: answer.correct ? 'rgba(0,168,107,0.45)' : 'rgba(228,84,47,0.45)',
              background: answer.correct ? 'rgba(0,168,107,0.06)' : 'rgba(228,84,47,0.06)',
            }}
          >
            {answer.correct ? (
              <span className="text-[#00a86b]">
                ✅ 它认出来了 —— 你写的 {DIGIT_CN[pickedNum]} 它认识
              </span>
            ) : (
              <span className="text-[#e4542f]">
                ❌ 它认成了 {answer.guess}（{DIGIT_CN[answer.guess]}）
              </span>
            )}
          </div>
        )}

        <p className="mt-3 text-[10px] leading-5 text-[#12201e]/40">
          先在画板上写一个 <b className="text-[#12201e]/60">{pickedNum}</b>，再点"看它认不认"。
          <br />
          泛化能力越高，它认对你手写的概率越大（现在 {Math.round(gen * 100)}%）。
        </p>
      </div>
    </div>
  )
}
