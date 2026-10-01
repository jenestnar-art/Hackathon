/* =============================================================================
   AdoptPet.tsx —— 领养页：给它取个名字
   ---------------------------------------------------------------------------
   为什么要这一步：
     之前的开场是"你已经被分配了一只灰球"。加一个领养动作之后，
     它从"一只演示用的球"变成"我的"。后面每一次它犯病、被戳、开窍，
     情绪落点都不一样 —— 这几乎不花成本，但整条情感线立起来了。

   命名限制（按需求）：
     · 最多 5 个字符（一个汉字算 1 个字符）
     · 不能为空
     · 已经在打字时就把超出的截断，而不是等提交才报错
   ========================================================================== */

import { useEffect, useRef, useState } from 'react'
import { Pet } from '@/features/ai/pet/Pet'
import { track } from '@/features/ai/lib/track'
import type { BodyKind, Mood } from '@/features/ai/pet/petState'

/** 名字最多几个字符 */
export const NAME_MAX = 5

/** 系统随机给几个候选，懒得想的可以一键用 */
const SUGGESTIONS = ['豆豆', '小灰', '阿零', '团子', '煤球', '汤圆', '小八']

interface AdoptPetProps {
  /** 系统已经随机给的那个名字 */
  defaultName: string
  body: BodyKind
  mood: Mood
  /** 点"就它了" */
  onAdopt: (name: string) => void
}

export function AdoptPet({ defaultName, body, mood, onAdopt }: AdoptPetProps) {
  const [name, setName] = useState(defaultName)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // 自动聚焦，省一次点击
    const id = window.setTimeout(() => inputRef.current?.focus(), 420)
    return () => window.clearTimeout(id)
  }, [])

  const trimmed = name.trim()
  const tooLong = name.length > NAME_MAX
  const empty = trimmed.length === 0
  const valid = !tooLong && !empty

  /** 截断到 5 个字符（超出直接砍，不给报错的机会） */
  function handleChange(v: string) {
    setTouched(true)
    setName(v.slice(0, NAME_MAX))
  }

  const remaining = NAME_MAX - name.length

  return (
    <div className="panel relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-lcd/8 blur-[110px]" />
      <div className="num pointer-events-none absolute -right-10 -top-16 select-none text-[150px] font-black leading-none text-lcd opacity-[0.1]">
        NEW
      </div>

      <div className="relative z-10 grid gap-8 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
        {/* 左边：命名 */}
        <div>
          <div className="label flex items-center gap-3">
            <span className="h-px w-8 bg-lcd-ink/22" />
            ADOPT · 领养
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            先给它取个名字
          </h1>
          <p className="mt-3 max-w-md text-sm leading-7 text-lcd-ink/55">
            它会陪你走完五章。你喂它什么、什么时候不耐烦、先怀疑数据还是先转旋钮
            —— 都会留在它身上。
          </p>

          {/* 输入框 */}
          <div className="mt-7 max-w-sm">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="pet-name" className="text-[11px] font-semibold text-lcd-ink/50">
                它的名字
              </label>
              <span
                className="font-mono text-[10px]"
                style={{ color: remaining <= 1 ? 'rgb(var(--warn-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.4)' }}
              >
                {name.length} / {NAME_MAX}
              </span>
            </div>

            <input
              id="pet-name"
              ref={inputRef}
              value={name}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && valid) {
                  track('pet_named', { name: trimmed, source: 'typed' })
                  onAdopt(trimmed)
                }
              }}
              placeholder="最多 5 个字"
              className="w-full rounded-[var(--r-panel)] border bg-screen px-4 py-3.5 text-lg font-semibold tracking-[-0.02em] text-lcd-ink outline-none transition placeholder:text-base placeholder:font-normal placeholder:text-lcd-ink/25"
              style={{
                borderColor: touched && !valid ? 'rgb(var(--warn-rgb) / 0.55)' : 'rgb(var(--lcd-ink-rgb) / 0.16)',
              }}
            />

            {/* 校验提示 */}
            <div className="mt-2 h-5 text-[11px]">
              {touched && empty && <span className="text-warn">总得有个名字吧。</span>}
              {tooLong && <span className="text-warn">最多 {NAME_MAX} 个字。</span>}
              {valid && <span className="text-lcd-ink/35">回车也能确认。</span>}
            </div>

            {/* 候选名 */}
            <div className="mt-3">
              <div className="mb-2 text-[10px] text-lcd-ink/38">懒得想？从这些里挑一个：</div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setTouched(true)
                      setName(s)
                    }}
                    className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition hover:-translate-y-0.5"
                    style={{
                      borderColor: name === s ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.16)',
                      background: name === s ? 'rgb(var(--lcd-rgb) / 0.14)' : 'rgb(var(--screen-bg-3-rgb))',
                      color: name === s ? 'rgb(var(--lcd-rgb))' : 'rgb(var(--lcd-ink-rgb) / 0.62)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!valid}
            onClick={() => {
              track('pet_named', { name: trimmed, source: 'button' })
              onAdopt(trimmed)
            }}
            className="key-lcd mt-7 px-7 py-3.5 text-sm font-bold"
          >
            就它了，叫「{trimmed || '……'}」→
          </button>
        </div>

        {/* 右边：它在等你的名字 */}
        <div className="flex flex-col items-center">
          <Pet body={body} mood={mood} size={186} />
          <div className="mt-2 text-center text-[11px] font-semibold text-lcd-ink/40">
            {valid ? `「${trimmed}」……是在叫我吗？` : '它还没名字'}
          </div>
        </div>
      </div>
    </div>
  )
}
