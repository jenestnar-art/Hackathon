/* =============================================================================
   DetectiveGame.tsx —— 第 3 章玩法：抓内鬼
   ---------------------------------------------------------------------------
   玩法：
     盘上摆着 12 张样本。每张都写着【标签】，但标签不一定是真的。
     点开一张 → 看到图形 + 标签 + 模型对它的判断。
     你要找出【图与标签对不上】的那几张，把它们拉出来。

   为什么这个玩法能讲清"数据质量"：
     玩家会亲眼看到"一张画着 3 的图，标签写着 8" ——
     然后立刻明白模型为什么把 3 认成 8：
     它没毛病，是有人把答案抄错了，而它只会拼命相信答案。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import { PokePet } from '@/features/ai/components/PokePet'
import { Digit, DIGIT_CN } from '@/features/ai/components/Digit'
import { MessyDigit } from '@/features/ai/components/MessyDigit'
import { CH3 } from '@/features/ai/data/petLines'
import { track } from '@/features/ai/lib/track'
import { classify } from '@/features/ai/lib/modelBrain'
import {
  SAMPLES,
  GRID_SIZE,
  NEED_CATCH,
  POISON_TOTAL,
  PROBE,
  accuracyFor,
  modelGuess,
  type PoisonSample,
} from '@/features/ai/games/poisonRules'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface DetectiveGameProps {
  /** 玩家已经抓出几张 */
  caught: number
  onCatch: (id: string, wasPoison: boolean) => void
  petBody: BodyKind
  petMood?: Mood
}

interface Result {
  truth: number
  guess: number
  correct: boolean
}

export function DetectiveGame({ caught, onCatch, petBody, petMood }: DetectiveGameProps) {
  /** 已经拉出来的样本 id */
  const [pulled, setPulled] = useState<Set<string>>(new Set())
  /** 正在检视的那张 */
  const [focus, setFocus] = useState<PoisonSample | null>(null)
  /** 误抓好人时的提示 */
  const [wrongAccuse, setWrongAccuse] = useState<string | null>(null)

  const [training, setTraining] = useState(false)
  const [thinking, setThinking] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [, setFlash] = useState(0)
  const [verdict, setVerdict] = useState<string | null>(null)

  const cleaned = caught >= NEED_CATCH

  /* ---------------- 跑一次考试 ---------------- */
  const runTest = (reason: 'initial' | 'data', caughtNow: number = caught) => {
    if (training) return
    setTraining(true)
    setVerdict(null)
    setResults(null)

    const THINK = ['它在翻它背过的那些题……', '它在找 3 和 8 的规律……', '它有点犹豫……']
    let step = 0
    setThinking(THINK[0])
    const timer = window.setInterval(() => {
      step += 1
      setThinking(THINK[Math.min(step, THINK.length - 1)])
    }, 360)

    window.setTimeout(() => {
      window.clearInterval(timer)
      setThinking('')

      const out: Result[] = PROBE.map((p) => {
        const acc = accuracyFor(p.truth, caughtNow)
        const g = classify('poisoned', p.truth, Math.random, acc)
        return { truth: p.truth, guess: g.digit, correct: g.digit === p.truth }
      })

      setResults(out)
      setFlash((f) => f + 1)
      setTraining(false)

      const bad = out.filter((r) => r.truth === 3 || r.truth === 8)
      const badRight = bad.filter((r) => r.correct).length
      track('train_run', {
        reason,
        chapter: 'ch3',
        caught: caughtNow,
        corruptAcc: bad.length ? Math.round((badRight / bad.length) * 100) / 100 : 1,
      })

      if (reason === 'initial') {
        setVerdict(
          '3 和 8 它全认反了。普通数字倒是没问题 —— 它好像只在"3 和 8"上出毛病。'
        )
      } else {
        setVerdict(
          cleaned
            ? '清掉内鬼之后，3 和 8 立刻正常了 —— 原来错的不是它。'
            : '好一点了，但 3 和 8 还是不太对。盘上应该还有没揪出来的。'
        )
      }
    }, 1800)
  }

  /* 进关卡先考一次 */
  const ranOnce = useRef(false)
  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true
    runTest('initial', 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * ★ SKIP：一次把所有内鬼揪出来。
   * 走的还是 pull()，副作用（记数、埋点、重考）一个不少。
   * 每个之间留 240ms，别把两次自动考试叠在一起。
   */
  function catchAll() {
    if (cleaned || training) return
    const left = SAMPLES.filter((s) => s.poison && !pulled.has(s.id))
    left.forEach((s, i) => window.setTimeout(() => pull(s), i * 240 + 30))
  }

  /** 拉出一张样本 */
  function pull(s: PoisonSample) {
    if (pulled.has(s.id) || cleaned) return
    const next = new Set(pulled)
    next.add(s.id)
    setPulled(next)
    setFocus(s)
    setWrongAccuse(null)

    if (s.poison) {
      onCatch(s.id, true)
      track('sample_add', { chapter: 'ch3', caught: s.id, actual: s.actual, label: s.label })
      const after = caught + 1
      window.setTimeout(() => runTest('data', after), 140)
    } else {
      onCatch(s.id, false)
      setWrongAccuse(`${s.id}：这张没标错 —— 它画的确实是 ${DIGIT_CN[s.actual]}。`)
      track('sample_add', { chapter: 'ch3', caught: s.id, wrong: true })
    }
  }

  /* ---------------- 它的情绪 ---------------- */
  const mastered = results != null && !training && results.every((r) => r.correct)

  const [celebrate, setCelebrate] = useState(0)
  const wasMastered = useRef(false)
  useEffect(() => {
    if (mastered && !wasMastered.current) setCelebrate((c) => c + 1)
    wasMastered.current = mastered
  }, [mastered])

  const displayMood: Mood = training
    ? 'confused'
    : mastered
      ? 'happy'
      : (petMood ?? 'hurt')

  const pokeLines = mastered ? CH3.pokeProud : CH3.poke
  const statusText = training
    ? thinking
    : results
      ? mastered
        ? '我脑子清爽了！'
        : '它把 3 和 8 认反了'
      : '它身上长了斑块'

  /** 盘上还剩多少张没被拉出来 */
  const remaining = GRID_SIZE - pulled.size
  const poisonLeft = useMemo(
    () => SAMPLES.filter((s) => s.poison && !pulled.has(s.id)).length,
    [pulled]
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="rounded-3xl border border-[#12201e]/8 bg-white p-6 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
        <div className="flex flex-wrap items-start justify-center gap-8">
          <PokePet
            body={petBody}
            mood={displayMood}
            size={168}
            spots={mastered ? 0 : 5}
            lines={pokeLines}
            pokeMood={mastered ? 'proud' : 'hurt'}
            disabled={training}
            cheering={mastered}
            celebrate={celebrate}
            statusText={statusText}
          />

          {/* 成绩单 */}
          <div className="min-w-[320px] flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#12201e]/60">
                它的成绩单（8 道题）
              </span>
              {results && (
                <span className="text-[11px]">
                  3 和 8：
                  <b
                    className="font-mono"
                    style={{
                      color:
                        corruptRatio(results) >= 0.9 ? '#00a86b' : '#e4542f',
                    }}
                  >
                    {Math.round(corruptRatio(results) * 100)}%
                  </b>
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {(results ?? Array.from({ length: PROBE.length }, () => null)).map((r, i) => {
                if (!r) {
                  return (
                    <div
                      key={i}
                      className="grid h-[74px] place-items-center rounded-2xl border border-dashed border-[#12201e]/10 bg-[#f7f6f2] text-[10px] text-[#12201e]/25"
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
                const hot = r.truth === 3 || r.truth === 8
                return (
                  <div
                    key={i}
                    className="rounded-2xl border px-2 py-2 text-center"
                    style={{
                      borderColor: r.correct ? 'rgba(0,168,107,0.4)' : 'rgba(228,84,47,0.4)',
                      background: r.correct ? 'rgba(0,168,107,0.06)' : 'rgba(228,84,47,0.06)',
                      animation: `pet-bubble-in 320ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms both`,
                    }}
                  >
                    <div className="flex justify-center">
                      <Digit value={r.truth} size={24} />
                    </div>
                    <div
                      className="mt-0.5 font-mono text-[11px] font-bold"
                      style={{ color: r.correct ? '#00a86b' : '#e4542f' }}
                    >
                      {r.correct ? `✓${r.guess}` : `✗答${r.guess}`}
                    </div>
                    {hot && <div className="text-[9px] text-[#12201e]/35">重点题</div>}
                  </div>
                )
              })}
            </div>

            {wrongAccuse && (
              <div className="mt-3 rounded-2xl bg-[#f7f6f2] px-4 py-3 text-[11px] leading-6 text-[#12201e]/60">
                {wrongAccuse}
              </div>
            )}
            {verdict && (
              <div className="mt-3 rounded-2xl bg-[#f7f6f2] px-4 py-3 text-[11px] leading-6 text-[#12201e]/65">
                {verdict}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- 抓内鬼 ---------------- */}
        <div className="mt-6 border-t border-[#12201e]/8 pt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#12201e]">
              ① 抓内鬼 · 把【图和标签对不上】的样本拉出来
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-[#12201e]/40">
                已抓 {caught} / {NEED_CATCH}（盘上还剩 {poisonLeft} 张可疑）
              </span>
              {/* ★ SKIP：一次把内鬼全揪出来。
                  想自己一张张看的人可以不用它，但它不该是强制的。 */}
              {!cleaned && (
                <button
                  type="button"
                  disabled={training}
                  onClick={catchAll}
                  data-probe="catch-all"
                  title="不用一张张翻，直接把标错的都揪出来"
                  className="rounded-full border border-[#ff6b35]/35 bg-white px-3.5 py-1.5 text-[11px] font-medium text-[#b73b21] transition hover:-translate-y-0.5 disabled:opacity-40"
                >
                  ⏭ 一次全揪出来（{poisonLeft} 张）
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {SAMPLES.slice(0, GRID_SIZE).map((s) => {
              const done = pulled.has(s.id)
              const isPoisonPulled = done && s.poison
              const isWrongPulled = done && !s.poison
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={done || cleaned || training}
                  onClick={() => pull(s)}
                  /* data-* 是给自动化测试用的锚点。
                     没有它们的时候，测试只能用文字内容去猜按钮，
                     非常脆（改一个字就失效）。 */
                  data-probe="poison-card"
                  data-sample={s.id}
                  data-actual={s.actual}
                  data-label={s.label}
                  data-poison={s.poison ? '1' : '0'}
                  data-done={done ? '1' : '0'}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
                  style={{
                    borderColor: isPoisonPulled
                      ? 'rgba(228,84,47,0.55)'
                      : isWrongPulled
                        ? 'rgba(18,32,30,0.18)'
                        : 'rgba(18,32,30,0.1)',
                    background: isPoisonPulled
                      ? 'rgba(228,84,47,0.08)'
                      : done
                        ? 'rgba(18,32,30,0.03)'
                        : 'white',
                    opacity: done ? 0.75 : 1,
                  }}
                >
                  {/* 图 */}
                  <Digit value={s.actual} size={26} />
                  {/* 标签 */}
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
                    style={{
                      background: isPoisonPulled ? '#e4542f' : 'rgba(18,32,30,0.07)',
                      color: isPoisonPulled ? '#fff' : 'rgba(18,32,30,0.6)',
                    }}
                  >
                    标签 {s.label}
                  </span>
                  {isPoisonPulled && <span className="text-[9px] text-[#e4542f]">已揪出</span>}
                  {isWrongPulled && <span className="text-[9px] text-[#12201e]/35">没标错</span>}
                </button>
              )
            })}
          </div>

          {/* 检视面板 */}
          {focus && (
            <div
              className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl border px-4 py-3.5"
              style={{
                borderColor: focus.poison ? 'rgba(228,84,47,0.45)' : 'rgba(18,32,30,0.12)',
                background: focus.poison ? 'rgba(228,84,47,0.05)' : '#f7f6f2',
              }}
            >
              <div className="flex items-center gap-3">
                <Digit value={focus.actual} size={30} />
                <div className="text-[11px] leading-5">
                  <div>
                    图里画的是 <b>{DIGIT_CN[focus.actual]}（{focus.actual}）</b>
                  </div>
                  <div className="text-[#12201e]/55">标签写的是 {focus.label}</div>
                </div>
                <span className="text-lg text-[#12201e]/25">→</span>
                <div className="text-[11px] leading-5">
                  <div>模型认出的是</div>
                  <div className="font-mono font-bold">
                    {modelGuess(focus, caught)}
                    {modelGuess(focus, caught) === focus.actual ? ' ✅' : ' ❌'}
                  </div>
                </div>
              </div>

              {focus.poison ? (
                <p className="flex-1 text-[11px] leading-6 text-[#b73b21]">
                  它把「{focus.actual}」认成了「{modelGuess(focus, caught)}」——
                  因为标签就写着 {focus.label}。它不知道标签会错，它只会拼命相信答案。
                </p>
              ) : (
                <p className="flex-1 text-[11px] leading-6 text-[#12201e]/55">
                  这张图和标签是一致的，是干净样本。
                </p>
              )}
            </div>
          )}

          {cleaned && (
            <div className="mt-4 rounded-2xl border border-[#00a86b]/35 bg-[#e9f9f1] px-5 py-4 text-xs leading-6 text-[#12201e]/70">
              内鬼清完了 —— <b>成绩单已经全对</b>。它身上那几块斑也退了。
              <br />
              <span className="text-[#12201e]/50">
                （这一章你总共拉出来 {pulled.size} 张，其中标错的 {caught} 张）
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- 右栏 ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-[#12201e]/8 bg-white p-5 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-[#12201e]/38">
            这一章的数据集（{SAMPLES.length} 张）
          </div>
          <div className="flex flex-col gap-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#12201e]/55">干净样本</span>
              <span className="font-mono">{SAMPLES.length - POISON_TOTAL}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#e4542f]">标签标错的</span>
              <span className="font-mono text-[#e4542f]">{POISON_TOTAL}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#12201e]/8 pt-2">
              <span className="text-[#12201e]/55">还没揪出来</span>
              <span className="font-mono">{poisonLeft}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#12201e]/55">盘上没检视过</span>
              <span className="font-mono">{remaining}</span>
            </div>
          </div>
          <p className="mt-3 text-[10px] leading-5 text-[#12201e]/40">
            提示：点开一张，对比<span className="font-semibold">「图里画的」</span>和
            <span className="font-semibold">「标签写的」</span>。不一样的，就是内鬼。
          </p>
        </div>

        <div className="rounded-3xl border border-[#12201e]/8 bg-[#101917] p-5 text-white">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/45">提示</div>
          <p className="mt-3 text-[11px] leading-6 text-white/60">
            模型不会怀疑标签。你把答案抄错了，它就会
            <b className="text-[#d7ff68]">认认真真地学错</b>。
            <br />
            这一章的关键词是
            <b className="text-[#d7ff68]"> 数据质量 </b>。
          </p>
        </div>

        {/* 看一眼它现在的样子 */}
        <div className="rounded-3xl border border-[#12201e]/8 bg-white p-5 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-[#12201e]/38">
            它现在的状态
          </div>
          <div className="flex items-center gap-3">
            <MessyDigit value={3} size={26} />
            <span className="text-[11px] text-[#12201e]/55">→ 它答</span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: cleaned ? '#00a86b' : '#e4542f' }}
            >
              {accuracyFor(3, caught) > 0.5 ? 3 : 8}
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[#12201e]/40">
            斑块：{mastered ? '退了（0 块）' : '还有 5 块'}
          </p>
        </div>
      </div>
    </div>
  )
}

/** 3 和 8 这两道的正确率 */
function corruptRatio(results: Result[]): number {
  const hot = results.filter((r) => r.truth === 3 || r.truth === 8)
  if (!hot.length) return 0
  return hot.filter((r) => r.correct).length / hot.length
}
