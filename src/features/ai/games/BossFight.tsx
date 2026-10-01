/* =============================================================================
   BossFight.tsx —— BOSS 战斗台（五章通用）
   ---------------------------------------------------------------------------
   机制：
     BOSS 放一个样本 → 宠物抢答 → 答对扣 BOSS 一格血，答错扣自己一格
     10 个样本打完，按过关线判定胜负

   为什么用"血条"而不是"准确率百分比"：
     血条是游戏语言，用户不用思考就懂；准确率是实验报告语言。

   ⚠️ 踩过的两个坑，都记在这里免得再犯：
     1) 父组件传进来的 accuracy / onFinish 都是"每次渲染新建的函数"。
        把它们放进 useEffect 依赖数组 → 父组件一更新就重跑 effect → 又 setState
        → 无限循环。所以用 ref 存最新引用，依赖只留原始值。
     2) 结算时不要在 setState 的更新函数里调父组件的 setState ——
        那是在渲染阶段，React 会报 "Cannot update a component while rendering"。
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import {
  Digit,
  buildStyledSamples,
  type TestSample,
  type StyleBias,
} from '@/features/ai/components/Digit'
import { classify, type BrainState } from '@/features/ai/lib/modelBrain'
import { track } from '@/features/ai/lib/track'
import { getBossLines } from '@/features/ai/data/bossLines'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

export interface BossSpec {
  name: string
  taunt: string
  digits: number[]
  passRatio: number
  winLine: { mood: Mood; text: string }
  loseLine: { mood: Mood; text: string }
}

interface BossFightProps {
  boss: BossSpec
  brain: BrainState
  /** 参数化准确率（第 0 章按喂食量和"见过哪些数字"算；不传就用大脑表） */
  accuracy?: (truth: number) => number
  petName: string
  /** ★ 宠物当前的身体形态 —— 战斗时必须和外面长得一样，否则用户会以为换了只宠物 */
  petBody: BodyKind
  /** BOSS 的字有多难认（默认一般） */
  styleBias?: StyleBias
  onFinish: (result: { score: number; total: number; passed: boolean }) => void
  /** 打完一场后的去向：赢了继续、输了可选重打或回去补数据 */
  onWin?: () => void
  onRetry?: () => void
  onBackToFeed?: () => void
  /** 输掉时提示"它忘了哪几个数字" */
  forgotDigits?: number[]
}

export function BossFight({
  boss,
  brain,
  accuracy,
  petName,
  petBody,
  styleBias = 'normal',
  onFinish,
  onWin,
  onRetry,
  onBackToFeed,
  forgotDigits,
}: BossFightProps) {
  const samples = useMemo<TestSample[]>(
    () => buildStyledSamples(boss.digits, styleBias),
    [boss.digits, styleBias]
  )
  const total = samples.length
  const needRight = Math.ceil(total * boss.passRatio)

  const [index, setIndex] = useState(0)
  const [rightCount, setRightCount] = useState(0)
  const [reveal, setReveal] = useState<{
    truth: number
    guess: number
    confidence: number
    correct: boolean
  } | null>(null)
  const [finished, setFinished] = useState(false)
  /** BOSS 正在说的话（实时互动） */
  const [bossSay, setBossSay] = useState<string>('')
  /** 宠物挨揍的次数（用来重播挨打动画） */
  const [hitTick, setHitTick] = useState(0)
  /** 用户是否跳过了这场战斗（结算文案会不一样） */
  const [skipped, setSkipped] = useState(false)

  /** 把"每次渲染都会变"的回调存进 ref，避免它们进依赖数组 */
  const accuracyRef = useRef(accuracy)
  accuracyRef.current = accuracy
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const current = samples[index]
  const bossHp = total - rightCount
  const passed = rightCount >= needRight

  /**
   * ★ 跳过：把剩下的回合一次性算完，直接进入结算。
   * 为什么要它：整场 10 回合约 22 秒，有人愿意看、有人只想看结果。
   * 不同性格的玩家应该有不同节奏，不能强迫所有人看完。
   */
  function skipToEnd() {
    if (finished) return

    let right = rightCount
    const forced: typeof samples = []
    for (let i = index; i < total; i++) {
      const s = samples[i]
      const acc = accuracyRef.current ? accuracyRef.current(s.truth) : undefined
      const g = classify(brain, s.truth, Math.random, acc)
      if (g.digit === s.truth) right++
      forced.push(s)
    }
    void forced

    setRightCount(right)
    setIndex(total - 1)
    setReveal(null)
    setSkipped(true)
    setFinished(true)
    track('boss_skip', { boss: boss.name, score: right, total })
  }

  /* 每一轮：BOSS 出题 → 宠物抢答 → 展示结果 → 由下一个 effect 推进 */
  useEffect(() => {
    if (finished || !current || reveal) return

    const run = window.setTimeout(() => {
      const acc = accuracyRef.current ? accuracyRef.current(current.truth) : undefined
      const guess = classify(brain, current.truth, Math.random, acc)
      const correct = guess.digit === current.truth

      setRightCount((c) => (correct ? c + 1 : c))
      // ★ BOSS 实时互动：答对它不爽，答错它得意
      const lines = getBossLines(boss.name)
      const pool = correct ? lines.onRight : lines.onWrong
      setBossSay(pool[Math.floor(Math.random() * pool.length)])
      // ★ 答错了它就挨一下揍
      if (!correct) setHitTick((h) => h + 1)
      setReveal({
        truth: current.truth,
        guess: guess.digit,
        confidence: guess.confidence,
        correct,
      })
      track('boss_round', {
        boss: boss.name,
        round: index + 1,
        truth: current.truth,
        guess: guess.digit,
        correct,
        confidence: Math.round(guess.confidence * 100) / 100,
      })
    }, 900)

    return () => window.clearTimeout(run)
  }, [index, reveal, finished, current, brain, boss.name])

  /* 展示 1.3 秒后进入下一轮 */
  useEffect(() => {
    if (!reveal) return
    const id = window.setTimeout(() => {
      if (index + 1 >= total) {
        setFinished(true)
      } else {
        setIndex((i) => i + 1)
        setReveal(null)
      }
    }, 1300)
    return () => window.clearTimeout(id)
  }, [reveal, index, total])

  /* 结算：finished 只会从 false 变 true 一次 */
  useEffect(() => {
    if (!finished) return
    const ok = rightCount >= needRight
    onFinishRef.current({ score: rightCount, total, passed: ok })
    track('boss_result', { boss: boss.name, score: rightCount, total, passed: ok })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished])

  return (
    <div className="rounded-3xl border border-[#12201e]/8 bg-white p-6 shadow-[0_10px_34px_rgba(18,32,30,0.05)] sm:p-7">
      {/* ---------------- 跳过 ---------------- */}
      {!finished && (
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={skipToEnd}
            className="rounded-full border border-[#12201e]/12 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold text-[#12201e]/55 backdrop-blur transition hover:border-[#ff6b35]/45 hover:text-[#ff6b35]"
            title="不想看过程，直接出结果"
          >
            跳过这场 ⏭
          </button>
        </div>
      )}

      {/* ---------------- 血条 ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <HpBar label={petName} hp={total - bossHp} max={total} color="#ff6b35" align="left" />
        <HpBar label={boss.name} hp={bossHp} max={total} color="#12201e" align="right" />
      </div>

      {/* ---------------- 战斗区 ---------------- */}
      <div className="mt-8 grid items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col items-center">
          {/* ★ 用它当前真实的身体形态，不做任何替换 */}
          <Pet
            body={petBody}
            mood={finished ? (passed ? 'proud' : 'hurt') : reveal ? (reveal.correct ? 'happy' : 'hurt') : 'idle'}
            size={150}
            hit={hitTick}
            speech={
              finished
                ? passed
                  ? boss.winLine.text
                  : boss.loseLine.text
                : reveal
                  ? `${reveal.guess}！`
                  : undefined
            }
            note={
              reveal && !finished
                ? reveal.correct
                  ? `对了（把握 ${Math.round(reveal.confidence * 100)}%）`
                  : `其实答案是 ${reveal.truth}`
                : undefined
            }
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-[#12201e]/35">
            {finished ? '本场结束' : `第 ${index + 1} / ${total} 题`}
          </div>
          <div
            className="flex h-[132px] w-[104px] items-center justify-center rounded-2xl border-2 border-dashed transition"
            style={{
              borderColor: reveal
                ? reveal.correct
                  ? 'rgba(0,168,107,0.45)'
                  : 'rgba(228,84,47,0.45)'
                : 'rgba(18,32,30,0.12)',
              background: reveal
                ? reveal.correct
                  ? 'rgba(0,168,107,0.06)'
                  : 'rgba(228,84,47,0.06)'
                : '#f7f6f2',
            }}
          >
            {current ? (
              <Digit value={current.truth} size={46} style={current.style} />
            ) : (
              <span className="text-2xl">🏁</span>
            )}
          </div>
          {!finished && <div className="text-[11px] text-[#12201e]/35">它从没见过这张</div>}
        </div>

        <div className="flex flex-col items-center">
          <BossFace mood={finished && passed ? 'down' : 'up'} say={bossSay} />
          <div className="mt-3 max-w-[210px]">
            <div className="relative rounded-2xl bg-[#12201e] px-3.5 py-2.5 text-center text-[11px] leading-5 text-white">
              {finished
                ? passed
                  ? getBossLines(boss.name).onWin
                  : getBossLines(boss.name).onLose
                : bossSay || boss.taunt}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 结局 ---------------- */}
      {finished && (
        <div
          className="mt-8 rounded-2xl border px-6 py-5"
          style={{
            borderColor: passed ? 'rgba(0,168,107,0.4)' : 'rgba(228,84,47,0.35)',
            background: passed ? 'rgba(0,168,107,0.07)' : 'rgba(228,84,47,0.06)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">
                {passed ? '🎉 打赢了' : '💥 这场没赢'}
                {skipped && (
                  <span className="ml-2 rounded-full bg-[#12201e]/8 px-2 py-0.5 text-[10px] font-medium text-[#12201e]/45">
                    已跳过过程
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xs leading-6 text-[#12201e]/55">
                答对 <b className="font-mono text-[#12201e]">{rightCount}</b> / {total}
                （过关线 {needRight}）
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {passed ? (
                onWin && (
                  <button
                    type="button"
                    onClick={onWin}
                    className="rounded-full bg-[#ff6b35] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  >
                    继续 →
                  </button>
                )
              ) : (
                <>
                  {onBackToFeed && (
                    <button
                      type="button"
                      onClick={onBackToFeed}
                      className="rounded-full bg-[#12201e] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                    >
                      回去补数据
                    </button>
                  )}
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="rounded-full border border-[#12201e]/12 bg-white px-5 py-3 text-sm font-medium text-[#12201e]/65 transition hover:text-[#12201e]"
                    >
                      原样再打一次
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 输掉的原因：明确告诉它缺哪几个数字 */}
          {!passed && forgotDigits && forgotDigits.length > 0 && (
            <div className="mt-4 border-t border-[#12201e]/8 pt-3.5">
              <div className="text-[11px] leading-6 text-[#12201e]/60">
                它这一场忘了 <b className="font-mono">{forgotDigits.join('、')}</b> 怎么写。
                <br />
                <span className="text-[#12201e]/40">
                  —— 回去把这几个再喂一遍，它就能记住了。
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- BOSS 的脸（会说话、会眨眼、越打越垮） ---------------- */
function BossFace({ mood, say }: { mood: 'up' | 'down'; say?: string }) {
  /** 说话的瞬间张嘴 —— 让这个方块怪看起来真的在讲话 */
  const [talking, setTalking] = useState(false)
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    if (!say) return
    setTalking(true)
    const id = window.setTimeout(() => setTalking(false), 430)
    return () => window.clearTimeout(id)
  }, [say])

  useEffect(() => {
    let id = 0
    const loop = () => {
      id = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 130)
        loop()
      }, 2600 + Math.random() * 2800)
    }
    loop()
    return () => window.clearTimeout(id)
  }, [])

  const eyeH = mood === 'up' ? 14 : 6

  return (
    <svg
      viewBox="0 0 120 120"
      width="128"
      height="128"
      role="img"
      aria-label="BOSS"
      className={talking ? 'boss-talking' : undefined}
    >
      <rect
        x="14"
        y="26"
        width="92"
        height="70"
        rx="14"
        fill={mood === 'up' ? '#12201e' : '#7c8797'}
        stroke={mood === 'up' ? '#12201e' : '#9aa3b2'}
        strokeWidth="3"
      />

      {/* 眼睛：眨眼时压扁成一条缝 */}
      <rect
        x="34"
        y={blink ? 55 : 48}
        width="14"
        height={blink ? 3 : eyeH}
        rx="3"
        fill="#d7ff68"
      />
      <rect
        x="72"
        y={blink ? 55 : 48}
        width="14"
        height={blink ? 3 : eyeH}
        rx="3"
        fill="#d7ff68"
      />

      {/* 嘴：说话时张成方形，否则一条线（得意）或苦笑（输了） */}
      {talking ? (
        <rect x="46" y="70" width="28" height="14" rx="4" fill="#d7ff68" />
      ) : mood === 'up' ? (
        <path d="M 42 76 L 78 76" stroke="#d7ff68" strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path
          d="M 42 78 Q 60 66 78 78"
          fill="none"
          stroke="#d7ff68"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}

      {/* 天线：有话说的时候更亮 */}
      <line x1="60" y1="26" x2="60" y2="12" stroke="#12201e" strokeWidth="3" />
      <circle cx="60" cy="10" r="5" fill={talking ? '#ff6b35' : '#e4542f'} />
    </svg>
  )
}

/* ---------------- 血条 ---------------- */
function HpBar({
  label,
  hp,
  max,
  color,
  align,
}: {
  label: string
  hp: number
  max: number
  color: string
  align: 'left' | 'right'
}) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100))
  return (
    <div style={{ textAlign: align }}>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-[#12201e]/70">{label}</span>
        <span className="font-mono text-[#12201e]/40">
          {hp} / {max}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#12201e]/8">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
