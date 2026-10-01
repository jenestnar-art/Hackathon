/* =============================================================================
   ModelCardPage.tsx —— 最终结算：模型身份证
   ---------------------------------------------------------------------------
   这是整个 AI 模块的落点。
   它不讲技术，它做一件事：把这五章里【你做过的事】翻译成【你是一个什么样的养模型的人】。

   为什么这是全模块最值钱的一屏：
     前面四章都在教概念，这一屏把概念收回到用户自己身上 ——
     "先怀疑数据"还是"先怀疑模型"，这个习惯在真实工作里是分水岭。
     而用户是在玩的过程中无意识暴露出来的，所以这行结论会让人愣一下。

   数据来源：lib/track.ts 采的事件（全程 sessionStorage）
     · 数据侧动作 vs 参数侧动作  → 性格标签
     · 平均动作间隔              → 出手速度
     · 各章留下的痕迹            → 病史
   ========================================================================== */

import { useEffect, useMemo, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import { Digit } from '@/features/ai/components/Digit'
import { PERSONALITIES, type Personality } from '@/features/ai/data/petLines'
import { CHAPTERS } from '@/features/ai/data/chapters'
import { usePetStore } from '@/features/ai/store/petStore'
import { averageGap, countOf, summarize } from '@/features/ai/lib/track'

interface ModelCardPageProps {
  onRestart?: () => void
}

/** 每章在身份证上留下的"病史" */
const HISTORY: Record<string, { label: string; cured: string }> = {
  ch0: { label: '一开始什么都不认识', cured: '喂够了样本，它认得你写的字了' },
  ch1: { label: '偏食：6 和 8 一口没吃过', cured: '把稀缺的那两类补齐了' },
  ch2: { label: '只会做原题，换个写法就废', cured: '让它见过了各种写法' },
  ch3: { label: '被人教坏：标签是错的', cured: '把内鬼样本清掉了' },
  ch4: { label: '没见过真实的题', cured: '在真实现场上也认得出' },
}

export function ModelCardPage({ onRestart }: ModelCardPageProps) {
  const name = usePetStore((s) => s.name)
  const cleared = usePetStore((s) => s.cleared)
  const badges = usePetStore((s) => s.badges)
  const glossary = usePetStore((s) => s.glossary)
  const bosses = usePetStore((s) => s.bosses)

  /** 让卡片有个"打印出来"的过程感 */
  const [revealed, setRevealed] = useState(0)
  useEffect(() => {
    const ids = [
      window.setTimeout(() => setRevealed(1), 220),
      window.setTimeout(() => setRevealed(2), 700),
      window.setTimeout(() => setRevealed(3), 1200),
      window.setTimeout(() => setRevealed(4), 1700),
      window.setTimeout(() => setRevealed(5), 2200),
    ]
    return () => ids.forEach((i) => window.clearTimeout(i))
  }, [])

  const stats = useMemo(() => {
    const s = summarize()
    const avg = averageGap()
    const param = countOf('param_adjust')
    const data = countOf('sample_add') + countOf('feed')
    return {
      ...s,
      param,
      data,
      avgGap: Number.isFinite(avg) ? avg : null,
      catches: countOf('sample_add'),
      bossSkips: countOf('boss_skip'),
      writes: countOf('write_sample'),
    }
    // cleared 变了要重算（打完最后一章才进这一页）
  }, [cleared.length])

  const personality: Personality = useMemo(() => {
    /* 判定顺序有讲究：从"最难得的品质"往"最常见的习惯"排。
       先看有没有抓内鬼的耐心，再看先怀疑谁，最后才看手速。 */
    if (stats.catches > 0 && countOf('sample_add') >= 4) return PERSONALITIES.detective
    if (stats.fixStrategy === 'param_first') return PERSONALITIES.knobBeliever
    if (stats.fixStrategy === 'data_first') return PERSONALITIES.dataDoctor
    if (stats.avgGap != null && stats.avgGap < 2600) return PERSONALITIES.rusher
    if (stats.fixStrategy === 'mixed') return PERSONALITIES.dataDoctor
    return PERSONALITIES.grinder
  }, [stats])

  /** 出手速度的描述 */
  const speed = useMemo(() => {
    if (stats.avgGap == null) return { label: '没测到', tone: 'neutral' as const }
    if (stats.avgGap < 2600) return { label: '出手很快', tone: 'fast' as const }
    if (stats.avgGap < 6000) return { label: '不快不慢', tone: 'mid' as const }
    return { label: '每一步都想清楚了才动', tone: 'slow' as const }
  }, [stats.avgGap])

  const passCount = bosses.filter((b) => b.passed).length
  const allCleared = CHAPTERS.every((c) => cleared.includes(c.id))

  return (
    <div className="min-h-screen bg-body p-3 sm:p-6 lg:p-8">
      <div className="device-shell mx-auto max-w-[960px] p-3 sm:p-4 lg:p-5">
      <div className="screen-surface p-6 text-lcd-ink sm:p-9 lg:p-11">
      <div className="screen-content mx-auto max-w-[820px]">
        {/* ---------------- 顶部 ---------------- */}
        <div
          className="text-center transition-all duration-700"
          style={{
            opacity: revealed >= 1 ? 1 : 0,
            transform: revealed >= 1 ? 'none' : 'translateY(14px)',
          }}
        >
          <div className="text-[10px] font-semibold tracking-[0.34em] text-lcd">
            MODEL CARD
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">模型身份证</h1>
          <p className="mt-3 text-xs leading-6 text-lcd-ink/45">
            这张卡不是我们发给你的 —— 是你这几章怎么养它，自己长出来的。
          </p>
        </div>

        {/* ---------------- 卡片主体 ---------------- */}
        <div
          className="panel mt-8 overflow-hidden transition-all duration-700"
          style={{
            opacity: revealed >= 2 ? 1 : 0,
            transform: revealed >= 2 ? 'none' : 'translateY(18px)',
          }}
        >
          {/* 上身：它的样子 + 名字 + 性格标签 */}
          <div className="flex flex-wrap items-center gap-7 border-b border-lcd-ink/8 p-7">
            <div className="relative">
              <Pet body={allCleared ? 'healthy' : 'round'} mood="proud" size={150} />
              <span className="absolute -right-1 -top-1 text-xl">✨</span>
            </div>

            <div className="min-w-[240px] flex-1">
              <div className="text-[10px] font-semibold tracking-[0.2em] text-lcd-ink/35">
                名字
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-[-0.03em]">{name}</div>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-lcd/45 bg-lcd/12 px-4 py-2">
                <span className="text-sm font-semibold text-lcd">
                  🏷️ {personality.title}
                </span>
              </div>

              <p className="mt-4 text-sm leading-6 text-lcd-ink/70">
                「{personality.catchphrase}」
              </p>
            </div>
          </div>

          {/* 中段：行为画像 —— 这是产品的核心卖点 */}
          <div
            className="border-b border-lcd-ink/8 p-7 transition-all duration-700"
            style={{ opacity: revealed >= 3 ? 1 : 0 }}
          >
            <div className="text-[10px] font-semibold tracking-[0.2em] text-lcd-ink/35">
              行为画像
            </div>

            <p className="mt-3 text-sm leading-7 text-lcd-ink/75">{personality.comment}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatBox
                label="遇到问题先动哪边"
                value={
                  stats.param === 0 && stats.data === 0
                    ? '还没出手'
                    : stats.param > stats.data
                      ? '先转旋钮'
                      : '先看数据'
                }
                sub={`数据侧 ${stats.data} 次 · 参数侧 ${stats.param} 次`}
                highlight={stats.data > stats.param}
              />
              <StatBox
                label="出手速度"
                value={speed.label}
                sub={
                  stats.avgGap
                    ? `平均每步 ${(stats.avgGap / 1000).toFixed(1)} 秒`
                    : '数据不足'
                }
                highlight={speed.tone !== 'fast'}
              />
              <StatBox
                label="耐心活儿"
                value={stats.catches > 0 ? `翻了 ${stats.catches} 张样本` : '没怎么翻'}
                sub={stats.writes > 0 ? `自己动手写了 ${stats.writes} 次` : '没自己写过'}
                highlight={stats.catches >= 4}
              />
            </div>

            {stats.bossSkips > 0 && (
              <p className="mt-4 text-[11px] leading-6 text-lcd-ink/40">
                你跳过了 {stats.bossSkips} 场 BOSS 的过程 —— 说明你更想看结果，不想看过程。这也是一种风格。
              </p>
            )}
          </div>

          {/* 下段：病史 + 学到的词
              ★ 左右两栏【从各自那一侧滑进来】：左栏从左往右，右栏从右往左。
                两侧对向进入、在中间合拢，比整块淡入有交代得多。
                它们是分先后揭示的（左栏先，右栏晚 120ms），
                所以看起来是"一条条铺开"，而不是"一起蹦出来"。 */}
          <div className="p-7">
            <div className="grid gap-7 sm:grid-cols-2">
              {/* 病史 —— 从左往右进 */}
              <div
                className={`slide-in slide-from-left${revealed >= 4 ? ' is-in' : ''}`}
              >
                <div className="label">
                  它的病史（和治好的过程）
                </div>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {CHAPTERS.map((c) => {
                    const h = HISTORY[c.id]
                    const done = cleared.includes(c.id)
                    if (!h) return null
                    return (
                      <li key={c.id} className="flex items-start gap-2.5 text-[11px] leading-5">
                        <span
                          className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full"
                          style={{ background: done ? 'rgb(var(--ok-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.22)' }}
                        />
                        <span className={done ? 'text-lcd-ink/65' : 'text-lcd-ink/30'}>
                          {done ? h.cured : h.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* 徽章 + 学到的词 —— 从右往左进，晚 120ms */}
              <div
                className={`slide-in slide-from-right${revealed >= 4 ? ' is-in' : ''}`}
                style={{ transitionDelay: '120ms' }}
              >
                <div className="label">
                  拿到的徽章
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {badges.length === 0 ? (
                    <span className="text-[11px] text-lcd-ink/30">还没有</span>
                  ) : (
                    badges.map((b) => (
                      <span
                        key={b}
                        className="rounded-full border border-lcd/40 bg-lcd/12 px-3 py-1.5 text-[11px] font-semibold text-lcd"
                      >
                        🏅 {b}
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-5 text-[10px] font-semibold tracking-[0.2em] text-lcd-ink/35">
                  它这一路学会的词
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {glossary.length === 0 ? (
                    <span className="text-[11px] text-lcd-ink/30">还没有</span>
                  ) : (
                    glossary.map((t: string) => (
                      <span
                        key={t}
                        className="rounded-full bg-lcd-ink/6 px-3 py-1.5 text-[11px] font-medium text-lcd-ink/60"
                      >
                        {t}
                      </span>
                    ))
                  )}
                </div>

                <div className="mt-5 text-[10px] font-semibold tracking-[0.2em] text-lcd-ink/35">
                  战绩
                </div>
                <p className="mt-3 text-[11px] leading-6 text-lcd-ink/60">
                  通关 {cleared.length} / {CHAPTERS.length} 章 · BOSS 赢 {passCount} 场
                  {bosses.length > passCount && ` · 输 ${bosses.length - passCount} 场`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- 收尾 ---------------- */}
        <div
          className={`slide-in slide-from-bottom mt-8 flex flex-col items-center gap-5${
            revealed >= 5 ? ' is-in' : ''
          }`}
        >
          <div className="panel flex items-center gap-3 px-6 py-5">
            <div className="flex items-center gap-1.5">
              {/* ★ 这排数字必须显式给亮色：
                  Digit 的默认色是深绿（配浅底用的），印在暗屏上会直接隐形。 */}
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <Digit key={d} value={d} size={17} color="#e8f2ee" />
              ))}
            </div>
            <p className="text-[11px] leading-5 text-lcd-ink/50">
              十个数字，一开始它一个都不认识。
              <br />
              现在它认得了 —— 而它变成什么样，是你喂出来的。
            </p>
          </div>

          <p className="max-w-[560px] text-center text-xs leading-6 text-lcd-ink/45">
            在这条路上，最先该被怀疑的往往不是模型，是喂给它的东西。
            <br />
            你刚才做的那些选择，就是 AI 工程师每天在做的事。
          </p>

          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="key-lcd px-6 py-3 text-sm font-bold"
            >
              重新养一只
            </button>
          )}
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   一个数据小格
   ------------------------------------------------------------------------ */
function StatBox({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub: string
  highlight?: boolean
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3.5"
      style={{
        borderColor: highlight ? 'rgb(var(--ok-rgb) / 0.38)' : 'rgb(var(--lcd-ink-rgb) / 0.11)',
        background: highlight ? 'rgb(var(--ok-rgb) / 0.07)' : 'rgb(var(--screen-bg-3-rgb))',
      }}
    >
      <div className="text-[10px] text-lcd-ink/45">{label}</div>
      <div
        className="mt-1 text-sm font-semibold"
        style={{ color: highlight ? 'rgb(var(--ok-rgb))' : 'rgb(var(--lcd-ink-rgb))' }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-lcd-ink/35">{sub}</div>
    </div>
  )
}
