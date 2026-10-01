/* =============================================================================
   PetLabPage.tsx —— 宠物形态预览台（临时页面）
   ---------------------------------------------------------------------------
   作用：一屏看完它所有形态和情绪，方便你和队友对着挑/改美术。
   ⚠️ 这是开发用的临时页，交付前可以删掉，不影响其它任何东西。
   ========================================================================== */

import { useState } from 'react'
import { FACES, type BodyKind, type Mood } from '@/features/ai/pet/petState'
import { Pet } from '@/features/ai/pet/Pet'
import { CHAPTERS } from '@/features/ai/data/chapters'
import { INTRO_LINES, CH0, CH1, CH2, CH3, CH4 } from '@/features/ai/data/petLines'
import { BRAIN, BRAIN_LABEL, classify, type BrainState } from '@/features/ai/lib/modelBrain'

const BODY_ORDER: BodyKind[] = ['blob', 'round', 'fat', 'box', 'spiky', 'healthy']
const MOOD_ORDER = Object.keys(FACES) as Mood[]

export function PetLabPage() {
  const [brain, setBrain] = useState<BrainState>('untrained')
  const [probe, setProbe] = useState<number>(3)
  const [result, setResult] = useState<string | null>(null)

  const BODY_LABEL: Record<BodyKind, string> = {
    blob: '开局：一坨糊的',
    round: '正常：圆滚',
    fat: '偏食：吃撑了',
    box: '背书：僵成方块',
    spiky: '被教坏：长刺发红',
    healthy: '长好了：匀称',
  }

  function tryClassify() {
    const g = classify(brain, probe)
    const hit = g.digit === probe
    setResult(
      `${probe} → 它说「${g.digit}」 ${hit ? '✅ 答对' : '❌ 答错'}，置信度 ${Math.round(g.confidence * 100)}%`
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f3ed] px-6 py-10 text-[#12201e] sm:px-10">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-8">
          <div className="text-[10px] font-semibold tracking-[0.2em] text-[#12201e]/38">
            AI TRACK · PET LAB
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
            小生物形态预览台
          </h1>
          <p className="mt-2 text-xs leading-6 text-[#12201e]/50">
            这是开发用的临时页面。下面一屏展示它的全部身体与情绪，方便挑美术、改参数。
          </p>
        </div>

        {/* ---------------- 身体 ---------------- */}
        <Section title="六种身体 = 六章状态">
          <div className="flex flex-wrap gap-8">
            {BODY_ORDER.map((b) => (
              <div key={b} className="text-center">
                <Pet body={b} size={150} still />
                <div className="mt-2 text-[11px] font-medium">
                  {BODY_LABEL[b]}
                </div>
                <div className="font-mono text-[10px] text-[#12201e]/35">{b}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- 情绪 ---------------- */}
        <Section title="七种情绪">
          <div className="flex flex-wrap gap-6">
            {MOOD_ORDER.map((m) => (
              <div key={m} className="text-center">
                <Pet body="round" mood={m} size={118} />
                <div className="mt-1.5 font-mono text-[11px] text-[#12201e]/50">
                  {m}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------- 台词 ---------------- */}
        <Section title="台词与气泡">
          <div className="flex flex-wrap gap-8">
            <Pet
              body="round"
              mood={INTRO_LINES[2].mood}
              size={150}
              speech={INTRO_LINES[2].text}
              note={INTRO_LINES[2].note}
            />
            <Pet
              body="fat"
              mood={CH1.fail[0].mood}
              size={150}
              speech={CH1.fail[0].text}
              note={CH1.fail[0].note}
            />
            <Pet
              body="box"
              mood={CH2.fail[1].mood}
              size={150}
              speech={CH2.fail[1].text}
            />
            <Pet
              body="spiky"
              mood={CH3.fail[0].mood}
              spots={5}
              size={150}
              speech={CH3.fail[0].text}
              note={CH3.fail[0].note}
            />
          </div>
        </Section>

        {/* ---------------- 大脑表 ---------------- */}
        <Section title="模型大脑表（每章的能力）">
          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(BRAIN) as BrainState[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setBrain(s)}
                className="rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition"
                style={
                  brain === s
                    ? { background: '#ff6b35', borderColor: '#ff6b35', color: '#fff' }
                    : {
                        background: '#fff',
                        borderColor: 'rgba(18,32,30,0.1)',
                        color: 'rgba(18,32,30,0.6)',
                      }
                }
              >
                {s}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-[#12201e]/8 bg-white p-5">
            <div className="mb-3 text-xs text-[#12201e]/55">
              当前状态：
              <b className="text-[#12201e]">{BRAIN_LABEL[brain]}</b>
            </div>
            <div className="flex flex-col gap-1.5">
              {BRAIN[brain].map((acc, d) => (
                <div
                  key={d}
                  className="grid items-center gap-2.5"
                  style={{ gridTemplateColumns: '16px 1fr 44px' }}
                >
                  <span className="font-mono text-xs font-bold">{d}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#12201e]/8">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${acc * 100}%`,
                        background: acc < 0.3 ? '#e4542f' : '#ff6b35',
                      }}
                    />
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[#12201e]/50">
                    {Math.round(acc * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 现场试一次识别 */}
          <div className="mt-4 rounded-2xl border border-[#12201e]/8 bg-white p-5">
            <div className="mb-3 text-xs text-[#12201e]/55">
              现场考它一次（验证"错得离谱"的剧本会稳定发生）
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#12201e]/50">给它看：</span>
              {[3, 6, 8, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setProbe(d)}
                  className="rounded-xl border px-3 py-1.5 font-mono text-sm font-bold transition"
                  style={
                    probe === d
                      ? { background: '#12201e', borderColor: '#12201e', color: '#fff' }
                      : { background: '#f7f6f2', borderColor: 'rgba(18,32,30,0.1)' }
                  }
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={tryClassify}
                className="rounded-full bg-[#ff6b35] px-4 py-2 text-xs font-semibold text-white"
              >
                让它答
              </button>
            </div>
            {result && (
              <div className="mt-3 font-mono text-xs text-[#12201e]/75">{result}</div>
            )}
            <p className="mt-2 text-[11px] text-[#12201e]/40">
              提示：切到「poisoned」再反复点"让它答"，你会看到它把 3 认成 8 且很自信——
              第 3 章最关键的一幕。
            </p>
          </div>
        </Section>

        {/* ---------------- 章节表 ---------------- */}
        <Section title="五章配置">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-[#12201e]/8 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-[#12201e]/35">
                    {c.order}
                  </span>
                  <span className="rounded-full bg-[#fff0e8] px-2 py-0.5 text-[10px] font-semibold text-[#ff6b35]">
                    {c.term}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold">{c.title}</div>
                <div className="mt-1 text-[11px] text-[#12201e]/45">{c.subtitle}</div>
                <div className="mt-3 border-t border-[#12201e]/8 pt-3 text-[11px] text-[#12201e]/55">
                  BOSS：<b className="text-[#12201e]">{c.boss.name}</b>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-10 rounded-2xl border border-[#12201e]/8 bg-[#101917] px-5 py-4 text-xs leading-6 text-white/60">
          看完这一页，告诉我：哪几种身体不像 / 哪个情绪不对 / 台词要不要改。
          这一页改完，我再往下做第 0 章的实际玩法。
        </div>

        <div className="mt-4 text-[11px] text-[#12201e]/35">
          其它章节台词速览：{CH0.title} · {CH1.title} · {CH2.title} · {CH3.title} ·{' '}
          {CH4.title}
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-9">
      <h2 className="mb-4 text-[10px] font-semibold tracking-[0.2em] text-[#12201e]/38">
        {title}
      </h2>
      {children}
    </section>
  )
}
