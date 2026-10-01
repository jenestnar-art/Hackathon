/* =============================================================================
   OverfitGame.tsx —— 第 2 章核心玩法：过拟合
   ---------------------------------------------------------------------------
   玩法核心（这一章最好玩的地方）：
     它在【自己那套原题】上几乎满分，但换成【手写/歪着写】就认不出了。
     你可以自己拿笔写一个 7 —— 然后看它当面不认。

   三个动作：
     ① 从"变形训练营"里点一个变形样本喂给它  → 它学会一种新写法
     ② 自己在画板上写一个数字               → 看它认不认
     ③ 喂够了就打 BOSS（歪七扭八，全是手写体）

   判定规则全部来自 overfitRules.ts（唯一来源），
   成绩单和 BOSS 战调同一个 accuracyFor()。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import { PokePet } from '@/features/ai/components/PokePet'
import { MessyDigit } from '@/features/ai/components/MessyDigit'
import { DrawingCanvas } from '@/features/ai/components/DrawingCanvas'
import { DIGIT_CN } from '@/features/ai/components/Digit'
import { CH2 } from '@/features/ai/data/petLines'
import { track } from '@/features/ai/lib/track'
import { pushVariant } from '@/features/ai/games/overfitRules'
import { classify } from '@/features/ai/lib/modelBrain'
import {
  WATCH,
  NEED_PER_DIGIT,
  OVERFIT_GOAL,
  GOAL_MESSY_ACC,
  PROBE,
  variantsFor,
  seenVariants,
  isFixed,
  kindLabel,
  type Variant,
} from '@/features/ai/games/overfitRules'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface OverfitGameProps {
  /** 已经喂进几个变形样本（父组件也记一份，这里以本地为准） */
  fed: number
  goal: number
  onFeed: () => void
  petBody: BodyKind
  petMood?: Mood
}

interface Result {
  truth: number
  messy: boolean
  guess: number
  correct: boolean
  /** 自己手写的那张要特别标出来 */
  mine?: boolean
}

export function OverfitGame({ onFeed, petBody, petMood }: OverfitGameProps) {
  /** 已经喂进去的变形样本 */
  const [fedVariants, setFedVariants] = useState<Variant[]>([])
  const [training, setTraining] = useState(false)
  const [thinking, setThinking] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [, setFlash] = useState(0)
  const [verdict, setVerdict] = useState<string | null>(null)

  /** 自己手写的那次判定 */
  const [mine, setMine] = useState<{ truth: number; guess: number; correct: boolean } | null>(null)

  const counts = useMemo(() => {
    const c: Record<number, number> = {}
    for (const d of WATCH) c[d] = seenVariants(fedVariants, d)
    return c
  }, [fedVariants])

  const fixedEnough = isFixed(fedVariants)
  const fedCount = fedVariants.length

  /* ---------------- 跑一次考试 ---------------- */
  const runTest = (reason: 'initial' | 'data' | 'mine', extra?: Variant[], mineSample?: number) => {
    if (training) return
    setTraining(true)
    setVerdict(null)
    setResults(null)
    setMine(null)

    const pool = extra ?? fedVariants

    let step = 0
    const THINK = ['它在翻它背过的那些题……', '它在比对形状……', '它有点犹豫……']
    setThinking(THINK[0])
    const timer = window.setInterval(() => {
      step += 1
      setThinking(THINK[Math.min(step, THINK.length - 1)])
    }, 360)

    window.setTimeout(() => {
      window.clearInterval(timer)
      setThinking('')

      const out: Result[] = PROBE.map((p) => {
        const acc = accuracyOf(p.truth, p.messy, pool)
        const g = classify('overfit', p.truth, Math.random, acc)
        return { truth: p.truth, messy: p.messy, guess: g.digit, correct: g.digit === p.truth }
      })

      /* 如果这次是手写考卷，额外塞一张"你写的"进去 */
      if (mineSample != null) {
        const acc = accuracyOf(mineSample, true, pool)
        const g = classify('overfit', mineSample, Math.random, acc)
        out.push({
          truth: mineSample,
          messy: true,
          guess: g.digit,
          correct: g.digit === mineSample,
          mine: true,
        })
        setMine({ truth: mineSample, guess: g.digit, correct: g.digit === mineSample })
      }

      setResults(out)
      setFlash((f) => f + 1)
      setTraining(false)

      const messyResults = out.filter((r) => r.messy && !r.mine)
      const right = messyResults.filter((r) => r.correct).length
      const acc2 = messyResults.length ? right / messyResults.length : 0

      track('train_run', {
        reason,
        chapter: 'ch2',
        messyAcc: Math.round(acc2 * 100) / 100,
        fedVariants: pool.length,
      })

      if (reason === 'initial') {
        setVerdict('工整的 4 道全对，歪着写的 4 道全错 —— 它只背下了那一种写法。')
      } else if (reason === 'mine') {
        setVerdict(
          mineSample == null
            ? ''
            : out[out.length - 1]?.correct
              ? `它认出来了！你写的是 ${mineSample}。`
              : `它把你写的 ${mineSample} 认成了 ${out[out.length - 1]?.guess}。`
        )
      } else {
        setVerdict(
          acc2 >= GOAL_MESSY_ACC
            ? '各种写法它都认了 —— 这才叫"认数字"，不是"背图片"。'
            : '好了一些，但还有写法它没见过。再喂几个。'
        )
      }
    }, 1800)
  }

  /** 用统一规则算正确率 */
  function accuracyOf(truth: number, messy: boolean, pool: Variant[]): number {
    if (!messy) return 1
    if (!WATCH.includes(truth)) return 0.94
    const n = seenVariants(pool, truth)
    if (n >= NEED_PER_DIGIT) return 1
    return n === 1 ? 0.3 : 0.06
  }

  /* 进关卡先考一次，制造"翻车现场" */
  const ranOnce = useRef(false)
  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true
    runTest('initial', [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * ★ SKIP：把各种写法一次喂完。
   * 走的还是 feedVariant，只是不用人一个个点 —— 副作用一个不少。
   * 每个之间留 320ms：喂一个会触发一次自动考试，别把它们叠在一起。
   */
  function fillAllVariants() {
    const missing: Variant[] = []
    for (const d of WATCH) {
      const have = fedVariants.filter((x) => x.digit === d).map((x) => x.id)
      for (const v of variantsFor(d)) {
        if (!have.includes(v.id) && missing.length < OVERFIT_GOAL - fedCount) missing.push(v)
      }
    }
    missing.forEach((v, i) => window.setTimeout(() => feedVariant(v), i * 320 + 30))
  }

  /** 喂一个变形样本：本地立刻更新，再用新数据重考 */
  function feedVariant(v: Variant) {    if (fedVariants.some((x) => x.id === v.id)) return
    const next = [...fedVariants, v]
    setFedVariants(next)
    /* ★ 同步进共享记录 —— BOSS 战从这里读。
       不同步的话会出现「成绩单全对，BOSS 却打不过」的脱钩。 */
    pushVariant('ch2', v)
    onFeed()
    track('sample_add', { chapter: 'ch2', digit: v.digit, variant: v.id })
    window.setTimeout(() => runTest('data', next), 120)
  }

  /** 画板上交卷 */
  function submitDrawing(digit: number) {
    track('write_sample', { chapter: 'ch2', digit })
    runTest('mine', fedVariants, digit)
  }

  /* ---------------- 它的情绪 ---------------- */
  const mastered = results != null && !training && results.every((r) => r.correct)

  const [celebrate, setCelebrate] = useState(0)
  const wasMastered = useRef(false)
  useEffect(() => {
    if (mastered && !wasMastered.current) setCelebrate((c) => c + 1)
    wasMastered.current = mastered
  }, [mastered])

  const displayMood: Mood = training ? 'confused' : mastered ? 'happy' : (petMood ?? 'dead')

  const pokeLines = mastered ? CH2.pokeProud : CH2.poke
  const statusText = training
    ? thinking
    : results
      ? mastered
        ? '什么写法我都认得了！'
        : results.every((r) => !r.correct && !r.mine)
          ? '它一个都没认出来'
          : '它只认得它背过的那种写法'
      : '它觉得自己什么都会'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* ---------------- 左：宠物 + 成绩单 ---------------- */}
      <div className="rounded-3xl border border-[#12201e]/8 bg-white p-6 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
        <div className="flex flex-wrap items-start justify-center gap-8">
          <PokePet
            body={petBody}
            mood={displayMood}
            size={168}
            lines={pokeLines}
            pokeMood={mastered ? 'proud' : 'confused'}
            disabled={training}
            cheering={mastered}
            celebrate={celebrate}
            statusText={statusText}
          />

          {/* 成绩单 */}
          <div className="min-w-[320px] flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#12201e]/60">
                它的成绩单（{PROBE.length + (mine ? 1 : 0)} 道题）
              </span>
              {results && (
                <span className="text-[11px]">
                  歪着写的：
                  <b
                    className="font-mono"
                    style={{
                      color:
                        messyRatio(results) >= GOAL_MESSY_ACC ? '#00a86b' : '#e4542f',
                    }}
                  >
                    {Math.round(messyRatio(results) * 100)}%
                  </b>
                </span>
              )}
            </div>

            {/* 分两组：原题 / 变形 */}
            <div className="flex flex-col gap-3">
              <ScoreRow
                title="原题（它背下来的那一种）"
                tone="neat"
                items={results ? results.filter((r) => !r.messy) : null}
                count={PROBE.filter((p) => !p.messy).length}
                training={training}
              />
              <ScoreRow
                title="变形（换了个写法）"
                tone="messy"
                items={results ? results.filter((r) => r.messy) : null}
                count={PROBE.filter((p) => p.messy).length}
                training={training}
              />
            </div>

            {/* 你写的那张的判定结果 */}
            {mine && (
              <div
                className="mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3"
                style={{
                  borderColor: mine.correct ? 'rgba(0,168,107,0.45)' : 'rgba(228,84,47,0.45)',
                  background: mine.correct ? 'rgba(0,168,107,0.06)' : 'rgba(228,84,47,0.06)',
                }}
              >
                <MessyDigit value={mine.truth} handwritten seed="mine" size={30} />
                <div className="text-[11px] leading-5">
                  <b>这是你写的 {DIGIT_CN[mine.truth]}</b>
                  <br />
                  {mine.correct ? (
                    <span className="text-[#00a86b]">它认出来了 ✅</span>
                  ) : (
                    <span className="text-[#e4542f]">
                      它认成了 {DIGIT_CN[mine.guess]}（{mine.guess}）❌
                    </span>
                  )}
                </div>
              </div>
            )}

            {verdict && (
              <div className="mt-3 rounded-2xl bg-[#f7f6f2] px-4 py-3 text-[11px] leading-6 text-[#12201e]/65">
                {verdict}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- 变形训练营 ---------------- */}
        <div className="mt-6 border-t border-[#12201e]/8 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#12201e]">
              ① 变形训练营 · 让它见见同一个数字的别的写法
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-[#12201e]/40">
                已喂 {fedCount} / {OVERFIT_GOAL}
              </span>
              {/* ★ SKIP：一次喂完所有写法。
                  玩家看懂"要让它见各种写法"之后，剩下 6 次点击不产生新信息。 */}
              {!fixedEnough && (
                <button
                  type="button"
                  disabled={training}
                  onClick={fillAllVariants}
                  data-probe="variant-all"
                  title="不用一个个点，把各种写法一次喂完"
                  className="rounded-full border border-[#ff6b35]/35 bg-white px-3.5 py-1.5 text-[11px] font-medium text-[#b73b21] transition hover:-translate-y-0.5 disabled:opacity-40"
                >
                  ⏭ 一次喂完（还差 {OVERFIT_GOAL - fedCount} 个）
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {WATCH.map((d) => {
              const variants = variantsFor(d)
              const have = counts[d]
              return (
                <div
                  key={d}
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor: have >= NEED_PER_DIGIT ? 'rgba(0,168,107,0.4)' : 'rgba(255,107,53,0.3)',
                    background: have >= NEED_PER_DIGIT ? 'rgba(0,168,107,0.05)' : 'rgba(255,107,53,0.05)',
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <MessyDigit value={d} size={22} />
                    <span className="text-[10px] text-[#12201e]/45">
                      {have >= NEED_PER_DIGIT ? '见过各种写法了' : `还差 ${NEED_PER_DIGIT - have} 种写法`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {variants.map((v) => {
                      const used = fedVariants.some((x) => x.id === v.id)
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={used || training}
                          onClick={() => feedVariant(v)}
                          title={`喂它一个"${kindLabel(v.kind)}"的 ${d}`}
                          data-probe="variant"
                          data-variant={v.id}
                          data-used={used ? '1' : '0'}
                          className="flex flex-col items-center gap-1 rounded-xl border border-[#12201e]/10 bg-white px-2.5 py-2 transition hover:-translate-y-0.5 disabled:opacity-35 disabled:hover:translate-y-0"
                        >
                          <MessyDigit value={d} kind={v.kind} seed={v.id} size={26} />
                          <span className="text-[9px] text-[#12201e]/45">
                            {used ? '已喂' : kindLabel(v.kind)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------------- 自己写一个 ---------------- */}
        <div className="mt-6 border-t border-[#12201e]/8 pt-5">
          <div className="mb-3 text-xs font-bold text-[#12201e]">
            ② 自己写一个 · 看它认不认你的字
          </div>
          <DrawingCanvas
            digits={WATCH}
            disabled={training}
            onSubmit={submitDrawing}
            result={
              mine
                ? { truth: mine.truth, guess: mine.guess, correct: mine.correct }
                : null
            }
          />
        </div>

        {fixedEnough && (
          <div className="mt-5 rounded-2xl border border-[#00a86b]/35 bg-[#e9f9f1] px-5 py-4 text-xs leading-6 text-[#12201e]/70">
            各种写法它都见过了 —— <b>成绩单已经全对</b>。可以带它去打 BOSS 了。
          </div>
        )}
      </div>

      {/* ---------------- 右：它背过什么 + 提示 ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-[#12201e]/8 bg-white p-5 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-[#12201e]/38">
            它背过的题（只有这一种写法）
          </div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <span
                key={d}
                className="grid size-9 place-items-center rounded-xl border"
                style={{
                  borderColor: WATCH.includes(d) ? 'rgba(228,84,47,0.35)' : 'rgba(18,32,30,0.1)',
                  background: WATCH.includes(d) ? 'rgba(228,84,47,0.05)' : 'transparent',
                }}
              >
                <MessyDigit value={d} size={18} />
              </span>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-[#12201e]/40">
            它把这十张图<span className="font-semibold text-[#e4542f]">背下来了</span>，
            不是学会了数字。所以换个写法它就懵。
          </p>
        </div>

        <div className="rounded-3xl border border-[#12201e]/8 bg-[#101917] p-5 text-white">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/45">提示</div>
          <p className="mt-3 text-[11px] leading-6 text-white/60">
            它在自己那套原题上几乎
            <b className="text-[#d7ff68]">满分</b>，但换成手写体就崩了。
            <br />
            这种"只认原题"的毛病，叫
            <b className="text-[#d7ff68]"> 过拟合 </b>。
          </p>
        </div>
      </div>
    </div>
  )
}

/** 歪着写的那几道的正确率 */
function messyRatio(results: Result[]): number {
  const messy = results.filter((r) => r.messy && !r.mine)
  if (!messy.length) return 0
  return messy.filter((r) => r.correct).length / messy.length
}

/* ---------------------------------------------------------------------------
   成绩单的一行（原题 / 变形）
   ------------------------------------------------------------------------ */
function ScoreRow({
  title,
  tone,
  items,
  count,
  training,
}: {
  title: string
  tone: 'neat' | 'messy'
  items: Result[] | null
  count: number
  training: boolean
}) {
  const accent = tone === 'neat' ? '#00a86b' : '#e4542f'
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-[10px] font-semibold text-[#12201e]/50">{title}</span>
      </div>
      <div className="flex gap-2.5">
        {(items ?? Array.from({ length: count }, () => null)).map((r, i) => {
          if (!r) {
            return (
              <div
                key={i}
                className="grid h-[74px] w-[74px] place-items-center rounded-2xl border border-dashed border-[#12201e]/10 bg-[#f7f6f2] text-[10px] text-[#12201e]/25"
                style={{
                  animation: training ? `pet-bob 1.1s ease-in-out infinite ${i * 90}ms` : undefined,
                }}
              >
                {training ? '…' : '?'}
              </div>
            )
          }
          return (
            <div
              key={i}
              className="grid h-[74px] w-[74px] place-items-center rounded-2xl border"
              style={{
                borderColor: r.correct ? 'rgba(0,168,107,0.4)' : 'rgba(228,84,47,0.4)',
                background: r.correct ? 'rgba(0,168,107,0.06)' : 'rgba(228,84,47,0.06)',
                animation: `pet-bubble-in 320ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms both`,
              }}
            >
              <div className="flex flex-col items-center gap-0.5">
                <MessyDigit
                  value={r.truth}
                  handwritten={r.messy}
                  kind={r.messy ? 'tilt' : undefined}
                  seed={`probe-${i}`}
                  size={24}
                />
                <span
                  className="font-mono text-[10px] font-bold"
                  style={{ color: r.correct ? '#00a86b' : '#e4542f' }}
                >
                  {r.correct ? `✓${r.guess}` : `✗答${r.guess}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
