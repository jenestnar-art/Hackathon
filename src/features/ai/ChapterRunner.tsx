/* =============================================================================
   ChapterRunner.tsx —— 通用章节容器
   ---------------------------------------------------------------------------
   为什么抽这个：五章的"元流程"完全一样 ——
     开场台词 → 核心玩法 → BOSS 战 → 变形演出 → 下一章
   不一样的只有三件东西：玩法组件、BOSS 数据、宠物形态。
   所以把元流程收在这里，每章只写自己的玩法组件。

   输掉的处理有两种模式（per chapter）：
     forgetOnLose = 3   输掉就"忘掉最后 3 个样本"，台面解锁让他补回来（第 0 章）
     forgetOnLose = 0   输掉不惩罚，直接回去继续补数据（第 1 章起，因为那一章
                        本来就在教"补数据"，再惩罚会绕成死循环）
   ========================================================================== */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BossFight } from '@/features/ai/games/BossFight'
import { EvolveReveal } from '@/features/ai/components/EvolveReveal'
import { AdoptPet } from '@/features/ai/components/AdoptPet'
import { FormHandoff } from '@/features/ai/components/FormHandoff'
import { CHAPTERS, getChapter, nextChapter, type ChapterSpec } from '@/features/ai/data/chapters'
import { getBossLines } from '@/features/ai/data/bossLines'
import { setChapter, track } from '@/features/ai/lib/track'
import { usePetStore, type ChapterId } from '@/features/ai/store/petStore'
import { stageAt, stageByProgress } from '@/features/ai/games/chapter0'
import { pushFed } from '@/features/ai/games/imbalanceRules'
import type { BrainState } from '@/features/ai/lib/modelBrain'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

export type Phase = 'adopt' | 'intro' | 'game' | 'boss' | 'clear' | 'done'

/** 每个玩法组件都收到这一套上下文 */
export interface GameContext {
  /** 这一章已经喂了多少个 */
  fed: number
  /** 这一章的目标喂食数 */
  goal: number
  /** 它已经见过的数字 */
  seen: Set<number>
  /** 喂食顺序（第 1 章要靠它算每个稀缺数字补了几次） */
  feedOrder: number[]
  /** 是否已经喂满这一章的目标 */
  full: boolean
  /** 它忘了哪几个数字（用于高亮提示） */
  forgot: number[]
  /** 报告"喂了一个样本" */
  feed: (digit: number) => void
  /** 报告"它长到第几阶段了" */
  setStage: (index: number) => void
  /** 当前阶段序号 */
  stage: number
  /** 这一章的规格 */
  spec: ChapterSpec
  /** 调试/演示用：直接跳到打 BOSS */
  requestBoss: () => void
}

export interface ChapterRunnerProps {
  chapterId: ChapterId
  /** 玩法组件 */
  renderGame: (ctx: GameContext) => ReactNode
  /** 目标喂食数 */
  goal: number
  /** 输掉时忘掉几个样本（0 = 不惩罚） */
  forgetOnLose?: number
  /** BOSS 战的字迹难度 */
  styleBias?: 'neat' | 'normal' | 'messy'
  /** 计算 BOSS 战时单题的正确率 */
  bossAccuracy: (truth: number, state: ChapterRunState) => number
  /** 顶栏的返回按钮 */
  onExit?: () => void
  /** 这一章固定长什么样（不传就按喂食量分阶段长大） */
  petBody?: BodyKind
  /** 开场台词（不传就用章节里的默认） */
  introLines?: { mood: Mood; text: string }[]
  /** 初始状态（第 1 章要从"已经有 38 个样本但 6/8 稀缺"开始） */
  initial?: Partial<ChapterRunState>
  /**
   * ★ 上一章结束时的形态。
   * 传了它，开场那一屏就会先演一次"形态交接"：
   * 上一章那只向上浮走，这一章这只从下面升上来。
   * 没传就只演"新的升上来"（第 0 章就是这种情况）。
   */
  fromBody?: BodyKind
  /**
   * 形态交接播完了。
   * 有它的时候，开场那一屏先只放动画（更干净），
   * 等动画完了再浮出标题、台词和"开始"按钮。
   */
  onHandoffDone?: () => void
  /**
   * 外层是否已经准备好让我演形态交接。
   * 外层的"全屏镜头推进"演完之前是 false —— 否则交接会在遮罩底下演完，
   * 观众什么也看不到。默认 true（单独用这个组件时不等人）。
   */
  handoffReady?: boolean
}

export interface ChapterRunState {
  fed: number
  seen: number[]
  feedOrder: number[]
  body: BodyKind
  brain: BrainState
}

export function ChapterRunner({
  chapterId,
  renderGame,
  goal,
  forgetOnLose = 0,
  styleBias = 'normal',
  petBody,
  onExit,
  bossAccuracy,
  introLines,
  initial,
  fromBody,
  onHandoffDone,
  handoffReady = true,
}: ChapterRunnerProps) {
  const name = usePetStore((s) => s.name)
  const finishNaming = usePetStore((s) => s.finishNaming)
  const namingDone = usePetStore((s) => s.namingDone)
  const clearChapter = usePetStore((s) => s.clearChapter)
  const goChapter = usePetStore((s) => s.goChapter)
  const recordBoss = usePetStore((s) => s.recordBoss)
  const learnTerm = usePetStore((s) => s.learnTerm)
  const cleared = usePetStore((s) => s.cleared)

  const spec = getChapter(chapterId)!

  /* ---------------- 状态 ---------------- */
  /* ★ 第 0 章多一幕"领养"：先给它取名字。
     只有从第 0 章进、且还没取过名字时才演，重玩不会重复要名字。 */
  const [phase, setPhase] = useState<Phase>(chapterId === 'ch0' && !namingDone ? 'adopt' : 'intro')
  const [introAt, setIntroAt] = useState(0)
  const [state, setState] = useState<ChapterRunState>({
    fed: initial?.fed ?? 0,
    seen: initial?.seen ?? [],
    feedOrder: initial?.feedOrder ?? [],
    body: initial?.body ?? spec.startLook.body,
    brain: initial?.brain ?? spec.startBrain,
  })
  const [forgot, setForgot] = useState<number[]>([])
  const [line, setLine] = useState<{ face: string; text: string; note?: string } | null>(null)

  /**
   * ★ 形态交接：开场那一屏先只放动画，动画完了再浮出文字和按钮。
   * 为什么要有这个"先动画后文字"：
   *   如果动画和文字同时出现，观众的眼睛会去读字，
   *   就错过了"上一只浮上去、新的升起来"这个交代。
   *   先把注意力借给动画 1.8 秒，再放文字。
   * 没有 fromBody 时（第 0 章）直接就是 true，不拖时间。
   *
   * ★ handoffReady：外层的"全屏镜头推进"演完之前不要开始。
   *   否则形态交接在遮罩底下演完了，观众什么都没看到。
   *
   * ★★ 这里踩过一个致命坑，导致用户彻底卡死在新章节开场：
   *   effect 的依赖数组里漏了 handoffReady。
   *   于是 handoffReady 从 false 变 true 时 effect 不重跑，
   *   handoffDone 永远是 false —— 文字和按钮永远不出现，页面就死了。
   *   教训：凡是"某个状态变化后才该开始"的逻辑，
   *        那个状态必须进依赖数组，否则条件分支会永久停在 return 上。
   *
   * ★ 另外加了兜底：万一外层的 onDone 没触发（组件异常、动画被打断等），
   *   4 秒后强制放行。宁可少演一次动画，也不能把人卡住。
   */
  const [handoffDone, setHandoffDone] = useState(!fromBody)
  const handoffStarted = useRef(false)
  useEffect(() => {
    if (!fromBody || !handoffReady) return
    if (handoffStarted.current) return
    handoffStarted.current = true

    setHandoffDone(false)
    const t = window.setTimeout(() => {
      setHandoffDone(true)
      onHandoffDone?.()
      /* 1800ms 要跟着 form-handoff.css 的时间轴走：
         旧的 1680ms 走完，新的 1780ms 到位。
         取 1800 —— 新形态基本落定，文字正好接上，不用干等。 */
    }, 1800)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromBody, handoffReady, chapterId])

  /* 保命：舞台迟迟不就绪也要放行，绝不让人卡在这一屏 */
  useEffect(() => {
    if (!fromBody || handoffReady) return
    const t = window.setTimeout(() => {
      console.warn('[ai] handoffReady 超时，强制放行，避免卡在开场页')
      setHandoffDone(true)
    }, 4000)
    return () => window.clearTimeout(t)
  }, [fromBody, handoffReady])

  useEffect(() => {
    setChapter(chapterId)
  }, [chapterId])

  /** 开场台词：优先用传入的，否则从章节配置生成一段 */
  const lines: { mood: Mood; text: string }[] =
    introLines ??
    [
      { mood: spec.startLook.mood, text: `第 ${spec.order} 章：${spec.title}` },
      { mood: spec.startLook.mood, text: spec.goal },
    ]

  const shownLine = lines[Math.min(introAt, lines.length - 1)]
  /** ★ 按喂食【比例】算阶段，不是按绝对数字 —— 否则喂满 12 个会掉回第一阶段 */
  const stageIdx = stageByProgress(state.fed, goal)
  /** ★ 章节指定了固定形态就用它；否则按喂食比例分阶段长大。
      踩过的坑：把 stageAt(...) 写在 ?? 左边就永远走不到 petBody。 */
  const body: BodyKind = petBody ?? stageAt(stageIdx).body

  /* ---------------- 喂食 ---------------- */
  function handleFeed(digit: number) {
    setState((s) => ({
      ...s,
      fed: s.fed + 1,
      feedOrder: [...s.feedOrder, digit],
      seen: s.seen.includes(digit) ? s.seen : [...s.seen, digit],
    }))
    setForgot((f) => f.filter((d) => d !== digit))
    // 同步给共享记录（第 1 章的 BOSS 从这里读）
    pushFed(chapterId, digit)
    track('feed', { digit, total: state.fed + 1, chapter: chapterId })
    learnTerm('样本')
  }

  /** 玩法组件报告"阶段变了" */
  function handleStage(next: number) {
    const s = stageAt(next)
    track('pet_evolve', { chapter: chapterId, stage: next, label: s.label })
    setLine({ face: '✨', text: s.line, note: `它长大了：${s.label}` })
  }

  /* ---------------- BOSS ---------------- */
  function handleBossFinish(result: { score: number; total: number; passed: boolean }) {
    recordBoss({ boss: spec.boss.name, ...result })

    /* ★ 赢了也【不自动跳走】，停在结算面板等用户点"继续"。
       原因：如果这里直接 setPhase('clear')，结算面板会一闪而过 ——
       尤其用了"跳过这场"的人，他跳过的就是过程，结果必须让他看清。 */
    if (result.passed) {
      clearChapter(chapterId, spec.badge)
      setLine({ face: '🎉', text: '我赢了！看看我现在的样子。' })
    } else if (forgetOnLose > 0) {
      const forgotten = state.feedOrder.slice(-forgetOnLose)
      setForgot(forgotten)
    }
  }

  function backToGame() {
    if (forgetOnLose > 0 && forgot.length > 0) {
      const kept = state.feedOrder.slice(0, -forgetOnLose)
      setState((s) => ({
        ...s,
        fed: kept.length,
        feedOrder: kept,
        seen: Array.from(new Set(kept)),
      }))
      setLine({
        face: '😰',
        text: `我……我把 ${forgot.join('、')} 忘了。`,
        note: '被考砸之后，它需要你把这几个再喂一遍',
      })
    } else {
      setLine({ face: '😤', text: '我还得再练练。', note: '回去多喂几个样本' })
    }
    setPhase('game')
    track('back_to_game', { chapter: chapterId, forgot: forgot.join(',') })
  }

  const ctx: GameContext = {
    fed: state.fed,
    goal,
    seen: new Set(state.seen),
    feedOrder: state.feedOrder,
    full: state.fed >= goal,
    forgot,
    feed: handleFeed,
    setStage: handleStage,
    stage: stageIdx,
    spec,
    requestBoss: () => setPhase('boss'),
  }

  return (
    <div className="min-h-screen bg-body p-3 text-lcd-ink sm:p-6 lg:p-8">
      {/* ══ 机身外壳：整页是一台设备 ══ */}
      <div className="device-shell mx-auto max-w-[1320px] p-3 sm:p-4 lg:p-5">
      {/* ---------------- 机身顶栏：型号 + 阶段指示 ---------------- */}
      <div className="px-2 pb-3 pt-1">
        {/* 型号行：给"这是一台设备"一个交代。放在机身上，所以用 on-body 的深字 */}
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="label on-body">MODEL PET · MP-01</span>
          <span className="h-px flex-1 bg-body-line" />
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="key on-body px-3.5 py-1.5 text-[11px] font-medium"
            >
              ← 返回方向选择
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['game', `第 ${spec.order} 章 · ${spec.title}`],
              ['boss', `BOSS · ${spec.boss.name}`],
              ['clear', '它变形了'],
            ] as const
          ).map(([key, label], i) => {
            const order: Phase[] = ['intro', 'game', 'boss', 'clear']
            const active = order.indexOf(phase) >= order.indexOf(key as Phase)
            return (
              <span
                key={key}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
                /* ★ 这排胶囊物理上在【机身】上（浅底），所以用深字。
                   之前写成亮色，结果浅字印浅底，几乎看不见。
                   "这块底色是什么" —— 换皮时每处都要问一遍。 */
                style={
                  active
                    ? { background: 'rgb(var(--lcd-rgb))', color: '#10180f' }
                    : {
                        background: 'rgb(var(--body-ink-rgb) / 0.07)',
                        color: 'rgb(var(--body-ink-rgb) / 0.5)',
                      }
                }
              >
                {i + 1}. {label}
              </span>
            )
          })}

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[11px] text-body-ink/50 sm:inline">学到的词</span>
            <span className="rounded-full bg-lcd/35 px-3 py-1.5 text-[11px] font-bold text-body-ink">
              {spec.term}
            </span>
          </div>
        </div>
      </div>

      {/* ══ 屏幕 ══ */}
      <main className="screen-surface p-5 sm:p-7 lg:p-9">
        <div className="screen-content">
        {/* 领养时不要侧栏 —— 那时它还没有名字，侧栏会显示随机名，是干扰 */}
        <div
          className={
            phase === 'adopt'
              ? 'mx-auto max-w-[880px]'
              : 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]'
          }
        >
          <div>
            {/* ---------------- 领养（只在第 0 章、且还没取过名字） ---------------- */}
            {phase === 'adopt' && (
              <AdoptPet
                defaultName={name}
                body={spec.startLook.body}
                mood={spec.startLook.mood}
                onAdopt={(n) => {
                  finishNaming(n)
                  setPhase('intro')
                  track('phase_enter', { phase: 'intro', chapter: chapterId })
                }}
              />
            )}

            {/* ---------------- 开场 ---------------- */}
            {phase === 'intro' && (
              <div className="panel relative overflow-hidden">
                <span
                  className="pointer-events-none absolute -right-4 -top-10 select-none font-mono text-[190px] font-black leading-none text-lcd opacity-[0.07]"
                  aria-hidden
                >
                  {spec.order}
                </span>
                <div className="pointer-events-none absolute -left-24 top-1/3 size-72 rounded-full bg-lcd/8 blur-[110px]" />

                <div
                  className={`chapter-intro-grid relative z-10 grid gap-8 p-7 sm:p-10 lg:items-center${
                    handoffDone ? '' : ' is-handoff'
                  }`}
                >
                  <div
                    style={{
                      opacity: handoffDone ? 1 : 0,
                      transform: handoffDone ? 'none' : 'translateY(16px)',
                      transition:
                        'opacity 620ms ease-out 120ms, transform 680ms cubic-bezier(0.22,1,0.36,1) 120ms',
                      /* 动画期间文字不参与布局，避免出现一块空白 */
                      display: handoffDone ? undefined : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-lcd-ink/40">
                      <span className="h-px w-8 bg-lcd-ink/22" />
                      CHAPTER {spec.order} · 第 {Number(spec.order)} 章
                    </div>

                    <h1 className="mt-4 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
                      {spec.title}
                    </h1>
                    <p className="mt-3 text-sm text-lcd-ink/50">{spec.subtitle}</p>

                    <p className="mt-4 max-w-md text-sm leading-7 text-lcd-ink/55">
                      {spec.goal}
                    </p>

                    <div className="mt-7 flex items-start gap-3 rounded-2xl bg-screen-3 px-4 py-3.5">
                      <span className="mt-0.5 text-xl">
                        {shownLine.mood === 'smug'
                          ? '😏'
                          : shownLine.mood === 'confused'
                            ? '🤔'
                            : shownLine.mood === 'hurt'
                              ? '😣'
                              : shownLine.mood === 'proud'
                                ? '😌'
                                : '🙂'}
                      </span>
                      <p className="text-sm leading-6 text-lcd-ink/78">{shownLine.text}</p>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (introAt + 1 >= lines.length) {
                            setPhase('game')
                            track('phase_enter', { phase: 'game', chapter: chapterId })
                          } else {
                            setIntroAt((i) => i + 1)
                          }
                        }}
                        className="key-lcd px-7 py-3.5 text-sm font-bold"
                      >
                        {introAt + 1 >= lines.length ? '开始 →' : '继续'}
                      </button>
                      <div className="flex items-center gap-1.5">
                        {lines.map((_, i) => (
                          <span
                            key={i}
                            className="h-1.5 rounded-full transition-all duration-300"
                            style={{
                              width: i === introAt ? 20 : 6,
                              background: i <= introAt ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.14)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center lg:justify-end">
                    {/* ★ 形态交接：上一章那只向上浮走，这一章这只从下面升上来。
                        这是"它又变了一个样"唯一的交代，别改成直接切图。 */}
                    <FormHandoff
                      from={fromBody}
                      to={spec.startLook.body}
                      size={190}
                      stageHeight={300}
                      ready={handoffReady}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- 玩法 ---------------- */}
            {phase === 'game' && (
              <>
                {forgot.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warn/35 bg-warn/8 px-5 py-3.5">
                    <span className="text-lg">😰</span>
                    <span className="text-xs leading-6 text-lcd-ink/70">
                      它刚刚被考砸了，忘掉了{' '}
                      <b className="font-mono text-warn">{forgot.join('、')}</b>。
                      把这几个重新喂给它 —— 它需要复习。
                    </span>
                  </div>
                )}

                {renderGame(ctx)}

                {state.fed >= goal && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-panel)] border border-lcd/40 bg-lcd/10 px-6 py-5">
                    <div>
                      <div className="text-sm font-semibold">
                        它准备好了。要让它出去打一场吗？
                      </div>
                      <div className="mt-1 text-xs text-lcd-ink/55">
                        BOSS：{spec.boss.name} —— {spec.boss.taunt}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPhase('boss')
                        track('phase_enter', { phase: 'boss', chapter: chapterId })
                      }}
                      className="key-lcd px-6 py-3 text-sm font-semibold"
                    >
                      带它去打 →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ---------------- BOSS ---------------- */}
            {phase === 'boss' && (
              <BossFight
                boss={{
                  name: spec.boss.name,
                  taunt: spec.boss.taunt,
                  digits: spec.boss.digits,
                  passRatio: spec.boss.passRatio,
                  winLine: { mood: 'happy', text: getBossLines(spec.boss.name).onWin },
                  loseLine: { mood: 'hurt', text: getBossLines(spec.boss.name).onLose },
                }}
                brain={state.brain}
                accuracy={(truth) => bossAccuracy(truth, state)}
                petName={name}
                petBody={body}
                styleBias={styleBias}
                onFinish={handleBossFinish}
                onWin={() => setPhase('clear')}
                onBackToFeed={backToGame}
                onRetry={() => {
                  track('boss_retry', { chapter: chapterId })
                  setPhase('game')
                  window.setTimeout(() => setPhase('boss'), 60)
                }}
                forgotDigits={forgot}
              />
            )}

            {/* ---------------- 变形演出 ---------------- */}
            {phase === 'clear' && (
              <div className="panel flex flex-col items-center border-lcd/40 px-6 py-12">
                <div className="sr-title-in text-[10px] font-semibold tracking-[0.2em] text-lcd">
                  IT EVOLVED
                </div>
                <h2 className="sr-title-in mt-3 text-2xl font-semibold tracking-[-0.04em]">
                  它变了
                </h2>

                {/* ★ 进化演出：蓄力 → 爆闪（在这一瞬换形态）→ 破光而出 */}
                <div className="mt-8">
                  <EvolveReveal
                    fromBody={spec.startLook.body}
                    toBody={body}
                    toMood={spec.endLook.mood}
                  />
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <span
                    className="sr-chip rounded-full border border-lcd/45 bg-lcd/12 px-4 py-2 text-xs font-semibold text-lcd"
                    style={{ animationDelay: '1700ms' }}
                  >
                    🏅 {spec.badge}
                  </span>
                  <span
                    className="sr-chip rounded-full border border-lcd-ink/15 bg-screen-3 px-4 py-2 text-xs font-semibold text-lcd-ink/70"
                    style={{ animationDelay: '1850ms' }}
                  >
                    学会：{spec.term}
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = nextChapter(chapterId)
                      goChapter(next as ChapterId)
                      track('chapter_next', { from: chapterId, to: next })
                    }}
                    className="key-lcd px-6 py-3 text-sm font-bold"
                  >
                    {nextChapter(chapterId) === 'card' ? '查看探索卡 →' : '进入下一章 →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('done')}
                    className="key-ghost px-5 py-3 text-sm font-medium"
                  >
                    看看后面的安排
                  </button>
                </div>
              </div>
            )}

            {/* ---------------- 后面的安排 ---------------- */}
            {phase === 'done' && (
              <div className="panel p-7">
                <h2 className="text-lg font-semibold tracking-[-0.03em]">后面还有几章</h2>
                <p className="mt-2 text-xs leading-6 text-lcd-ink/50">
                  每一章它都会长出一个新毛病，你要帮它治好。
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {CHAPTERS.filter((c) => c.id !== chapterId).map((c) => {
                    const done = cleared.includes(c.id)
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: done ? 'rgb(var(--ok-rgb) / 0.4)' : 'rgb(var(--lcd-ink-rgb) / 0.1)',
                          background: done ? 'rgb(var(--ok-rgb) / 0.06)' : 'rgb(var(--screen-bg-3-rgb))',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-lcd-ink/35">
                            {c.order}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {done && (
                              <span className="rounded-full bg-ok px-2 py-0.5 text-[10px] font-semibold text-white">
                                已通关
                              </span>
                            )}
                            <span className="rounded-full bg-screen-3 px-2 py-0.5 text-[10px] font-semibold text-lcd">
                              {c.term}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold">{c.title}</div>
                        <div className="mt-1 text-[11px] text-lcd-ink/45">{c.subtitle}</div>
                      </div>
                    )
                  })}
                </div>

                {/* ★ 两个出口。之前这里只有一个列表、没有任何按钮，
                    点进来就出不去了 —— 用户会以为卡死。 */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = nextChapter(chapterId)
                      goChapter(next as ChapterId)
                      track('chapter_next', { from: chapterId, to: next, via: 'done' })
                    }}
                    className="key-lcd px-6 py-3 text-sm font-bold"
                  >
                    {nextChapter(chapterId) === 'card' ? '查看探索卡 →' : '继续，进入下一章 →'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('clear')}
                    className="key-ghost px-5 py-3 text-sm font-medium"
                  >
                    ← 返回这一章
                  </button>
                  {onExit && (
                    <button
                      type="button"
                      onClick={onExit}
                      className="rounded-full px-5 py-3 text-sm font-medium text-lcd-ink/40 transition hover:text-lcd-ink"
                    >
                      退出，之后再回来
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---------------- 侧栏（领养时整块不显示） ---------------- */}
          {phase !== 'adopt' && (
          <aside className="flex flex-col gap-4">
            <div className="panel p-5">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-lcd-ink/38">
                <span className="inline-block size-1.5 rounded-full bg-lcd" />
                {name} 说
              </div>
              {line ? (
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-screen-3 text-lg">
                    {line.face}
                  </span>
                  <div>
                    <p className="text-sm leading-6 text-lcd-ink/80">{line.text}</p>
                    {line.note && (
                      <p className="mt-1 font-mono text-[10px] text-warn">{line.note}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs leading-6 text-lcd-ink/35">
                  它现在没说话。去看看它的问题在哪。
                </p>
              )}
            </div>

            <div className="panel p-5">
              <div className="mb-3 text-[10px] font-semibold tracking-[0.18em] text-lcd-ink/38">
                这一章的目标
              </div>
              <p className="text-xs leading-6 text-lcd-ink/60">{spec.goal}</p>
              <div className="mt-4 border-t border-lcd-ink/8 pt-3">
                <div className="text-[10px] text-lcd-ink/40">它现在的毛病</div>
                <div className="mt-1.5 text-xs font-semibold text-lcd-ink/75">
                  {spec.subtitle}
                </div>
              </div>
              <div className="mt-3 border-t border-lcd-ink/8 pt-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-lcd-ink/45">见过 {state.seen.length} / 10 个数字</span>
                  <span className="font-mono text-lcd-ink/70">
                    {state.fed} / {goal}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel border-lcd/25 bg-screen-3/90 p-5">
              <div className="text-[10px] font-semibold tracking-[0.18em] text-white/45">
                这一章在教什么
              </div>
              <p className="mt-3 text-[11px] leading-6 text-white/60">
                它的问题不是"不够努力"，是
                <b className="text-lcd">喂给它的东西有问题</b>。
                <br />
                这一章的关键词是
                <b className="text-lcd"> {spec.term} </b>。
              </p>
            </div>
          </aside>
          )}
        </div>
        </div>
      </main>
      </div>
    </div>
  )
}

