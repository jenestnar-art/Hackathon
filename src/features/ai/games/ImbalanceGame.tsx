/* =============================================================================
   ImbalanceGame.tsx —— 第 1 章核心玩法：数据不平衡
   ---------------------------------------------------------------------------
   玩法是一场【对照实验】：
     A 补样本 → 立竿见影
     B 再练练（调参）→ 几乎无用
   谁先谁后，就是"先怀疑数据还是先怀疑模型"这个核心信号的来源。

   ★ 判定规则全部来自 imbalanceRules.ts（唯一来源），
     成绩单和 BOSS 战调的是同一个 accuracyFor()，所以永远对得齐。

   ⚠️ 一个必须注意的实现细节：
     "喂它一个"会同时告诉父组件和本组件。父组件的状态要等下一帧才更新，
     所以如果直接用 props 里的 fedOrder 去算，会算到"少一个"的旧数据。
     因此本组件自己存一份 fedOrder，当场就更新，算出来的永远是最新的。
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PokePet } from '@/features/ai/components/PokePet'
import { CH1 } from '@/features/ai/data/petLines'
import { Digit, buildStyledSamples } from '@/features/ai/components/Digit'
import { classify } from '@/features/ai/lib/modelBrain'
import { track } from '@/features/ai/lib/track'
import {
  SCARCE,
  PER_DIGIT,
  GOAL_BAD_ACC,
  accuracyFor,
  fedTimesOf,
  isFixed,
  getFed,
} from '@/features/ai/games/imbalanceRules'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

interface ImbalanceGameProps {
  /** 已经喂了几个（父组件的记录） */
  fixed: number
  /** 这一章的目标数 */
  goal: number
  /** ★ 喂食顺序（父组件的记录）—— 本组件会自己维护一份更新的 */
  fedOrder: number[]
  onFeed: (digit: number) => void
  onParamAdjust: () => void
  paramCount: number
  rounds: number
  petBody: BodyKind
  petMood?: Mood
}

interface TestResult {
  sample: { id: number; truth: number; style: 'normal' | 'tilted' | 'bold' | 'thin' | 'messy' }
  guess: number
  confidence: number
}

const THINKING = ['它在翻样本……', '它在找 6 和 8 的规律……', '它有点拿不准……']
/** 成绩单固定考这几个：4 个普通数字 + 4 个 6/8 */
const PROBE = [2, 5, 9, 3, 6, 8, 6, 8]

export function ImbalanceGame({
  fedOrder: fedOrderProp,
  onFeed,
  onParamAdjust,
  paramCount,
  rounds,
  petBody,
  petMood,
}: ImbalanceGameProps) {
  void fedOrderProp

  /** ★ 本组件自己维护的喂食顺序 —— 当场更新，不等父组件 */
  const [fedOrder, setFedOrder] = useState<number[]>(() => getFed('ch1'))

  const [training, setTraining] = useState(false)
  const [thinking, setThinking] = useState('')
  /** 训练时用它驱动重渲染（思考提示轮播），本身不直接读 */
  const [, setTrainTick] = useState(0)
  const [flash, setFlash] = useState(0)
  const [results, setResults] = useState<TestResult[] | null>(null)
  const [badAcc, setBadAcc] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<number, number> = {}
    for (const d of SCARCE) c[d] = 1 + fedTimesOf(fedOrder, d)
    return c
  }, [fedOrder])

  const fixedEnough = isFixed(fedOrder)

  /* ---------------- 训练 ---------------- */
  const runTraining = useCallback(
    (reason: 'initial' | 'param' | 'data', order: number[] = fedOrder) => {
      if (training) return
      setTraining(true)
      setVerdict(null)
      setResults(null)
      setBadAcc(null)
      setTrainTick((t) => t + 1)

      let step = 0
      setThinking(THINKING[0])
      const tick = window.setInterval(() => {
        step += 1
        setThinking(THINKING[Math.min(step, THINKING.length - 1)])
        setTrainTick((t) => t + 1)
      }, 360)

      const samples = buildStyledSamples(PROBE, 'normal')

      window.setTimeout(() => {
        window.clearInterval(tick)
        setThinking('')

        /* ★ 每一题的正确率都来自唯一规则文件。
           样本充足的数字 = 1（必对）；6/8 补够 = 1（必对）；没补够 = 瞎猜。 */
        const out: TestResult[] = samples.map((sample) => {
          const acc = accuracyFor(sample.truth, order)
          const g = classify('fledgling', sample.truth, Math.random, acc)
          return { sample, guess: g.digit, confidence: g.confidence }
        })

        const scarceResults = out.filter((r) => SCARCE.includes(r.sample.truth))
        const right = scarceResults.filter((r) => r.guess === r.sample.truth).length
        const acc = scarceResults.length ? right / scarceResults.length : 0

        setResults(out)
        setBadAcc(acc)
        setFlash((f) => f + 1)
        setTraining(false)

        track('train_run', {
          reason,
          rounds,
          paramCount,
          badAcc: Math.round(acc * 100) / 100,
        })

        if (reason === 'param') {
          setVerdict(
            acc < 0.3
              ? '转了旋钮、又练了几轮 —— 认不出的还是认不出。'
              : '稍微好了一点，但 6 和 8 还是靠蒙。'
          )
        } else if (reason === 'data') {
          setVerdict(
            acc >= GOAL_BAD_ACC
              ? '补完样本立刻见效 —— 6 和 8 全对。'
              : '有起色了，但还差一点。再多喂几个。'
          )
        } else {
          setVerdict('普通数字它全认得，只有 6 和 8 全错 —— 因为这两类样本太少了。')
        }
      }, 2000)
    },
    [training, rounds, paramCount, fedOrder]
  )

  /* 进关卡先训一次，制造"翻车现场" */
  const ranOnce = useRef(false)
  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true
    runTraining('initial', [])
  }, [runTraining])

  /** 补一个稀缺样本：本地顺序立刻更新，再用新顺序重新算一次成绩单 */
  function feedScarce(digit: number) {
    const next = [...fedOrder, digit]
    setFedOrder(next)
    onFeed(digit)
    setResults(null)
    setBadAcc(null)
    setVerdict(null)
    // 补完之后自动重新考一次，让用户立刻看到变化
    window.setTimeout(() => runTraining('data', next), 120)
  }

  /**
   * ★ 一键补满：把 6 和 8 都喂到够。
   *
   * 为什么要它：这一章要把 6 和 8 各补 5 次 = 点 10 次"喂它一个"。
   * 对性子慢的人是"慢慢养"的乐趣，对性子快的人是纯粹的等待。
   * 玩家已经看懂"要补这两类"之后，剩下的点击不产生任何新信息 ——
   * 这时候应该允许他跳过，而不是强迫他走完流程。
   *
   * 注意：它【只补数据，不动参数】。所以用了它的人，
   * 最终性格标签仍然是"先看数据"，不会被误判成"玄学信徒"。
   */
  function fillAll() {
    if (training || fixedEnough) return
    const next = [...fedOrder]
    for (const d of SCARCE) {
      const have = fedTimesOf(fedOrder, d)
      for (let i = have; i < PER_DIGIT; i++) next.push(d)
    }
    setFedOrder(next)
    // 告诉父组件：一次补齐。用真实数量，进度条才不会跳。
    for (let i = fedOrder.length; i < next.length; i++) onFeed(next[i])
    track('sample_add', { chapter: 'ch1', bulk: true, count: next.length - fedOrder.length })
    setResults(null)
    setBadAcc(null)
    setVerdict(null)
    window.setTimeout(() => runTraining('data', next), 140)
  }

  /* ---------------- 它的情绪 ---------------- */
  const scarceRight = results
    ? results.filter((r) => SCARCE.includes(r.sample.truth) && r.guess === r.sample.truth).length
    : 0
  const scarceTotal = results ? results.filter((r) => SCARCE.includes(r.sample.truth)).length : 0
  const ratio = scarceTotal ? scarceRight / scarceTotal : 0

  /** ★ 是否"开窍了" —— 成绩单过半就进入得意状态（会蹦、冒星星、说话变自信） */
  const mastered = results != null && ratio >= GOAL_BAD_ACC

  /** 刚开窍的那一下：播一次夸张的"跳起来亮相" */
  const [celebrate, setCelebrate] = useState(0)
  const wasMastered = useRef(false)
  useEffect(() => {
    if (mastered && !wasMastered.current) setCelebrate((c) => c + 1)
    wasMastered.current = mastered
  }, [mastered])

  const displayMood: Mood = training
    ? 'confused'
    : results == null
      ? (petMood ?? (fixedEnough ? 'confused' : 'smug'))
      : mastered
        ? 'happy'
        : ratio <= 0.15
          ? 'hurt'
          : 'confused'

  /** 得意时换一套台词，别让它在高兴的时候还道歉 */
  const pokeLines = mastered ? CH1.pokeProud : CH1.poke

  const statusText = training
    ? thinking
    : results
      ? mastered
        ? '我全会了！'
        : '它完全在瞎猜 6 和 8'
      : '它觉得 6 和 8 都长得一样'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
      {/* ---------------- 左：宠物 + 成绩单 ---------------- */}
      <div className="rounded-3xl border border-[#12201e]/8 bg-white p-6 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
        <div className="flex flex-wrap items-start justify-center gap-9">
          {/* 宠物：可点击。没开窍时戳它会抖 + 残影 + 道歉；开窍后会一直蹦 + 冒星星 */}
          <div className="relative">
            <PokePet
              body={petBody}
              mood={displayMood}
              size={172}
              lines={pokeLines}
              pokeMood={mastered ? 'proud' : 'hurt'}
              disabled={training}
              cheering={mastered}
              celebrate={celebrate}
              statusText={statusText}
            />

            {/* 训练揭晓时的一次闪光（绿=考得好 / 红=考砸） */}
            {flash > 0 && !training && (
              <span
                key={`flash-${flash}`}
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  animation: 'pet-hitmark 700ms ease-out forwards',
                  boxShadow:
                    results && ratio >= GOAL_BAD_ACC
                      ? 'inset 0 0 40px 14px rgba(0,168,107,0.4)'
                      : 'inset 0 0 40px 14px rgba(228,84,47,0.4)',
                }}
              />
            )}
          </div>

          {/* 成绩单 */}
          <div className="min-w-[300px] flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#12201e]/60">它的成绩单（8 道题）</span>
              {badAcc != null && (
                <span className="text-[11px]">
                  只考 6/8：
                  <b
                    className="font-mono"
                    style={{ color: badAcc >= GOAL_BAD_ACC ? '#00a86b' : '#e4542f' }}
                  >
                    {Math.round(badAcc * 100)}%
                  </b>
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              {(results ?? Array.from({ length: 8 }, () => null)).map((r, i) => {
                if (!r) {
                  return (
                    <div
                      key={i}
                      className="grid h-[92px] place-items-center rounded-2xl border border-dashed border-[#12201e]/10 bg-[#f7f6f2] text-[10px] text-[#12201e]/25"
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
                const right = r.guess === r.sample.truth
                const scarce = SCARCE.includes(r.sample.truth)
                return (
                  <div
                    key={i}
                    className="rounded-2xl border px-2 py-2 text-center"
                    style={{
                      borderColor: right ? 'rgba(0,168,107,0.4)' : 'rgba(228,84,47,0.4)',
                      background: right ? 'rgba(0,168,107,0.06)' : 'rgba(228,84,47,0.06)',
                      animation: `pet-bubble-in 320ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms both`,
                    }}
                  >
                    <div className="flex justify-center">
                      <Digit value={r.sample.truth} size={26} style={r.sample.style} />
                    </div>
                    <div
                      className="mt-0.5 font-mono text-[11px] font-bold"
                      style={{ color: right ? '#00a86b' : '#e4542f' }}
                    >
                      {right ? `✓${r.guess}` : `✗答${r.guess}`}
                    </div>
                    {scarce && <div className="text-[9px] text-[#12201e]/35">重点题</div>}
                  </div>
                )
              })}
            </div>

            {verdict && (
              <div className="mt-4 rounded-2xl bg-[#f7f6f2] px-4 py-3 text-[11px] leading-6 text-[#12201e]/65">
                {verdict}
              </div>
            )}
          </div>
        </div>

        {/* ---------------- 两个动作：对照实验 ---------------- */}
        <div className="mt-6 grid gap-4 border-t border-[#12201e]/8 pt-5 sm:grid-cols-2">
          {/* A 补数据 */}
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: fixedEnough ? 'rgba(0,168,107,0.4)' : 'rgba(255,107,53,0.35)',
              background: fixedEnough ? 'rgba(0,168,107,0.05)' : 'rgba(255,107,53,0.06)',
            }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold text-[#12201e]">A · 补样本</span>
              {fixedEnough && (
                <span className="text-[10px] font-semibold text-[#00a86b]">已补够</span>
              )}
            </div>
            <p className="mb-3 text-[11px] leading-5 text-[#12201e]/55">
              它认不出 6 和 8，是因为它几乎没吃过这两个数字。
            </p>

            <div className="mb-3 flex flex-col gap-1.5">
              {SCARCE.map((d) => {
                const have = counts[d]
                const need = 1 + PER_DIGIT
                return (
                  <div key={d} className="flex items-center gap-2.5 text-[11px]">
                    <span className="w-3 font-mono font-bold">{d}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#12201e]/8">
                      <span
                        className="block h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.min(100, (have / need) * 100)}%`,
                          background: have >= need ? '#00a86b' : '#ff6b35',
                        }}
                      />
                    </span>
                    <span className="w-16 text-right font-mono text-[10px] text-[#12201e]/45">
                      {have >= need ? '够了' : `再喂${need - have}个`}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2">
              {SCARCE.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={training}
                  onClick={() => feedScarce(d)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#ff6b35] px-3 py-2.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Digit value={d} size={13} color="#fff" />
                  喂它一个
                </button>
              ))}
            </div>

            {/* ★ 一键补满 —— 只补数据、不动参数，所以不影响性格判定 */}
            {!fixedEnough && (
              <button
                type="button"
                disabled={training}
                onClick={fillAll}
                title="把 6 和 8 一次补齐，不用点那么多次"
                data-probe="fill-all"
                className="mt-2 w-full rounded-full border border-[#ff6b35]/35 bg-white px-3 py-2 text-[11px] font-medium text-[#b73b21] transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                ⏭ 一次补齐（还差 {SCARCE.reduce(
                  (sum, d) => sum + Math.max(0, 1 + PER_DIGIT - counts[d]),
                  0
                )}{' '}
                个）
              </button>
            )}
          </div>

          {/* B 调参死路 */}
          <div className="rounded-2xl border border-[#12201e]/10 bg-[#f7f6f2] p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold text-[#12201e]/70">B · 再练练看</span>
              <span className="font-mono text-[10px] text-[#12201e]/38">
                已练 {rounds} 轮 · 转过 {paramCount} 次
              </span>
            </div>
            <p className="mb-3 text-[11px] leading-5 text-[#12201e]/55">
              效果不好，你也可以让它多练几轮。
            </p>
            <button
              type="button"
              disabled={training}
              onClick={() => {
                onParamAdjust()
                runTraining('param')
              }}
              className="w-full rounded-full bg-[#12201e] px-4 py-2.5 text-xs font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {training ? '练着呢……' : '再练 4 轮'}
            </button>

            {paramCount >= 1 && badAcc != null && badAcc < GOAL_BAD_ACC && (
              <p className="mt-3 text-[11px] leading-5 text-[#b73b21]">
                你已经转了 {paramCount} 次旋钮了。注意看：6 和 8 还是一个都没对。
                <br />
                —— 它好像不是"没练够"。
              </p>
            )}
          </div>
        </div>

        {fixedEnough && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#00a86b]/35 bg-[#e9f9f1] px-5 py-4">
            <div className="text-xs leading-6 text-[#12201e]/70">
              6 和 8 都补够了 —— <b>成绩单已经全对</b>。可以带它去打 BOSS 了。
            </div>
          </div>
        )}
      </div>

      {/* ---------------- 右：数据分布 ---------------- */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-[#12201e]/8 bg-white p-5 shadow-[0_10px_34px_rgba(18,32,30,0.05)]">
          <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-[#12201e]/38">
            每类样本数（红色＝稀缺）
          </div>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 10 }, (_, d) => {
              const scarce = SCARCE.includes(d)
              const count = scarce ? counts[d] : 6
              return (
                <div
                  key={d}
                  className="grid items-center gap-2.5"
                  style={{ gridTemplateColumns: '14px 1fr 22px' }}
                >
                  <span
                    className="font-mono text-[11px] font-bold"
                    style={{ color: scarce ? '#e4542f' : '#12201e' }}
                  >
                    {d}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#12201e]/8">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, (count / 7) * 100)}%`,
                        background: scarce ? '#e4542f' : '#ff6b35',
                      }}
                    />
                  </span>
                  <span className="text-right font-mono text-[10px] tabular-nums text-[#12201e]/45">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-[#12201e]/8 bg-[#101917] p-5 text-white">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/45">提示</div>
          <p className="mt-3 text-[11px] leading-6 text-white/60">
            左边 A 是<b className="text-[#d7ff68]">补数据</b>，右边 B 是让它
            <b className="text-[#d7ff68]">多练几轮</b>。
            <br />
            先试哪个，会决定你养成一个什么性格的模型。
          </p>
          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] text-white/40">
            <span className="inline-block size-1.5 rounded-full bg-[#3b9ae1]" />
            普通数字它全认得，问题只在 6 和 8 上
          </div>
        </div>
      </div>
    </div>
  )
}
